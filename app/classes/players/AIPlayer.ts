import { isStaticSettlement } from '../../config/settlementProfiles'
import { traceRuntime } from '../../lib/runtimeDiagnostics'
import { hasInteriorCombatRoute } from '../../lib/units/interiorCombat'
import { isDistantOwner } from '../../lib/units/villageActivity'
import { handleInteriorTheftDefense, isInteriorTheftDefender } from '../../ai/AITheftDefense'
import { Player } from './Player'
import { villageResources, villageAnimals } from '../../services/world/VillageResourceKnowledge'
import { knowsEconomicTarget, knownTarget } from '../../lib/units/playerTargetKnowledge'
import type { PlayerOptions } from './Player'

import { isPlayerEliminated, transferDefeatedPlayerBuildings } from '../../lib'
import { ACTION_TYPES, PLAYER_TYPES, UNIT_TYPES, BUILDING_TYPES, RESOURCE_TYPES } from '../../constants'
import { AIStrategy } from '../../ai/AIStrategy'
import { AI_ABSTRACT_DAILY_RECRUITS } from '../../ai/config'
import { AIEconomy } from '../../ai/AIEconomy'
import { AIThreatManager, type EnemyMemory, type StoredThreat, type ThreatProfile } from '../../ai/AIThreatManager'
import { classifyMilitaryUnits, isAliveUnit } from '../../ai/unitGroups'
import { updateChiefEscorts } from '../../ai/AIChiefEscort'
import { isChiefEscort } from '../../lib/units/chiefEscort'
import { isChiefUnit, isLivingChief } from '../../lib/chief'
import {
  cleanupAITrackingSets,
  getApproachableHeroNearChiefAnchor,
  handleAIChiefGuard,
  handleAIVisibleEnemyDefense,
  refreshAIChiefSuccession,
  type AIVillageDefenseResult,
} from './AIPlayerBehavior'
import type {
  AIBuildingLike,
  AIEntityLike,
  AIStrategyPlayerLike,
  AIStrategySnapshot,
  AIVillagerActionOptions,
  EnemyMemoryOptions,
} from '../../ai/types'
import type { GameContextLike, SchedulerTaskId } from '../../types/context'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'

type StrategySnapshotState = {
  map: AIStrategySnapshot['map']
  villagers: AIStrategySnapshot['villagers']
  maxVillagers: AIStrategySnapshot['maxVillagers']
  infantry: AIStrategySnapshot['infantry']
  maxInfantry: AIStrategySnapshot['maxInfantry']
  infantryUnit: AIStrategySnapshot['infantryUnit']
  archers: AIStrategySnapshot['archers']
  maxArcher: AIStrategySnapshot['maxArcher']
  archerUnit: AIStrategySnapshot['archerUnit']
  cavalry: AIStrategySnapshot['cavalry']
  maxCavalry: AIStrategySnapshot['maxCavalry']
}

type AIStepLimits = Omit<StrategySnapshotState, 'map' | 'villagers' | 'infantry' | 'archers' | 'cavalry'>
type AIStepForces = Pick<StrategySnapshotState, 'villagers' | 'infantry' | 'archers' | 'cavalry'> & {
  military: AIEntityLike[]
}
type AIStepBuildings = Pick<AIVillagerActionOptions, 'towncenters' | 'storagepits' | 'farms' | 'notBuiltBuildings'>

const DEBUG = false

