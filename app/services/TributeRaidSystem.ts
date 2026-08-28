import { Player } from '../classes/players/Player'
import { ACTION_TYPES, FADE_DURATION_MS, PLAYER_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import { canAfford, getCellsAroundPoint, getFreeLandCellAroundInstance, payCost } from '../lib'
import { fadeOut } from '../lib/entities/entityFade'
import { t } from '../lib/lang'
import { setUnitOverheadIndicator } from '../lib/entities/overheadIndicator'
import { createInspectionModal } from '../ui/InspectionPanel'
import { createTitledEntityInfoContent } from '../ui/EntityInfoModalManager'
import type { DailyWorldEvent, DailyWorldEventHandler } from './DailyWorldEventSystem'
import {
  BANDIT_OWNER_NAME,
  BANDIT_RAID_FIRST_DAY,
  BANDIT_RAID_INTERVAL_DAYS,
  FACTION_RAID_FIRST_DAY,
  FACTION_RAID_INTERVAL_DAYS,
  FACTION_RAID_MIN_HATE,
  PORTAL_RESOURCE_TYPE,
  RAID_APPROACH_RANGE,
  RAID_RETURN_RANGE,
  RAID_SPAWN_MAX_RADIUS,
  RAID_SPAWN_MIN_RADIUS,
  RAID_UPDATE_MS,
  getRaidCellDistance,
  getRaidUnitTypes,
  isOpenRaidLandCell,
  isRaidBanditOwner,
  isRaidFactionOwner,
  livingRaidUnits,
  type TributeRaid,
  type TributeRaidKind,
  type TributeRaidOwner,
  type TributeRaidUnit,
} from './TributeRaidRules'
import {
  getHostileRaidMessage,
  getIncomingRaidMessage,
  getTributeDemand,
  getTributePaidMessage,
  getTributeTitle,
} from './TributeRaidText'
import type { GameContextLike } from '../types/context'
import type { ResourceAmount } from '../types/common'
import type { RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { FactionSave } from '../types/save'

export class TributeRaidSystem implements DailyWorldEventHandler {
  context: GameContextLike
  raids: TributeRaid[]
  lastScheduledDay: number

  constructor(context: GameContextLike) {
    this.context = context
    this.raids = []
    this.lastScheduledDay = 0
  }

  handleDailyWorldEvent({ day }: DailyWorldEvent): void {
    if (
      day >= FACTION_RAID_FIRST_DAY &&
      (day - FACTION_RAID_FIRST_DAY) % FACTION_RAID_INTERVAL_DAYS === 0 &&
      this.lastScheduledDay !== day &&
      this.triggerFactionRaid({ source: 'schedule' })
    ) {
      this.lastScheduledDay = day
      return
    }

    if (day < BANDIT_RAID_FIRST_DAY) return
    if ((day - BANDIT_RAID_FIRST_DAY) % BANDIT_RAID_INTERVAL_DAYS !== 0) return
    if (this.lastScheduledDay === day) return
    this.lastScheduledDay = day
    this.triggerRaid({ source: 'schedule' })
  }

  triggerRaid(_options: { source?: 'schedule' | 'dev-console' } = {}): boolean {
    if (!this.canStartRaid()) return false
    return this.createRaid({
      kind: 'bandit',
      owner: this.getOrCreateBanditOwner(),
      size: this.getBanditRaidSize(),
      tribute: this.getBanditTributeCost(),
    })
  }

  triggerFactionRaid(options: { ignoreBaseWorld?: boolean; source?: 'schedule' | 'dev-console' } = {}): boolean {
    if (!this.canStartRaid()) return false
    const faction = this.findAngryKnownFaction(options)
    if (!faction) return false
    return this.createRaid({
      kind: 'faction',
      faction,
      owner: this.getOrCreateFactionRaidOwner(faction),
      size: this.getFactionRaidSize(faction),
      tribute: this.getFactionTributeCost(faction),
    })
  }

  createRaid(options: {
    faction?: FactionSave | null
    kind: TributeRaidKind
    owner: TributeRaidOwner
    size: number
    tribute: ResourceAmount
  }): boolean {
    if (!this.canStartRaid()) return false
    const hero = this.context.controls?.heroUnit
    if (!hero || hero.isDead || hero.isDestroyed) return false
    const spawnCells = this.findSpawnCells(hero, options.size)
    if (!spawnCells.length) return false

    const owner = options.owner
    const portal = this.findPortal()
    const raid: TributeRaid = {
      id: `${options.kind}-raid-${Date.now()}-${Math.round((this.context.map.random?.() ?? Math.random()) * 100000)}`,
      kind: options.kind,
      faction: options.faction ?? null,
      chief: null as unknown as TributeRaidUnit,
      units: [],
      phase: 'approaching',
      portal,
      tribute: options.tribute,
      modal: null,
      updateTaskId: null,
    }

    const unitTypes = this.getRaidUnitTypes(spawnCells.length, options.kind)
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
      }) as TributeRaidUnit | undefined
      if (!unit) continue
      unit.tributeRaidId = raid.id
      raid.units.push(unit)
      if (unit.type === UNIT_TYPES.banditChief || unit.type === UNIT_TYPES.chief) raid.chief = unit
    }

    if (!raid.units.length || !raid.chief) return false
    setUnitOverheadIndicator(raid.chief, 'exclamation')
    this.raids.push(raid)
    this.sendRaidToHero(raid, { forceRepath: true })
    this.startRaidUpdates(raid)
    this.context.menu?.showMessage(getIncomingRaidMessage(raid), 'warning')
    if (this.context.menu?.isMiniMapActive?.() !== false) {
      this.context.menu?.updatePlayerMiniMapEvt?.(owner)
    }
    return true
  }

  canStartRaid(): boolean {
    return !this.raids.some(raid => livingRaidUnits(raid).length > 0)
  }

  getOrCreateBanditOwner(): TributeRaidOwner {
    const existing = this.context.players.find(isRaidBanditOwner)
    if (existing) {
      existing.diplomacy = 'neutral'
      return existing
    }

    const owner = this.createTemporaryRaidOwner({
      civ: this.context.player?.civ ?? 'Greek',
      name: BANDIT_OWNER_NAME,
    })
    owner.banditRaidOwner = true
    return owner
  }

  getOrCreateFactionRaidOwner(faction: FactionSave): TributeRaidOwner {
    const existing = this.context.players.find(player => isRaidFactionOwner(player, faction.id))
    if (existing) {
      existing.diplomacy = 'neutral'
      existing.factionId = null
      return existing
    }

    const owner = this.createTemporaryRaidOwner({
      civ: faction.civilization ?? this.context.player?.civ ?? 'Greek',
      factionId: null,
      name: faction.name,
    })
    owner.factionRaidOwner = true
    owner.factionRaidFactionId = faction.id
    return owner
  }

  createTemporaryRaidOwner(options: { civ: string; factionId?: string | null; name: string }): TributeRaidOwner {
    const owner = new Player(
      {
        name: options.name,
        type: PLAYER_TYPES.ai,
        isPlayed: false,
        color: 'red',
        civ: options.civ,
        gender: 'male',
        team: null,
        diplomacy: 'neutral',
        factionId: options.factionId,
        populationMax: Number.POSITIVE_INFINITY,
        autoTechnologyByAge: false,
      },
      this.context
    ) as TributeRaidOwner
    owner.selectedUnits = []
    owner.selectedUnit = null
    owner.selectedBuilding = null
    owner.selectedOther = null
    owner.hasBuilt = []
    this.context.players.push(owner)
    return owner
  }

  isBaseWorld(): boolean {
    const graph = this.context.getWorldGraph?.()
    const currentWorldId = this.context.getCurrentWorldId?.()
    return Boolean(graph?.rootWorldId && currentWorldId && graph.rootWorldId === currentWorldId)
  }

  findAngryKnownFaction(options: { ignoreBaseWorld?: boolean } = {}): FactionSave | null {
    if (!options.ignoreBaseWorld && !this.isBaseWorld()) return null
    const factions = Object.values(this.context.getCampaignFactions?.() ?? {})
    const angry = factions
      .filter(faction => faction.relationScore <= FACTION_RAID_MIN_HATE)
      .sort((a, b) => a.relationScore - b.relationScore)
    if (!angry.length) return null

    const worstScore = angry[0].relationScore
    const candidates = angry.filter(faction => faction.relationScore <= worstScore + 20)
    return candidates[Math.floor((this.context.map.random?.() ?? Math.random()) * candidates.length)] ?? angry[0]
  }

  getBanditRaidSize(): number {
    const player = this.context.player
    const day = this.context.dayNight?.state?.day ?? 1
    const ageBonus = Math.max(0, player?.age ?? 0)
    return Math.max(2, Math.min(7, 2 + ageBonus + Math.floor(day / 5)))
  }

  getFactionRaidSize(faction: FactionSave): number {
    const player = this.context.player
    const militaryCount = this.getLivingPlayerMilitaryCount()
    const hateBonus = Math.max(0, Math.floor(Math.abs(Math.min(0, faction.relationScore)) / 25))
    const ageBonus = Math.max(0, player?.age ?? 0)
    const randomBonus = Math.floor((this.context.map.random?.() ?? Math.random()) * 3)
    return Math.max(2, Math.min(9, 2 + Math.floor(militaryCount / 2) + hateBonus + ageBonus + randomBonus))
  }

  getRaidUnitTypes(count: number, kind: TributeRaidKind = 'bandit'): string[] {
    return getRaidUnitTypes(count, kind, this.context.player?.age ?? 0)
  }

  getBanditTributeCost(): ResourceAmount {
    const day = this.context.dayNight?.state?.day ?? 1
    const age = this.context.player?.age ?? 0
    return {
      food: 40 + day * 5 + age * 20,
      gold: 25 + day * 4 + age * 15,
    }
  }

  getFactionTributeCost(faction: FactionSave): ResourceAmount {
    const player = this.context.player
    const day = this.context.dayNight?.state?.day ?? 1
    const age = player?.age ?? 0
    const hate = Math.max(0, Math.abs(Math.min(0, faction.relationScore)))
    const soldiers = this.getLivingPlayerMilitaryCount()
    return {
      food: 45 + day * 4 + age * 20 + soldiers * 8 + Math.floor(hate * 0.8),
      gold: 25 + day * 3 + age * 18 + soldiers * 5 + Math.floor(hate * 0.6),
    }
  }

  getLivingPlayerMilitaryCount(): number {
    return (this.context.player?.units ?? []).filter(
      unit => !unit.isDead && !unit.isDestroyed && unit.type !== UNIT_TYPES.villager && unit.type !== UNIT_TYPES.hero
    ).length
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
    for (let distance = RAID_SPAWN_MIN_RADIUS; distance <= RAID_SPAWN_MAX_RADIUS; distance++) {
      const ring = getCellsAroundPoint(anchor.i, anchor.j, grid, distance, isOpenRaidLandCell)
      ring.sort(() => (this.context.map.random?.() ?? Math.random()) - 0.5)
      for (const cell of ring) {
        if (cells.includes(cell)) continue
        if (portal && getRaidCellDistance(cell, hero) < 8) continue
        cells.push(cell)
        if (cells.length >= count) return cells
      }
    }
    const fallback = getFreeLandCellAroundInstance(hero, grid)
    if (fallback) cells.push(fallback)
    return cells
  }

  startRaidUpdates(raid: TributeRaid): void {
    raid.updateTaskId = this.context.scheduler.add(() => this.updateRaid(raid), RAID_UPDATE_MS, 'tributeRaid.update')
  }

  updateRaid(raid: TributeRaid): void {
    const hero = this.context.controls?.heroUnit
    const units = livingRaidUnits(raid)
    if (!hero || !units.length || hero.isDead || hero.isDestroyed) {
      this.cleanupRaid(raid)
      return
    }

    if (raid.phase === 'approaching') {
      if (getRaidCellDistance(raid.chief, hero) <= RAID_APPROACH_RANGE) {
        this.openTributeModal(raid)
        return
      }
      this.sendRaidToHero(raid)
      return
    }

    if (raid.phase === 'leaving') {
      const portal = raid.portal
      if (!portal || units.every(unit => getRaidCellDistance(unit, portal) <= RAID_RETURN_RANGE)) {
        this.despawnRaid(raid)
      }
    }
  }

  sendRaidToHero(raid: TributeRaid, options: { forceRepath?: boolean } = {}): void {
    const hero = this.context.controls?.heroUnit
    if (!hero) return
    for (const unit of livingRaidUnits(raid)) {
      unit.work = WORK_TYPES.attacker
      unit.action = null
      unit.sendToEvt?.(hero, null, options)
    }
  }

  sendRaidToPortal(raid: TributeRaid): void {
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

  openTributeModal(raid: TributeRaid): void {
    if (raid.phase !== 'approaching' || raid.modal) return
    raid.phase = 'parley'
    for (const unit of livingRaidUnits(raid)) unit.stop?.()

    let resolved = false
    const content = document.createElement('div')
    content.className = 'bandit-tribute-modal-content'
    content.appendChild(createTitledEntityInfoContent(this.context.app, raid.chief))

    const speech = document.createElement('p')
    speech.className = 'bandit-tribute-text portal-description'
    speech.textContent = getTributeDemand(raid)
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
      title: getTributeTitle(raid),
      content,
      panelClass: 'bandit-tribute-modal',
      onClose: () => {
        raid.modal = null
        if (!resolved && raid.phase === 'parley') this.makeRaidHostile(raid)
      },
    })
  }

  acceptTribute(raid: TributeRaid): void {
    raid.phase = 'leaving'
    setUnitOverheadIndicator(raid.chief, null)
    if (raid.kind === 'faction' && raid.faction)
      this.context.changeFactionRelation?.(raid.faction.id, 8, 'tribute-paid')
    this.context.menu?.showMessage(getTributePaidMessage(raid), 'success')
    this.sendRaidToPortal(raid)
  }

  makeRaidHostile(raid: TributeRaid): void {
    if (raid.phase === 'hostile') return
    raid.phase = 'hostile'
    if (raid.kind === 'faction' && raid.faction)
      this.context.changeFactionRelation?.(raid.faction.id, -8, 'tribute-refused')
    raid.modal?.close()
    raid.modal = null
    setUnitOverheadIndicator(raid.chief, null)
    const owner = raid.chief.owner
    if (owner) {
      owner.diplomacy = null
      if (raid.kind === 'faction' && raid.faction) owner.factionId = raid.faction.id
    }
    const hero = this.context.controls?.heroUnit
    if (hero) {
      for (const unit of livingRaidUnits(raid)) {
        unit.sendToEvt?.(hero, ACTION_TYPES.attack, { forceRepath: true })
      }
    }
    this.context.menu?.showMessage(getHostileRaidMessage(raid), 'warning')
  }

  despawnRaid(raid: TributeRaid): void {
    for (const unit of livingRaidUnits(raid)) {
      this.removeUnitFromRuntime(unit)
    }
    this.cleanupRaid(raid)
  }

  removeUnitFromRuntime(unit: TributeRaidUnit): void {
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
    fadeOut(unit, FADE_DURATION_MS, () => {
      unit.isDestroyed = true
      unit.context?.map?.removeChild(unit)
      unit.destroy?.({ children: true, texture: false })
    })
  }

  cleanupRaid(raid: TributeRaid): void {
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
