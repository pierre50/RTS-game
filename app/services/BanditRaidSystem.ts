import { Player } from '../classes/players/Player'
import { ACTION_TYPES, PLAYER_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import { canAfford, getCellsAroundPoint, getFreeLandCellAroundInstance, payCost } from '../lib'
import { t } from '../lib/lang'
import { setUnitOverheadIndicator } from '../lib/overheadIndicator'
import { createInspectionModal } from '../ui/InspectionPanel'
import { createTitledEntityInfoContent } from '../ui/EntityInfoModalManager'
import type { DailyWorldEvent, DailyWorldEventHandler } from './DailyWorldEventSystem'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { ResourceAmount } from '../types/common'
import type { RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { PlayerLike } from '../types/player'
import type { Modal } from '../lib'

const BANDIT_OWNER_NAME = 'Bandits'
const BANDIT_RAID_FIRST_DAY = 4
const BANDIT_RAID_INTERVAL_DAYS = 4
const BANDIT_RAID_APPROACH_RANGE = 2.2
const BANDIT_RAID_RETURN_RANGE = 3
const BANDIT_RAID_UPDATE_MS = 350
const BANDIT_RAID_SPAWN_MIN_RADIUS = 4
const BANDIT_RAID_SPAWN_MAX_RADIUS = 9
const PORTAL_RESOURCE_TYPE = 'Portal'

type BanditRaidPhase = 'approaching' | 'parley' | 'hostile' | 'leaving'

type BanditRaidUnit = UnitEntity & {
  banditRaidId?: string
}

type BanditRaidOwner = PlayerLike & {
  banditRaidOwner?: true
}

type BanditRaid = {
  id: string
  chief: BanditRaidUnit
  units: BanditRaidUnit[]
  phase: BanditRaidPhase
  portal: RuntimeEntity | null
  tribute: ResourceAmount
  modal?: Modal | null
  updateTaskId?: SchedulerTaskId | null
}

function isRaidBanditOwner(player: PlayerLike): player is BanditRaidOwner {
  return Boolean((player as BanditRaidOwner).banditRaidOwner)
}

function isOpenLandCell(cell: RuntimeCell | null | undefined): cell is RuntimeCell {
  return Boolean(cell && !cell.solid && !cell.has && !cell.border && !cell.waterBorder && cell.category !== 'Water')
}

function cellDistance(a: Pick<RuntimeEntity, 'i' | 'j'>, b: Pick<RuntimeEntity, 'i' | 'j'>): number {
  return Math.hypot((a.i ?? 0) - (b.i ?? 0), (a.j ?? 0) - (b.j ?? 0))
}

function livingRaidUnits(raid: BanditRaid): BanditRaidUnit[] {
  return raid.units.filter(unit => !unit.isDead && !unit.isDestroyed)
}

function formatCost(cost: ResourceAmount): string {
  return Object.entries(cost)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
    .map(([resource, amount]) => `${amount} ${t(resource)}`)
    .join(', ')
}

export class BanditRaidSystem implements DailyWorldEventHandler {
  context: GameContextLike
  raids: BanditRaid[]
  lastScheduledDay: number

  constructor(context: GameContextLike) {
    this.context = context
    this.raids = []
    this.lastScheduledDay = 0
  }

  handleDailyWorldEvent({ day }: DailyWorldEvent): void {
    if (day < BANDIT_RAID_FIRST_DAY) return
    if ((day - BANDIT_RAID_FIRST_DAY) % BANDIT_RAID_INTERVAL_DAYS !== 0) return
    if (this.lastScheduledDay === day) return
    this.lastScheduledDay = day
    this.triggerRaid({ source: 'schedule' })
  }

  triggerRaid(_options: { source?: 'schedule' | 'dev-console' } = {}): boolean {
    if (this.raids.some(raid => livingRaidUnits(raid).length > 0)) return false
    const hero = this.context.controls?.heroUnit
    if (!hero || hero.isDead || hero.isDestroyed) return false
    const spawnCells = this.findSpawnCells(hero, this.getRaidSize())
    if (!spawnCells.length) return false

    const owner = this.getOrCreateBanditOwner()
    const portal = this.findPortal()
    const raid: BanditRaid = {
      id: `bandit-raid-${Date.now()}-${Math.round((this.context.map.random?.() ?? Math.random()) * 100000)}`,
      chief: null as unknown as BanditRaidUnit,
      units: [],
      phase: 'approaching',
      portal,
      tribute: this.getTributeCost(),
      modal: null,
      updateTaskId: null,
    }

    const unitTypes = this.getRaidUnitTypes(spawnCells.length)
    for (let index = 0; index < unitTypes.length; index++) {
      const cell = spawnCells[index]
      const unit = owner.createUnit?.({
        i: cell.i,
        j: cell.j,
        type: unitTypes[index],
        gender: 'male',
        appearanceVariants: { gender: 'male' },
        handleIsAttacked: attacker => {
          if (attacker?.owner === this.context.player && raid.phase !== 'hostile') {
            this.makeRaidHostile(raid)
            return true
          }
          return false
        },
      }) as BanditRaidUnit | undefined
      if (!unit) continue
      unit.banditRaidId = raid.id
      raid.units.push(unit)
      if (unit.type === UNIT_TYPES.banditChief) raid.chief = unit
    }

    if (!raid.units.length || !raid.chief) return false
    setUnitOverheadIndicator(raid.chief, 'exclamation')
    this.raids.push(raid)
    this.sendRaidToHero(raid, { forceRepath: true })
    this.startRaidUpdates(raid)
    this.context.menu?.showMessage(t('banditRaidIncoming'), 'warning')
    this.context.menu?.updatePlayerMiniMapEvt?.(owner)
    return true
  }

  getOrCreateBanditOwner(): BanditRaidOwner {
    const existing = this.context.players.find(isRaidBanditOwner)
    if (existing) {
      existing.diplomacy = 'neutral'
      return existing
    }

    const owner = new Player(
      {
        name: BANDIT_OWNER_NAME,
        type: PLAYER_TYPES.ai,
        isPlayed: false,
        color: 'red',
        civ: this.context.player?.civ ?? 'Greek',
        gender: 'male',
        team: null,
        diplomacy: 'neutral',
        populationMax: Number.POSITIVE_INFINITY,
        autoTechnologyByAge: false,
      },
      this.context
    ) as BanditRaidOwner
    owner.banditRaidOwner = true
    owner.selectedUnits = []
    owner.selectedUnit = null
    owner.selectedBuilding = null
    owner.selectedOther = null
    owner.hasBuilt = []
    this.context.players.push(owner)
    return owner
  }

  getRaidSize(): number {
    const player = this.context.player
    const day = this.context.dayNight?.state?.day ?? 1
    const ageBonus = Math.max(0, player?.age ?? 0)
    return Math.max(2, Math.min(7, 2 + ageBonus + Math.floor(day / 5)))
  }

  getRaidUnitTypes(count: number): string[] {
    const types = [UNIT_TYPES.banditChief]
    for (let index = 1; index < count; index++) {
      const useArcher = index % 3 === 0 || (this.context.player?.age ?? 0) >= 2
      types.push(useArcher ? UNIT_TYPES.banditArcher : UNIT_TYPES.banditSword)
    }
    return types
  }

  getTributeCost(): ResourceAmount {
    const day = this.context.dayNight?.state?.day ?? 1
    const age = this.context.player?.age ?? 0
    return {
      food: 40 + day * 5 + age * 20,
      gold: 25 + day * 4 + age * 15,
    }
  }

  findPortal(): RuntimeEntity | null {
    const resources = this.context.map?.resources
    if (!resources) return null
    return [...resources].find(resource => resource.type === PORTAL_RESOURCE_TYPE && !resource.isDestroyed) ?? null
  }

  findSpawnCells(hero: UnitEntity, count: number): RuntimeCell[] {
    const grid = this.context.map?.grid
    if (!grid) return []
    const portal = this.findPortal()
    const anchor = portal ?? hero
    const cells: RuntimeCell[] = []
    for (let distance = BANDIT_RAID_SPAWN_MIN_RADIUS; distance <= BANDIT_RAID_SPAWN_MAX_RADIUS; distance++) {
      const ring = getCellsAroundPoint(anchor.i, anchor.j, grid, distance, isOpenLandCell)
      ring.sort(() => (this.context.map.random?.() ?? Math.random()) - 0.5)
      for (const cell of ring) {
        if (cells.includes(cell)) continue
        if (portal && cellDistance(cell, hero) < 8) continue
        cells.push(cell)
        if (cells.length >= count) return cells
      }
    }
    const fallback = getFreeLandCellAroundInstance(hero, grid)
    if (fallback) cells.push(fallback)
    return cells
  }

  startRaidUpdates(raid: BanditRaid): void {
    raid.updateTaskId = this.context.scheduler.add(() => this.updateRaid(raid), BANDIT_RAID_UPDATE_MS, 'banditRaid.update')
  }

  updateRaid(raid: BanditRaid): void {
    const hero = this.context.controls?.heroUnit
    const units = livingRaidUnits(raid)
    if (!hero || !units.length || hero.isDead || hero.isDestroyed) {
      this.cleanupRaid(raid)
      return
    }

    if (raid.phase === 'approaching') {
      if (cellDistance(raid.chief, hero) <= BANDIT_RAID_APPROACH_RANGE) {
        this.openTributeModal(raid)
        return
      }
      this.sendRaidToHero(raid)
      return
    }

    if (raid.phase === 'leaving') {
      const portal = raid.portal
      if (!portal || units.every(unit => cellDistance(unit, portal) <= BANDIT_RAID_RETURN_RANGE)) {
        this.despawnRaid(raid)
      }
    }
  }

  sendRaidToHero(raid: BanditRaid, options: { forceRepath?: boolean } = {}): void {
    const hero = this.context.controls?.heroUnit
    if (!hero) return
    for (const unit of livingRaidUnits(raid)) {
      unit.work = WORK_TYPES.attacker
      unit.action = null
      unit.sendToEvt?.(hero, null, options)
    }
  }

  sendRaidToPortal(raid: BanditRaid): void {
    const portal = raid.portal ?? this.findPortal()
    raid.portal = portal
    if (!portal) {
      this.despawnRaid(raid)
      return
    }
    for (const unit of livingRaidUnits(raid)) {
      unit.sendToEvt?.(portal, null, { forceRepath: true })
    }
  }

  openTributeModal(raid: BanditRaid): void {
    if (raid.phase !== 'approaching' || raid.modal) return
    raid.phase = 'parley'
    for (const unit of livingRaidUnits(raid)) unit.stop?.()

    let resolved = false
    const content = document.createElement('div')
    content.className = 'bandit-tribute-modal-content'
    content.appendChild(createTitledEntityInfoContent(this.context.app, raid.chief))

    const speech = document.createElement('p')
    speech.className = 'bandit-tribute-text portal-description'
    speech.textContent = t('banditTributeDemand', { cost: formatCost(raid.tribute) })
    content.appendChild(speech)

    const actions = document.createElement('div')
    actions.className = 'npc-orders-options bandit-tribute-actions'

    const canPayTribute = canAfford(this.context.player, raid.tribute)
    const payButton = document.createElement('button')
    payButton.type = 'button'
    payButton.className = 'ui-btn'
    payButton.textContent = t('banditTributePay')
    payButton.disabled = !canPayTribute
    if (!canPayTribute) payButton.title = t('banditTributeCannotPay')
    payButton.addEventListener('click', () => {
      if (!canAfford(this.context.player, raid.tribute)) {
        this.context.menu?.showMessage(t('banditTributeCannotPay'), 'warning')
        return
      }
      resolved = true
      payCost(this.context.player, raid.tribute)
      this.context.menu?.updateTopbar()
      raid.modal?.close()
      raid.modal = null
      this.acceptTribute(raid)
    })
    actions.appendChild(payButton)

    const refuseButton = document.createElement('button')
    refuseButton.type = 'button'
    refuseButton.className = 'ui-btn'
    refuseButton.textContent = t('banditTributeRefuse')
    refuseButton.addEventListener('click', () => {
      resolved = true
      raid.modal?.close()
      raid.modal = null
      this.makeRaidHostile(raid)
    })
    actions.appendChild(refuseButton)
    content.appendChild(actions)

    raid.modal = createInspectionModal({
      title: t('banditTributeTitle'),
      content,
      panelClass: 'bandit-tribute-modal',
      onClose: () => {
        raid.modal = null
        if (!resolved && raid.phase === 'parley') this.makeRaidHostile(raid)
      },
    })
  }

  acceptTribute(raid: BanditRaid): void {
    raid.phase = 'leaving'
    setUnitOverheadIndicator(raid.chief, null)
    this.context.menu?.showMessage(t('banditTributePaid'), 'success')
    this.sendRaidToPortal(raid)
  }

  makeRaidHostile(raid: BanditRaid): void {
    if (raid.phase === 'hostile') return
    raid.phase = 'hostile'
    raid.modal?.close()
    raid.modal = null
    setUnitOverheadIndicator(raid.chief, null)
    const owner = raid.chief.owner
    if (owner) owner.diplomacy = null
    const hero = this.context.controls?.heroUnit
    if (hero) {
      for (const unit of livingRaidUnits(raid)) {
        unit.sendToEvt?.(hero, ACTION_TYPES.attack, { forceRepath: true })
      }
    }
    this.context.menu?.showMessage(t('banditRaidHostile'), 'warning')
  }

  despawnRaid(raid: BanditRaid): void {
    for (const unit of livingRaidUnits(raid)) {
      this.removeUnitFromRuntime(unit)
    }
    this.cleanupRaid(raid)
  }

  removeUnitFromRuntime(unit: BanditRaidUnit): void {
    unit.stop?.()
    setUnitOverheadIndicator(unit, null)
    const cell = unit.currentCell
    if (cell?.has === unit) {
      cell.has = null
      cell.solid = false
    }
    unit.context?.map?.removeFromInstanceBucket(unit)
    const ownerUnits = unit.owner?.units
    const index = ownerUnits?.indexOf(unit) ?? -1
    if (index >= 0) ownerUnits?.splice(index, 1)
    if (unit.owner) unit.owner.population = Math.max(0, (unit.owner.population ?? 0) - 1)
    unit.isDestroyed = true
    unit.context?.map?.removeChild(unit)
    unit.destroy?.({ children: true, texture: false })
  }

  cleanupRaid(raid: BanditRaid): void {
    if (raid.updateTaskId != null) {
      this.context.scheduler.remove(raid.updateTaskId)
      raid.updateTaskId = null
    }
    raid.modal?.close()
    raid.modal = null
    setUnitOverheadIndicator(raid.chief, null)
    const index = this.raids.indexOf(raid)
    if (index >= 0) this.raids.splice(index, 1)
  }

  destroy(): void {
    for (const raid of [...this.raids]) this.cleanupRaid(raid)
  }
}