export class AI extends Player {
  foundedTrees!: Set<RuntimeEntity>
  foundedBerrybushs!: Set<RuntimeEntity>
  foundedWheats!: Set<RuntimeEntity>
  foundedGolds!: Set<RuntimeEntity>
  foundedStones!: Set<RuntimeEntity>
  foundedCoppers!: Set<RuntimeEntity>
  foundedIrons!: Set<RuntimeEntity>
  foundedResources!: Record<string, Set<RuntimeEntity>>
  foundedAnimals!: Set<RuntimeEntity>
  foundedDeadAnimals!: Set<RuntimeEntity>
  foundedEnemyBuildings!: Set<RuntimeEntity>
  foundedEnemyUnits!: Set<RuntimeEntity>
  enemyUnitMemory!: Map<string, EnemyMemory>
  enemyBuildingMemory!: Map<string, EnemyMemory>
  difficulty!: string
  strategy!: AIStrategy
  economy!: AIEconomy
  stepDelay!: number
  scout!: AIEntityLike | null
  phase!: AIStrategyPlayerLike['phase']
  threatenedTargets!: Map<string, StoredThreat>
  threatManager!: AIThreatManager
  difficultyConfig!: AIStrategyPlayerLike['difficultyConfig']
  chiefLossDetectedAt!: number | null
  chiefWanderReadyAt!: Map<string, number>
  maxVillagers!: AIStrategyPlayerLike['maxVillagers']
  maxBuildings!: AIStrategyPlayerLike['maxBuildings']
  maxInfantry!: AIStrategyPlayerLike['maxInfantry']
  maxArchers!: AIStrategyPlayerLike['maxArchers']
  maxCavalry!: AIStrategyPlayerLike['maxCavalry']
  _stepTaskId!: SchedulerTaskId | null
  private _chiefEscortTaskId?: SchedulerTaskId | null

  constructor({ ...props }: PlayerOptions, context: GameContextLike) {
    super({ ...props, isPlayed: false, type: props.type ?? PLAYER_TYPES.ai }, context)
    this.foundedTrees = new Set()
    this.foundedBerrybushs = new Set()
    this.foundedWheats = new Set()
    this.foundedGolds = new Set()
    this.foundedStones = new Set()
    this.foundedCoppers = new Set()
    this.foundedIrons = new Set()
    this.foundedResources = {
      [RESOURCE_TYPES.fiberPlant]: new Set(),
      [RESOURCE_TYPES.tree]: this.foundedTrees,
      [RESOURCE_TYPES.berrybush]: this.foundedBerrybushs,
      [RESOURCE_TYPES.wheat]: this.foundedWheats,
      [RESOURCE_TYPES.stone]: this.foundedStones,
      [RESOURCE_TYPES.gold]: this.foundedGolds,
      [RESOURCE_TYPES.copper]: this.foundedCoppers,
      [RESOURCE_TYPES.iron]: this.foundedIrons,
    }
    this.foundedAnimals = new Set()
    this.foundedDeadAnimals = new Set()
    this.foundedEnemyBuildings = new Set()
    this.foundedEnemyUnits = new Set()
    this.enemyUnitMemory = new Map()
    this.enemyBuildingMemory = new Map()
    this.difficulty = (props.difficulty as string) || 'medium'
    this.strategy = new AIStrategy(this, this.difficulty)
    this.economy = new AIEconomy(this)
    this.strategy.applyConfig(this)
    this.stepDelay = this.difficultyConfig.stepDelayBase
    this._scheduleStep()
    this.selectedUnits = []
    this.selectedUnit = null
    this.selectedBuilding = null
    this.selectedOther = null
    this.scout = null
    this.phase = 'economy'
    this.threatenedTargets = new Map()
    this.threatManager = new AIThreatManager(this)
    this.chiefLossDetectedAt = null
    this.chiefWanderReadyAt = new Map()
  }

  getNow() {
    return this.context.scheduler?.elapsedMs || 0
  }

  rememberEnemy(enemy: AIEntityLike) {
    this.threatManager.rememberEnemy(enemy)
  }

  _refreshEnemyMemory(memoryMap: Map<string, EnemyMemory>) {
    this.threatManager.refreshEnemyMemory(memoryMap)
  }

  getEnemyMemories({ family = null, freshWithin = Infinity, visibleOnly = false }: EnemyMemoryOptions = {}) {
    return this.threatManager.getEnemyMemories({ family, freshWithin, visibleOnly })
  }

  getFreshEnemyInstances(options = {}) {
    return this.threatManager.getFreshEnemyInstances(options)
  }

  override reportThreat(target: RuntimeEntity, attacker: RuntimeEntity) {
    this.threatManager.reportThreat(target, attacker)

    if (this._stepTaskId && this.stepDelay !== this.difficultyConfig.stepDelayBase) {
      this.stepDelay = this.difficultyConfig.stepDelayBase
      this.context.scheduler.update(this._stepTaskId, this.stepDelay)
    }
  }

