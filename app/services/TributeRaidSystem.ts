import { triggerScheduledFactionRaid } from './tribute/TributeRaidScheduling'
import { UNIT_TYPES, WORK_TYPES } from '../constants'
import { FACTION_SCORE } from '../lib/combat/factions'
import { setUnitOverheadIndicator } from '../lib/entities/overheadIndicator'
import type { ResourceAmount } from '../types/common'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { FactionSave } from '../types/save'
import { createTitledEntityInfoContent } from '../ui/EntityInfoContent'
import { createInspectionModal } from '../ui/InspectionPanel'
import type { DailyWorldEvent, DailyWorldEventHandler } from './DailyWorldEventSystem'
import { commitFactionRaidArmy, expeditionState, type FactionRaidArmy } from './tribute/FactionRaidEconomy'
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
  acceptTribute,
  cleanupRaid,
  despawnRaid,
  makeRaidHostile,
  restoreFactionExpeditions,
} from './tribute/TributeRaidLifecycle'
import { sendHostileRaidOrders, sendRaidToTarget, updateRaid } from './tribute/TributeRaidOrders'
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
import {
  RAID_SPAWN_RETRY_MS,
  RAID_UPDATE_MS,
  getRaidUnitTypes,
  livingRaidUnits,
  type TributeRaid,
  type TributeRaidKind,
  type TributeRaidOwner,
  type TributeRaidUnit,
} from './tribute/TributeRaidRules'
import { handleDailyWorldEvent, triggerFactionRaid, triggerTutorialRaid } from './tribute/TributeRaidScheduling'
import { findTributeRaidSpawnCells, removeTributeRaidUnitFromRuntime } from './tribute/TributeRaidSpawning'
import { getDelayUntilFactionRaidWindowMs, isFactionRaidWindowOpen } from './tribute/TributeRaidWindow'
import { findRaidTarget, hasActiveBanditCampPresence } from './TributeRaidTargeting'
import { getIncomingRaidMessage } from './TributeRaidText'

type RaidCreationOptions = {
  scripted?: boolean
  army?: FactionRaidArmy
  faction?: FactionSave | null
  kind: TributeRaidKind
  owner: TributeRaidOwner
  size: number
  tribute: ResourceAmount
}

export class TributeRaidSystem implements DailyWorldEventHandler {
  context: GameContextLike
  deferredFactionRaidTaskId: SchedulerTaskId | null
  raids: TributeRaid[]
  lastScheduledDay: number
  private creationPending = false
  private spawnRetryTasks = new Map<string, SchedulerTaskId>()
  factionRaidPending = false
  destroyed = false

  constructor(context: GameContextLike) {
    this.context = context
    this.deferredFactionRaidTaskId = null
    this.raids = []
    this.lastScheduledDay = 0
    this.restoreFactionExpeditions()
  }

  interruptsSleep(): boolean {
    return this.creationPending || this.factionRaidPending || this.raids.some(raid => livingRaidUnits(raid).length > 0)
  }

  handleDailyWorldEvent({ day }: DailyWorldEvent): void {
    return handleDailyWorldEvent.call(this, { day })
  }

  triggerScheduledFactionRaid(day: number): void {
    return triggerScheduledFactionRaid.call(this, day)
  }

  scheduleFactionRaidAtWindow(day: number, delayMs: number): void {
    if (this.deferredFactionRaidTaskId != null) return
    this.deferredFactionRaidTaskId = this.context.scheduler.addOneShot(
      () => {
        this.deferredFactionRaidTaskId = null
        if (this.context.isTutorialActive?.()) return
        if (this.lastScheduledDay === day) return
        if (!this.isFactionRaidWindowOpen()) return
        void this.triggerFactionRaid({ source: 'schedule' }).then(started => {
          if (started) this.lastScheduledDay = day
        })
      },
      delayMs,
      'tributeRaid.factionWindow',
      { interruptSleep: true }
    )
  }

  getDelayUntilFactionRaidWindowMs(): number | null {
    return getDelayUntilFactionRaidWindowMs.call(this)
  }

  isFactionRaidWindowOpen(): boolean {
    return isFactionRaidWindowOpen.call(this)
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
    return triggerFactionRaid.call(this, options)
  }

  async triggerTutorialRaid(): Promise<boolean> {
    return triggerTutorialRaid.call(this)
  }

  async createRaid(options: RaidCreationOptions): Promise<boolean> {
    if (this.destroyed || this.creationPending) return false
    this.creationPending = true
    try {
      return await this.prepareRaid(options)
    } finally {
      this.creationPending = false
    }
  }

  private deferSpawn({ kind, scripted }: Pick<RaidCreationOptions, 'kind' | 'scripted'>): void {
    const options = { kind, scripted }
    const key = options.scripted ? 'tutorial' : options.kind
    if (this.destroyed || this.spawnRetryTasks.has(key)) return
    const task = this.context.scheduler.addOneShot(
      () => {
        this.spawnRetryTasks.delete(key)
        if (this.destroyed) return
        if (Boolean(options.scripted) !== Boolean(this.context.isTutorialActive?.())) return
        if (
          !this.canStartRaid() ||
          this.creationPending ||
          (options.kind === 'faction' && !options.scripted && !this.isFactionRaidWindowOpen())
        ) {
          this.deferSpawn(options)
          return
        }
        // Re-evaluate eligibility and recruit from current faction state, never keep a stale army snapshot.
        const attempt = options.scripted
          ? this.triggerTutorialRaid()
          : options.kind === 'bandit'
            ? this.triggerRaid({ source: 'schedule' })
            : this.triggerFactionRaid({ source: 'schedule' })
        void attempt.catch(error => console.error('Unable to retry tribute raid', error))
      },
      RAID_SPAWN_RETRY_MS,
      'tributeRaid.spawnRetry'
    )
    this.spawnRetryTasks.set(key, task)
  }

