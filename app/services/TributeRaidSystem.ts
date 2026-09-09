import { createTitledEntityInfoContent } from '../ui/EntityInfoModalManager'
import { createInspectionModal } from '../ui/InspectionPanel'
import { DAY_NIGHT_CONFIG } from '../config/gameplay'
import { ACTION_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import { FACTION_SCORE } from '../lib/combat/factions'
import { setUnitOverheadIndicator } from '../lib/entities/overheadIndicator'
import type { ResourceAmount } from '../types/common'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { FactionSave } from '../types/save'
import type { DailyWorldEvent, DailyWorldEventHandler } from './DailyWorldEventSystem'
import {
  BANDIT_RAID_FIRST_DAY,
  BANDIT_RAID_INTERVAL_DAYS,
  FACTION_RAID_FIRST_DAY,
  FACTION_RAID_INTERVAL_DAYS,
  FACTION_RAID_START_HOUR,
  RAID_APPROACH_RANGE,
  RAID_UPDATE_MS,
  getRaidCellDistance,
  getRaidUnitTypes,
  isFactionRaidHourAllowed,
  livingRaidUnits,
  type TributeRaid,
  type TributeRaidKind,
  type TributeRaidOwner,
  type TributeRaidUnit,
} from './TributeRaidRules'
import { findRaidTarget, hasActiveBanditCampPresence } from './TributeRaidTargeting'
import { getHostileRaidMessage, getIncomingRaidMessage, getTributePaidMessage } from './TributeRaidText'
import {
  findAngryKnownFaction as runFindAngryKnownFaction,
  getBanditRaidSize as runGetBanditRaidSize,
  getBanditTributeCost as runGetBanditTributeCost,
  getFactionRaidSize as runGetFactionRaidSize,
  getFactionTributeCost as runGetFactionTributeCost,
  getLivingPlayerMilitaryCount as runGetLivingPlayerMilitaryCount,
  isBaseWorld as runIsBaseWorld,
} from './tribute/TributeRaidBalance'
import {
  createTemporaryRaidOwner as runCreateTemporaryRaidOwner,
  getOrCreateBanditOwner as runGetOrCreateBanditOwner,
  getOrCreateFactionRaidOwner as runGetOrCreateFactionRaidOwner,
  preloadRaidOwnerAssets as runPreloadRaidOwnerAssets,
} from './tribute/TributeRaidOwners'
import {
  openTributeModal as runOpenTributeModal,
  resolveTributeParley as runResolveTributeParley,
  shouldLocalChiefPayTribute as runShouldLocalChiefPayTribute,
} from './tribute/TributeRaidParley'
import { findTributeRaidSpawnCells, removeTributeRaidUnitFromRuntime } from './tribute/TributeRaidSpawning'

export class TributeRaidSystem implements DailyWorldEventHandler {
  context: GameContextLike
  deferredFactionRaidTaskId: SchedulerTaskId | null
  raids: TributeRaid[]
  lastScheduledDay: number

  constructor(context: GameContextLike) {
    this.context = context
    this.deferredFactionRaidTaskId = null
    this.raids = []
    this.lastScheduledDay = 0
  }

  handleDailyWorldEvent({ day }: DailyWorldEvent): void {
    const shouldTryFactionRaid =
      day >= FACTION_RAID_FIRST_DAY &&
      (day - FACTION_RAID_FIRST_DAY) % FACTION_RAID_INTERVAL_DAYS === 0 &&
      this.lastScheduledDay !== day

    if (shouldTryFactionRaid) {
      this.triggerScheduledFactionRaid(day)
      return
    }

    if (day < BANDIT_RAID_FIRST_DAY) return
    if ((day - BANDIT_RAID_FIRST_DAY) % BANDIT_RAID_INTERVAL_DAYS !== 0) return
    if (this.lastScheduledDay === day) return
    this.lastScheduledDay = day
    void this.triggerRaid({ source: 'schedule' })
  }

  triggerScheduledFactionRaid(day: number): void {
    const delayMs = this.getDelayUntilFactionRaidWindowMs()
    if (delayMs == null) return
    if (delayMs > 0) {
      this.scheduleFactionRaidAtWindow(day, delayMs)
      return
    }
    void this.triggerFactionRaid({ source: 'schedule' }).then(started => {
      if (started) this.lastScheduledDay = day
    })
  }

  scheduleFactionRaidAtWindow(day: number, delayMs: number): void {
    if (this.deferredFactionRaidTaskId != null) return
    this.deferredFactionRaidTaskId = this.context.scheduler.addOneShot(
      () => {
        this.deferredFactionRaidTaskId = null
        if (this.lastScheduledDay === day) return
        if (!this.isFactionRaidWindowOpen()) return
        void this.triggerFactionRaid({ source: 'schedule' }).then(started => {
          if (started) this.lastScheduledDay = day
        })
      },
      delayMs,
      'tributeRaid.factionWindow'
    )
  }

  getDelayUntilFactionRaidWindowMs(): number | null {
    const state = this.context.dayNight?.state
    if (!state) return 0
    const time = state.hour + state.minute / 60
    if (isFactionRaidHourAllowed(state.hour, state.minute)) return 0
    if (time >= FACTION_RAID_START_HOUR) return null
    return ((FACTION_RAID_START_HOUR - time) / DAY_NIGHT_CONFIG.hoursPerDay) * DAY_NIGHT_CONFIG.dayLengthMs
  }

  isFactionRaidWindowOpen(): boolean {
    const state = this.context.dayNight?.state
    return !state || isFactionRaidHourAllowed(state.hour, state.minute)
  }

  async triggerRaid(_options: { source?: 'schedule' | 'dev-console' } = {}): Promise<boolean> {
    if (!this.canStartRaid()) return false
    if (hasActiveBanditCampPresence(this.context)) return false
    return this.createRaid({
      kind: 'bandit',
      owner: this.getOrCreateBanditOwner(),
      size: this.getBanditRaidSize(),
      tribute: this.getBanditTributeCost(),
    })
  }

  async triggerFactionRaid(
    options: { ignoreBaseWorld?: boolean; source?: 'schedule' | 'dev-console' } = {}
  ): Promise<boolean> {
    if (!this.isFactionRaidWindowOpen()) return false
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

  async createRaid(options: {
    faction?: FactionSave | null
    kind: TributeRaidKind
    owner: TributeRaidOwner
    size: number
    tribute: ResourceAmount
  }): Promise<boolean> {
    if (options.kind === 'faction' && !this.isFactionRaidWindowOpen()) return false
    if (!this.canStartRaid()) return false
    const target = findRaidTarget(this.context, options.kind)
    if (!target) return false
    const spawnCells = this.findSpawnCells(target, options.size, options.faction)
    if (!spawnCells.length) return false

    const owner = options.owner
    await this.preloadRaidOwnerAssets(owner)
    if (options.kind === 'faction' && !this.isFactionRaidWindowOpen()) return false
    if (!this.canStartRaid()) return false
    const raid: TributeRaid = {
      id: `${options.kind}-raid-${Date.now()}-${Math.round((this.context.map.random?.() ?? Math.random()) * 100000)}`,
      kind: options.kind,
      faction: options.faction ?? null,
      chief: null as unknown as TributeRaidUnit,
      target,
      units: [],
      phase: 'approaching',
      tribute: options.tribute,
      modal: null,
      updateTaskId: null,
    }

    this.populateRaid(raid, owner, spawnCells, options.kind)

    if (!raid.units.length || !raid.chief) {
      for (const unit of raid.units) this.removeUnitFromRuntime(unit)
      return false
    }
    setUnitOverheadIndicator(raid.chief, 'exclamation')
    this.raids.push(raid)
    this.sendRaidToTarget(raid, { forceRepath: true })
    this.startRaidUpdates(raid)
    this.context.menu?.showMessage(getIncomingRaidMessage(raid), 'warning')
    if (this.context.menu?.isMiniMapActive?.() !== false) {
      this.context.menu?.updatePlayerMiniMapEvt?.(owner)
    }
    return true
  }

  private populateRaid(
    raid: TributeRaid,
    owner: TributeRaidOwner,
    spawnCells: ReturnType<TributeRaidSystem['findSpawnCells']>,
    kind: TributeRaidKind
  ): void {
    const unitTypes = this.getRaidUnitTypes(spawnCells.length, kind)
    for (let index = 0; index < unitTypes.length; index++) {
      const cell = spawnCells[index]
      let unit: TributeRaidUnit | undefined
      try {
        unit = owner.createUnit?.({
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
      } catch (error) {
        if (this.context.player?.isPlayed) {
          this.context.menu?.showMessage(`Unable to spawn a tribute raid unit (${unitTypes[index]}).`, 'warning')
        }
        console.error('Unable to spawn tribute raid unit', { type: unitTypes[index], error })
        unit = undefined
      }
      if (!unit) continue
      unit.tributeRaidId = raid.id
      raid.units.push(unit)
      if (unit.type === UNIT_TYPES.banditChief || unit.type === UNIT_TYPES.chief) raid.chief = unit
    }
  }

  canStartRaid(): boolean {
    return !this.raids.some(raid => livingRaidUnits(raid).length > 0)
  }

  getOrCreateBanditOwner(): TributeRaidOwner {
    return runGetOrCreateBanditOwner(this)
  }

  getOrCreateFactionRaidOwner(faction: FactionSave): TributeRaidOwner {
    return runGetOrCreateFactionRaidOwner(this, faction)
  }

  async preloadRaidOwnerAssets(owner: TributeRaidOwner): Promise<void> {
    return runPreloadRaidOwnerAssets(this, owner)
  }

  createTemporaryRaidOwner(options: {
    civ: string
    color?: string | null
    factionId?: string | null
    name: string
  }): TributeRaidOwner {
    return runCreateTemporaryRaidOwner(this, options)
  }

  isBaseWorld(): boolean {
    return runIsBaseWorld(this)
  }

  findAngryKnownFaction(options: { ignoreBaseWorld?: boolean } = {}): FactionSave | null {
    return runFindAngryKnownFaction(this, options)
  }

  getBanditRaidSize(): number {
    return runGetBanditRaidSize(this)
  }

  getFactionRaidSize(faction: FactionSave): number {
    return runGetFactionRaidSize(this, faction)
  }

  getRaidUnitTypes(count: number, kind: TributeRaidKind = 'bandit'): string[] {
    return getRaidUnitTypes(count, kind, this.context.player?.age ?? 0)
  }

  getBanditTributeCost(): ResourceAmount {
    return runGetBanditTributeCost(this)
  }

  getFactionTributeCost(faction: FactionSave): ResourceAmount {
    return runGetFactionTributeCost(this, faction)
  }

  getLivingPlayerMilitaryCount(): number {
    return runGetLivingPlayerMilitaryCount(this)
  }

  findSpawnCells(target: UnitEntity, count: number, faction?: FactionSave | null): RuntimeCell[] {
    return findTributeRaidSpawnCells(this.context, target, count, { faction })
  }

  makeFactionRaidRelationHostile(raid: TributeRaid): void {
    if (raid.kind !== 'faction' || !raid.faction) return
    const deltaToHostile = FACTION_SCORE.hostile - raid.faction.relationScore
    this.context.changeFactionRelation?.(raid.faction.id, Math.min(-8, deltaToHostile), 'tribute-refused')
  }

  startRaidUpdates(raid: TributeRaid): void {
    raid.updateTaskId = this.context.scheduler.add(() => this.updateRaid(raid), RAID_UPDATE_MS, 'tributeRaid.update')
  }

  updateRaid(raid: TributeRaid): void {
    const units = livingRaidUnits(raid)
    const target = raid.target
    if (!target || !units.length || target.isDead || target.isDestroyed) {
      this.cleanupRaid(raid)
      return
    }

    if (raid.phase === 'approaching') {
      if (getRaidCellDistance(raid.chief, target) <= RAID_APPROACH_RANGE) {
        this.resolveTributeParley(raid)
        return
      }
      this.sendRaidToTarget(raid)
      return
    }

    if (raid.phase === 'leaving') {
      this.despawnRaid(raid)
    }
  }

  sendRaidToTarget(raid: TributeRaid, options: { forceRepath?: boolean } = {}): void {
    const target = raid.target
    if (!target) return
    for (const unit of livingRaidUnits(raid)) {
      unit.work = WORK_TYPES.attacker
      unit.action = null
      unit.sendToEvt?.(target, null, options)
    }
  }

  openTributeModal(raid: TributeRaid): void {
    return runOpenTributeModal(this, raid, {
      createChiefContent: chief => createTitledEntityInfoContent(this.context.app, chief),
      createModal: createInspectionModal,
    })
  }

  resolveTributeParley(raid: TributeRaid): void {
    return runResolveTributeParley(this, raid)
  }

  shouldLocalChiefPayTribute(raid: TributeRaid): boolean {
    return runShouldLocalChiefPayTribute(this, raid)
  }

  acceptTribute(raid: TributeRaid): void {
    raid.phase = 'leaving'
    setUnitOverheadIndicator(raid.chief, null)
    if (raid.kind === 'faction' && raid.faction)
      this.context.changeFactionRelation?.(raid.faction.id, 8, 'tribute-paid')
    this.context.menu?.showMessage(getTributePaidMessage(raid), 'success')
    this.despawnRaid(raid)
  }

  makeRaidHostile(raid: TributeRaid): void {
    if (raid.phase === 'hostile') return
    raid.phase = 'hostile'
    this.makeFactionRaidRelationHostile(raid)
    raid.modal?.close()
    raid.modal = null
    setUnitOverheadIndicator(raid.chief, null)
    const owner = raid.chief.owner
    if (owner) {
      owner.diplomacy = null
      if (raid.kind === 'faction' && raid.faction) owner.factionId = raid.faction.id
    }
    const target = raid.target
    if (target) {
      for (const unit of livingRaidUnits(raid)) {
        unit.sendToEvt?.(target, ACTION_TYPES.attack, { forceRepath: true })
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
    removeTributeRaidUnitFromRuntime(unit)
  }

  cleanupRaid(raid: TributeRaid): void {
    if (raid.phase === 'parley') raid.phase = 'leaving'
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
    if (this.deferredFactionRaidTaskId != null) {
      this.context.scheduler.remove(this.deferredFactionRaidTaskId)
      this.deferredFactionRaidTaskId = null
    }
    for (const raid of [...this.raids]) this.cleanupRaid(raid)
  }
}