  cleanupThreats() {
    this.threatManager.cleanupThreats()
  }

  getVisibleHostilesNear(target: AIEntityLike, radius = 10): AIEntityLike[] {
    return this.threatManager.getVisibleHostilesNear(target, radius)
  }

  isBuildingThreatened(building: AIEntityLike) {
    return this.threatManager.isBuildingThreatened(building)
  }

  getActiveThreats() {
    return this.threatManager.getActiveThreats()
  }

  getHomeAnchor() {
    return this.threatManager.getHomeAnchor()
  }

  getThreatProfile(threat: StoredThreat & { hostiles: AIEntityLike[] }): ThreatProfile {
    return this.threatManager.getThreatProfile(threat)
  }

  getDefensePowerNeed(profile: ThreatProfile) {
    return this.threatManager.getDefensePowerNeed(profile)
  }

  handleThreatResponses({
    villagers,
    waitingMilitary,
    debug = false,
  }: {
    villagers: AIEntityLike[]
    waitingMilitary: AIEntityLike[]
    debug?: boolean
  }) {
    return this.threatManager.handleThreatResponses({ villagers, waitingMilitary, debug })
  }

  private measureAIStage<T>(stage: string, callback: () => T): T {
    const monitor = this.context.performance
    return traceRuntime(
      `ai.${stage}`,
      () => (monitor ? monitor.measure(`ai.${stage}`, callback) : callback()),
      { owner: this.label, civ: this.civ, units: this.units.length, buildings: this.buildings.length },
      `ai.${this.label}.${stage}`
    )
  }

  _scheduleStep() {
    this._chiefEscortTaskId = this.context.scheduler.add(
      () => {
        if (this.context.paused || this.context.map.ready === false || isDistantOwner(this)) return
        updateChiefEscorts(this.units, this.context)
      },
      750,
      'ai.chiefEscort',
      { stagger: true, maxRunsPerTick: 1 }
    )
    this._stepTaskId = this.context.scheduler.add(
      () => {
        const started = performance.now()
        const actions = this.context.performance?.measure('aiStep', () => this.step()) ?? this.step()
        const durationMs = performance.now() - started
        if (durationMs >= 16)
          this.context.performance?.markEvent?.('ai.slowStep', {
            civilization: this.civ ?? '',
            owner: this.label,
            durationMs: Math.round(durationMs * 10) / 10,
            units: this.units.length,
            buildings: this.buildings.length,
            actions,
          })
        const newDelay =
          actions > 0 ? this.difficultyConfig.stepDelayBase : Math.min(Math.round(this.stepDelay * 1.5), 5000)
        if (newDelay !== this.stepDelay) {
          this.stepDelay = newDelay
          if (this._stepTaskId != null) this.context.scheduler.update(this._stepTaskId, newDelay)
        }
      },
      this.stepDelay,
      'ai.step',
      { stagger: true, maxRunsPerTick: 1 }
    )
  }

  hasNotReachBuildingLimit(buildingType: string, buildings: AIEntityLike[]) {
    const currentBuildings = buildings || []
    return !this.maxBuildings[buildingType] || currentBuildings.length < this.maxBuildings[buildingType]
  }

  buildingsByTypes(types: string[]): AIBuildingLike[] {
    return this.buildings.filter(b => types.includes(b.type)) as AIBuildingLike[]
  }

  getStrategySnapshot(state: StrategySnapshotState): AIStrategySnapshot {
    return {
      map: state.map,
      otherPlayers: this.enemyPlayers(),
      villagers: state.villagers,
      maxVillagers: state.maxVillagers,
      towncenters: this.buildingsByTypes([BUILDING_TYPES.townCenter]),
      infantry: state.infantry,
      maxInfantry: state.maxInfantry,
      barracks: this.buildingsByTypes([BUILDING_TYPES.barracks]),
      infantryUnit: state.infantryUnit,
      archers: state.archers,
      maxArcher: state.maxArcher,
      archeryRanges: this.buildingsByTypes([BUILDING_TYPES.archeryRange]),
      archerUnit: state.archerUnit,
      cavalry: state.cavalry,
      maxCavalry: state.maxCavalry,
      stables: this.buildingsByTypes([BUILDING_TYPES.stable]),
      houses: this.buildingsByTypes([BUILDING_TYPES.house]),
      farms: [...this.foundedWheats],
      granarys: this.buildingsByTypes([BUILDING_TYPES.granary]),
      storagepits: this.buildingsByTypes([BUILDING_TYPES.storagePit]),
      markets: this.buildingsByTypes([BUILDING_TYPES.market]),
      watchTowers: this.buildingsByTypes([BUILDING_TYPES.watchTower]),
      temples: this.buildingsByTypes([BUILDING_TYPES.temple]),
    }
  }