  private async prepareRaid(options: RaidCreationOptions): Promise<boolean> {
    if (options.kind === 'faction' && !options.army && !options.scripted) return false
    if (options.kind === 'faction' && !options.scripted && !this.isFactionRaidWindowOpen()) return false
    if (!this.canStartRaid()) return false
    const initialTarget = findRaidTarget(this.context, options.kind)
    if (!initialTarget) return false
    if ((initialTarget.spaceId ?? 'outside') !== 'outside' || this.context.map.mapType === 'interior') {
      this.deferSpawn(options)
      return false
    }
    const owner = options.owner
    const map = this.context.map
    await this.preloadRaidOwnerAssets(owner)
    if (this.destroyed || this.context.map !== map) return false
    if (options.kind === 'faction' && !options.scripted && !this.isFactionRaidWindowOpen()) {
      this.deferSpawn(options)
      return false
    }
    if (!this.canStartRaid()) return false
    // The hero/camera and occupancy may have changed during asset loading.
    const target = findRaidTarget(this.context, options.kind)
    if (!target) return false
    if ((target.spaceId ?? 'outside') !== 'outside') {
      this.deferSpawn(options)
      return false
    }
    const spawnCells = this.findSpawnCells(target, options.size, options.faction)
    if (spawnCells.length !== options.size) {
      this.deferSpawn(options)
      return false
    }
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

    this.populateRaid(raid, owner, spawnCells, options.kind, options.army)

    if (
      !raid.units.length ||
      !raid.chief ||
      (options.army &&
        (raid.units.length !== options.army.units.length || !commitFactionRaidArmy(this.context, options.army)))
    ) {
      for (const unit of raid.units) this.removeUnitFromRuntime(unit)
      return false
    }
    const retryKey = options.scripted ? 'tutorial' : options.kind
    const retryTask = this.spawnRetryTasks.get(retryKey)
    if (retryTask != null) this.context.scheduler.remove(retryTask)
    this.spawnRetryTasks.delete(retryKey)
    if (!options.scripted) setUnitOverheadIndicator(raid.chief, 'exclamation')
    this.raids.push(raid)
    if (options.scripted) this.makeRaidHostile(raid)
    else {
      this.sendRaidToTarget(raid, { forceRepath: true })
      this.context.menu?.showMessage(getIncomingRaidMessage(raid), 'warning')
    }
    this.startRaidUpdates(raid)
    if (this.context.menu?.isMiniMapActive?.() !== false) {
      this.context.menu?.updatePlayerMiniMapEvt?.(owner)
    }
    return true
  }

  private populateRaid(
    raid: TributeRaid,
    owner: TributeRaidOwner,
    spawnCells: ReturnType<TributeRaidSystem['findSpawnCells']>,
    kind: TributeRaidKind,
    army?: FactionRaidArmy
  ): void {
    const unitTypes = army
      ? army.units.slice(0, spawnCells.length).map(unit => unit.type)
      : this.getRaidUnitTypes(spawnCells.length, kind)
    for (let index = 0; index < unitTypes.length; index++) {
      const cell = spawnCells[index]
      let unit: TributeRaidUnit | undefined
      try {
        unit = owner.createUnit?.({
          ...(army
            ? {
                ...army.units[index],
                x: undefined,
                y: undefined,
                z: undefined,
                spaceId: undefined,
                action: null,
                dest: null,
                path: [],
                realDest: null,
                previousDest: null,
                inactif: true,
                autonomousJob: null,
                work: WORK_TYPES.attacker,
              }
            : {}),
          i: cell.i,
          j: cell.j,
          type: unitTypes[index],
          gender: army?.units[index].gender ?? 'male',
          appearanceVariants: army?.units[index].appearanceVariants ?? { gender: 'male' },
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
      if (army && raid.faction)
        unit.factionExpedition = expeditionState(army, army.units[index], raid.id, raid.faction.id, raid.tribute)
      raid.units.push(unit)
      if ((army && !raid.chief) || unit.type === UNIT_TYPES.banditChief || unit.type === UNIT_TYPES.chief)
        raid.chief = unit
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
    return updateRaid.call(this, raid)
  }

  sendHostileRaidOrders(raid: TributeRaid): void {
    return sendHostileRaidOrders.call(this, raid)
  }

  sendRaidToTarget(raid: TributeRaid, options: { forceRepath?: boolean } = {}): void {
    return sendRaidToTarget.call(this, raid, options)
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
    return acceptTribute.call(this, raid)
  }

  makeRaidHostile(raid: TributeRaid): void {
    return makeRaidHostile.call(this, raid)
  }

  despawnRaid(raid: TributeRaid): void {
    return despawnRaid.call(this, raid)
  }

  restoreFactionExpeditions(): void {
    return restoreFactionExpeditions.call(this)
  }

  removeUnitFromRuntime(unit: TributeRaidUnit): void {
    removeTributeRaidUnitFromRuntime(unit)
  }

  cleanupRaid(raid: TributeRaid): void {
    return cleanupRaid.call(this, raid)
  }

  destroy(): void {
    this.destroyed = true
    for (const task of this.spawnRetryTasks.values()) this.context.scheduler.remove(task)
    this.spawnRetryTasks.clear()
    if (this.deferredFactionRaidTaskId != null) {
      this.context.scheduler.remove(this.deferredFactionRaidTaskId)
      this.deferredFactionRaidTaskId = null
    }
    for (const raid of [...this.raids]) this.cleanupRaid(raid)
  }
}