  // Remove depleted resources and destroyed buildings from tracked Sets
  cleanupSets() {
    cleanupAITrackingSets(this)
  }

  getBestInfantryUnit() {
    return this.strategy.getBestInfantryUnit()
  }

  getBestArcherUnit() {
    return this.strategy.getBestArcherUnit()
  }

  getLivingUnitsByType(type: string): AIEntityLike[] {
    return this.units.filter(unit => unit.type === type && isAliveUnit(unit)) as AIEntityLike[]
  }

  getLivingChiefs(): AIEntityLike[] {
    return this.units.filter(unit => isLivingChief(unit)) as AIEntityLike[]
  }

  refreshChiefSuccession(villagers: AIEntityLike[]): number {
    return refreshAIChiefSuccession(this, villagers)
  }

  handleChiefGuard(towncenters: AIBuildingLike[]): number {
    return handleAIChiefGuard(this, towncenters)
  }

  handleVisibleEnemyDefense({
    villagers,
    military,
    towncenters,
  }: {
    villagers: AIEntityLike[]
    military: AIEntityLike[]
    towncenters: AIBuildingLike[]
  }) {
    return handleAIVisibleEnemyDefense(this, { villagers, military, towncenters })
  }

  getApproachableHeroNearChiefAnchor(anchor: AIBuildingLike): UnitEntity | null {
    return getApproachableHeroNearChiefAnchor(this, anchor)
  }

  step() {
    const { map, paused } = this.context
    if (paused || map.ready === false || isDistantOwner(this)) return 0
    this.measureAIStage('knowledge', () => this.refreshEconomicKnowledge())

    const limits = this.getStepLimits()
    if (DEBUG) {
      console.log('----Step started')
      console.log(
        `Wood: ${this.wood}, Food: ${this.food}, Stone: ${this.stone}, Gold: ${this.gold}, Population: ${this.population}/${this.populationMax}`
      )
    }

    const interiorTheftDefenseActive = this.measureAIStage('interiorDefense', () => handleInteriorTheftDefense(this))
    const allVillagers = this.getLivingUnitsByType(UNIT_TYPES.villager)
    let actions = this.refreshChiefSuccession(allVillagers)
    const forces = this.getStepForces(allVillagers, limits)
    this.updateStepPhase(forces.villagers.length)
    const buildings = this.getStepBuildings()
    const waitingMilitary = this.getWaitingMilitary(forces.military)

    // Player losing condition
    if (isPlayerEliminated(this)) {
      if (DEBUG) console.log('Player can no longer act. Dying...')
      transferDefeatedPlayerBuildings(this)
      this.die()
      return 0
    }

    // Remove depleted resources and destroyed enemies from tracked sets
    this.measureAIStage('cleanup', () => {
      this.cleanupSets()
      this.cleanupThreats()
    })

    const defense = this.runDefenseStages(forces, buildings.towncenters, waitingMilitary, interiorTheftDefenseActive)
    actions += defense.actions
    if (defense.active || isStaticSettlement(this)) return actions

    actions += this.runDevelopmentStages(map, limits, forces, buildings, waitingMilitary)

    if (DEBUG) console.log('----Step ended')
    return actions
  }

  private refreshEconomicKnowledge(): void {
    for (const resources of Object.values(this.foundedResources)) resources.clear()
    this.foundedAnimals.clear()
    this.foundedDeadAnimals.clear()
    for (const resource of [...villageResources(this, this.getNow()), ...villageAnimals(this)]) {
      if (resource.isDestroyed || !knowsEconomicTarget(this, resource)) continue
      knownTarget(this, resource)
      if (resource.family === 'resource') this.foundedResources[resource.type]?.add(resource)
      else if (resource.isDead) this.foundedDeadAnimals.add(resource)
      else this.foundedAnimals.add(resource)
    }
  }

  private getStepLimits(): AIStepLimits {
    return {
      maxVillagers: Math.floor(this.maxVillagers * this.difficultyConfig.popCapMultiplier),
      maxInfantry: this.maxInfantry,
      maxArcher: this.maxArchers,
      maxCavalry: this.maxCavalry,
      infantryUnit: this.getBestInfantryUnit(),
      archerUnit: this.getBestArcherUnit(),
    }
  }

  private classifyMilitary() {
    return classifyMilitaryUnits(this.units.filter(unit => !isChiefEscort(unit)) as AIEntityLike[])
  }

  private getStepForces(allVillagers: AIEntityLike[], limits: AIStepLimits): AIStepForces {
    const villagers = allVillagers.filter(
      villager => !isChiefUnit(villager) && !isInteriorTheftDefender(villager) && !hasInteriorCombatRoute(villager)
    )
    const { infantry, archers, cavalry } = this.classifyMilitary()
    const military = [...infantry, ...archers, ...cavalry]
    const militaryPower = this.strategy.military.getGroupCombatPower(military)

    if (DEBUG)
      console.log(
        `Villagers: ${villagers.length}/${limits.maxVillagers}, Fantassin: ${infantry.length}/${limits.maxInfantry} (${limits.infantryUnit}), Archers: ${archers.length}/${limits.maxArcher} (${limits.archerUnit}), Cavalry: ${cavalry.length}/${limits.maxCavalry}, Power: ${Math.round(militaryPower)}`
      )
    return { villagers, infantry, archers, cavalry, military }
  }

  private updateStepPhase(villagerCount: number): void {
    const previousPhase = this.phase
    this.strategy.updatePhase(villagerCount)
    if (DEBUG && previousPhase !== this.phase) console.log(`Phase: ${previousPhase} → ${this.phase}`)
    if (DEBUG) console.log(`Phase: ${this.phase}`)
  }

  private getStepBuildings(): AIStepBuildings {
    const towncenters = this.buildingsByTypes([
      BUILDING_TYPES.townCenter,
      ...(this.settlementType === 'outpost' ? ['FireCamp'] : []),
    ])
    const storagepits = this.buildingsByTypes([BUILDING_TYPES.storagePit])
    const houses = this.buildingsByTypes([BUILDING_TYPES.house])
    const granarys = this.buildingsByTypes([BUILDING_TYPES.granary])
    const barracks = this.buildingsByTypes([BUILDING_TYPES.barracks])
    const markets = this.buildingsByTypes([BUILDING_TYPES.market])
    const farms = [...this.foundedWheats]
    if (DEBUG)
      console.log(
        `Towncenters: ${towncenters.length}, Houses: ${houses.length}, StoragePits: ${storagepits.length}, Granaries: ${granarys.length}, Barracks: ${barracks.length}, Markets: ${markets.length}`
      )

    const notBuiltBuildings = (isStaticSettlement(this) ? [] : (this.buildings as AIBuildingLike[]))
      .filter(b => !b.isBuilt || ((b.hitPoints ?? 0) > 0 && (b.hitPoints ?? 0) < (b.totalHitPoints ?? 1)))
      .sort((a, b) => (a.type === BUILDING_TYPES.house ? -1 : b.type === BUILDING_TYPES.house ? 1 : 0))
    return { towncenters, storagepits, farms, notBuiltBuildings }
  }

  private getWaitingMilitary(military: AIEntityLike[]): AIEntityLike[] {
    const RETREAT_HP_RATIO = 0.3
    const waitingMilitary = military.filter(
      c =>
        c.inactif &&
        !hasInteriorCombatRoute(c) &&
        c.action !== ACTION_TYPES.attack &&
        (c.hitPoints ?? 0) >= (c.totalHitPoints ?? 1) * RETREAT_HP_RATIO
    )

    if (DEBUG) console.log(`Waiting Military: ${waitingMilitary.length}`)
    return waitingMilitary
  }

  private runDefenseStages(
    forces: AIStepForces,
    towncenters: AIBuildingLike[],
    waitingMilitary: AIEntityLike[],
    interiorTheftDefenseActive: boolean
  ): AIVillageDefenseResult {
    const visibleEnemyDefense = interiorTheftDefenseActive
      ? { active: false, actions: 0 }
      : this.measureAIStage('defense', () =>
          this.handleVisibleEnemyDefense({
            villagers: isStaticSettlement(this) ? [] : forces.villagers,
            military: forces.military,
            towncenters,
          })
        )
    if (visibleEnemyDefense.active) return visibleEnemyDefense

    let actions = visibleEnemyDefense.actions
    actions += this.measureAIStage('threats', () =>
      this.handleThreatResponses({
        villagers: isStaticSettlement(this) ? [] : forces.villagers,
        waitingMilitary,
        debug: DEBUG,
      })
    )
    actions += this.measureAIStage('chiefGuard', () => this.handleChiefGuard(towncenters))
    return { actions, active: false }
  }

  private runDevelopmentStages(
    map: StrategySnapshotState['map'],
    limits: AIStepLimits,
    forces: AIStepForces,
    buildings: AIStepBuildings,
    waitingMilitary: AIEntityLike[]
  ): number {
    const refreshedWaitingMilitary = waitingMilitary.filter(u => u.inactif && u.action !== ACTION_TYPES.attack)
    let actions = this.measureAIStage('economy', () =>
      this.economy.handleVillagerActions({
        villagers: forces.villagers,
        map,
        farms: buildings.farms,
        notBuiltBuildings: buildings.notBuiltBuildings,
        storagepits: buildings.storagepits,
        towncenters: buildings.towncenters,
        debug: DEBUG,
      })
    )

    actions += this.measureAIStage('military', () =>
      this.strategy.handleMilitaryActions({
        waitingMilitary: refreshedWaitingMilitary,
        debug: DEBUG,
      })
    )

    const strategySnapshot = this.measureAIStage('strategySnapshot', () =>
      this.getStrategySnapshot({
        map,
        villagers: forces.villagers,
        infantry: forces.infantry,
        archers: forces.archers,
        cavalry: forces.cavalry,
        ...limits,
      })
    )

    actions += this.measureAIStage('production', () => this.strategy.handleProductionActions(strategySnapshot, DEBUG))
    actions += this.measureAIStage('buildingPlacement', () =>
      this.strategy.handleBuildingActions(strategySnapshot, DEBUG)
    )
    return actions
  }

  /** Daily recruitment uses the live training system, which owns paid trainees. */
  planDistantProduction(): void {
    if (isStaticSettlement(this)) return
    this.refreshChiefSuccession(this.getLivingUnitsByType(UNIT_TYPES.villager))
    const villagers = this.getLivingUnitsByType(UNIT_TYPES.villager).filter(unit => !isChiefUnit(unit))
    this.strategy.updatePhase(villagers.length)
    if (this.phase !== 'military_build') return
    const reserveWorkers = Math.max(4, Math.ceil(this.difficultyConfig.econToMilVillagers * 0.6))
    const budget = Math.max(0, Math.min(AI_ABSTRACT_DAILY_RECRUITS, villagers.length - reserveWorkers))
    const recruits = villagers
      .filter(unit => unit.work !== 'builder' && unit.autonomousJob !== 'construction' && !unit.trainingTargetType)
      .slice(0, budget)
    const snapshot = this.getStrategySnapshot({
      map: this.context.map,
      villagers: recruits,
      ...this.classifyMilitary(),
      ...this.getStepLimits(),
    })
    this.strategy.handleProductionActions(snapshot, false)
  }

  die() {
    const {
      context: { players },
    } = this
    if (this._stepTaskId != null) this.context.scheduler.remove(this._stepTaskId)
    this._stepTaskId = null
    if (this._chiefEscortTaskId != null) this.context.scheduler.remove(this._chiefEscortTaskId)
    this._chiefEscortTaskId = null
    const index = players.indexOf(this)
    if (index !== -1) players.splice(index, 1)
  }
}
