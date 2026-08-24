import { Player } from './Player'
import type { PlayerOptions } from './Player'

import {
  getPositionInGridAroundInstance,
  getClosestInstance,
  instancesDistance,
  canAfford,
  isPlayerEliminated,
} from '../../lib'
import {
  ACTION_TYPES,
  FAMILY_TYPES,
  PLAYER_TYPES,
  UNIT_TYPES,
  BUILDING_TYPES,
  RESOURCE_TYPES,
  WORK_TYPES,
} from '../../constants'
import { AIStrategy } from '../../ai/AIStrategy'
import { AIEconomy } from '../../ai/AIEconomy'
import { AIThreatManager, type EnemyMemory, type StoredThreat, type ThreatProfile } from '../../ai/AIThreatManager'
import { classifyMilitaryUnits, isAliveUnit } from '../../ai/unitGroups'
import { AI_CHIEF_SUCCESSION_DELAY_MS, isChiefUnit, isLivingChief } from '../../lib/chief'
import { refreshBakedLpcUnitAssets } from '../../lib/lpc'
import type {
  AIAge,
  AIBuildingLike,
  AIEntityLike,
  AIStrategyPlayerLike,
  AIStrategySnapshot,
  EnemyMemoryOptions,
} from '../../ai/types'
import type { GameContextLike, SchedulerTaskId } from '../../types/context'
import type { RuntimeEntity, UnitCreationExtra, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

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
  notBuiltHouses: AIStrategySnapshot['notBuiltHouses']
}

const DEBUG = false
const CHIEF_FORUM_GUARD_RANGE = 8
const CHIEF_HERO_TALK_RANGE = 2.5

export class AI extends Player {
  declare age: AIAge
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
  nextAge!: AIStrategyPlayerLike['nextAge']
  maxVillagerPerAge!: AIStrategyPlayerLike['maxVillagerPerAge']
  villageTargetPercentageByAge!: AIStrategyPlayerLike['villageTargetPercentageByAge']
  maxBuildingByAge!: AIStrategyPlayerLike['maxBuildingByAge']
  maxInfantryByAge!: AIStrategyPlayerLike['maxInfantryByAge']
  maxArcherByAge!: AIStrategyPlayerLike['maxArcherByAge']
  maxCavalryByAge!: AIStrategyPlayerLike['maxCavalryByAge']
  techPriorityByBuilding!: AIStrategyPlayerLike['techPriorityByBuilding']
  _stepTaskId!: SchedulerTaskId | null

  constructor({ ...props }: PlayerOptions, context: GameContextLike) {
    super({ ...props, isPlayed: false, type: PLAYER_TYPES.ai }, context)
    this.foundedTrees = new Set()
    this.foundedBerrybushs = new Set()
    this.foundedWheats = new Set()
    this.foundedGolds = new Set()
    this.foundedStones = new Set()
    this.foundedCoppers = new Set()
    this.foundedIrons = new Set()
    this.foundedResources = {
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

  _scheduleStep() {
    this._stepTaskId = this.context.scheduler.add(
      () => {
        const actions = this.context.performance?.measure('aiStep', () => this.step()) ?? this.step()
        const newDelay =
          actions > 0 ? this.difficultyConfig.stepDelayBase : Math.min(Math.round(this.stepDelay * 1.5), 5000)
        if (newDelay !== this.stepDelay) {
          this.stepDelay = newDelay
          if (this._stepTaskId != null) this.context.scheduler.update(this._stepTaskId, newDelay)
        }
      },
      this.stepDelay,
      'ai.step'
    )
  }

  hasNotReachBuildingLimit(buildingType: string, buildings: AIEntityLike[]) {
    const currentBuildings = buildings || []
    return (
      !this.maxBuildingByAge[this.age as AIAge][buildingType] ||
      currentBuildings.length < this.maxBuildingByAge[this.age as AIAge][buildingType]
    )
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
      notBuiltHouses: state.notBuiltHouses,
    }
  }

  // Remove depleted resources and destroyed buildings from tracked Sets
  cleanupSets() {
    for (const resources of Object.values(this.foundedResources)) {
      for (const resource of resources) {
        if ((resource.quantity ?? 0) <= 0 || resource.isDead) resources.delete(resource)
      }
    }
    for (const a of this.foundedAnimals) {
      if (a.isDead || a.isDestroyed || (a.hitPoints ?? 0) <= 0) this.foundedAnimals.delete(a)
    }
    for (const a of this.foundedDeadAnimals) {
      if (a.isDestroyed || (a.quantity ?? 0) <= 0) this.foundedDeadAnimals.delete(a)
    }
    for (const b of this.foundedEnemyBuildings) {
      if (b.isDead || b.isDestroyed || !this.isEnemy(b.owner)) this.foundedEnemyBuildings.delete(b)
    }
    for (const u of this.foundedEnemyUnits) {
      if (u.isDead || u.isDestroyed || (u.hitPoints ?? 0) <= 0 || !this.isEnemy(u.owner))
        this.foundedEnemyUnits.delete(u)
    }
    this._refreshEnemyMemory(this.enemyBuildingMemory)
    this._refreshEnemyMemory(this.enemyUnitMemory)
  }

  getUnitExtraOptions(type: string) {
    const options: UnitCreationExtra = {
      handleSetDest: (target: RuntimeEntity | RuntimeCell) => {
        if (!('family' in target)) return
        const aiTarget = target
        const { map } = this.context
        if (type === UNIT_TYPES.villager && aiTarget.family === FAMILY_TYPES.resource) {
          const buildingType =
            aiTarget.type === RESOURCE_TYPES.berrybush || aiTarget.isDead
              ? BUILDING_TYPES.granary
              : BUILDING_TYPES.storagePit
          const buildings = this.buildingsByTypes([buildingType])
          const reserve = this.strategy.getAgeUpReserve()
          if (
            canAfford(this, this.config.buildings[buildingType].cost) &&
            this.strategy.canSpendWithReserve(
              this.config.buildings[buildingType].cost as Partial<Record<'wood' | 'food' | 'stone' | 'gold', number>>,
              reserve
            ) &&
            this.hasNotReachBuildingLimit(buildingType, buildings)
          ) {
            const closestBuilding = getClosestInstance(aiTarget, [
              ...buildings,
              ...this.buildingsByTypes([BUILDING_TYPES.townCenter]),
            ])
            if (!closestBuilding || instancesDistance(closestBuilding, aiTarget) > 5) {
              const pos = getPositionInGridAroundInstance(aiTarget, map.grid, [1, 5], 1)
              if (pos && this.buyBuilding(pos.i, pos.j, buildingType)) {
                if (DEBUG) console.log(`Building ${buildingType} at:`, pos)
              }
            }
          }
        }
      },
    }
    // Villager flee-vs-fight-back reactions live in the shared evaluateCombatMorale()
    // (app/lib/combat.ts), which Unit.isAttacked() applies to every player alike — no
    // AI-specific override needed here.
    return options
  }

  canResearchTech(techKey: string) {
    return this.strategy.canResearchTech(techKey)
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
    if (this.getLivingChiefs().length > 0) {
      this.chiefLossDetectedAt = null
      return 0
    }

    const now = this.getNow()
    this.chiefLossDetectedAt ??= now
    if (now - this.chiefLossDetectedAt < AI_CHIEF_SUCCESSION_DELAY_MS) return 0

    const candidates = villagers.filter(villager => !villager.isDead && !villager.isDestroyed && !isChiefUnit(villager))
    if (!candidates.length) return 0
    const promoted = this.context.map.randomItem
      ? this.context.map.randomItem(candidates)
      : candidates[Math.floor(Math.random() * candidates.length)]
    if (!promoted) return 0
    promoted.isChief = true
    promoted.work = WORK_TYPES.attacker
    promoted.stop?.()
    const promotedUnit = promoted as unknown as UnitEntity
    refreshBakedLpcUnitAssets(promotedUnit)
    if (promotedUnit.action && !promotedUnit.path?.length) {
      promotedUnit.getAction?.(promotedUnit.action)
    }
    this.chiefLossDetectedAt = null
    return 1
  }

  handleChiefGuard(towncenters: AIBuildingLike[]): number {
    const anchor = towncenters.find(towncenter => towncenter.isBuilt && !towncenter.isDead && !towncenter.isDestroyed)
    if (!anchor) return 0
    let actions = 0
    const now = this.getNow()
    const hero = this.getApproachableHeroNearChiefAnchor(anchor)
    for (const chief of this.getLivingChiefs()) {
      if (chief.controlMode === 'hero') continue
      const hostiles = this.getVisibleHostilesNear(anchor, 12)
      const target = hostiles[0]
      if (target && chief.action !== ACTION_TYPES.attack) {
        chief.sendTo?.(target, ACTION_TYPES.attack)
        actions++
        continue
      }

      const distanceToAnchor = Math.abs(chief.i - anchor.i) + Math.abs(chief.j - anchor.j)
      if (distanceToAnchor > CHIEF_FORUM_GUARD_RANGE) {
        chief.sendTo?.(anchor)
        actions++
        continue
      }

      if (hero && instancesDistance(chief, hero) > CHIEF_HERO_TALK_RANGE) {
        if (chief.dest !== hero) {
          chief.sendTo?.(hero)
          actions++
        }
        continue
      }

      if (
        chief.inactif &&
        distanceToAnchor <= CHIEF_FORUM_GUARD_RANGE &&
        now >= (this.chiefWanderReadyAt.get(chief.label) ?? 0)
      ) {
        const guardCell = getPositionInGridAroundInstance(anchor, this.context.map.grid, [2, 6], 0)
        this.chiefWanderReadyAt.set(chief.label, now + this.context.map.randomRange(6000, 12000))
        if (guardCell) {
          chief.sendTo?.(guardCell as RuntimeCell)
          actions++
        }
      }
    }
    return actions
  }

  getApproachableHeroNearChiefAnchor(anchor: AIBuildingLike): UnitEntity | null {
    const hero = this.context.controls?.heroUnit
    if (!hero || hero.isDead || hero.isDestroyed || !hero.owner) return null
    if (this.isEnemy(hero.owner) || hero.owner.isEnemy?.(this)) return null
    return instancesDistance(anchor, hero) <= CHIEF_FORUM_GUARD_RANGE ? hero : null
  }

  step() {
    const { map, paused } = this.context
    if (paused) return 0

    let actions = 0

    const maxVillagers = Math.floor(this.maxVillagerPerAge[this.age as AIAge] * this.difficultyConfig.popCapMultiplier)
    const maxInfantry = this.maxInfantryByAge[this.age as AIAge]
    const maxArcher = this.maxArcherByAge[this.age as AIAge]
    const maxCavalry = this.maxCavalryByAge[this.age as AIAge]
    const infantryUnit = this.getBestInfantryUnit()
    const archerUnit = this.getBestArcherUnit()

    if (DEBUG) {
      console.log('----Step started')
      console.log(
        `Age: ${this.age}, Wood: ${this.wood}, Food: ${this.food}, Stone: ${this.stone}, Gold: ${this.gold}, Population: ${this.population}/${this.populationMax}`
      )
    }

    const allVillagers = this.getLivingUnitsByType(UNIT_TYPES.villager)
    actions += this.refreshChiefSuccession(allVillagers)
    const villagers = allVillagers.filter(villager => !isChiefUnit(villager))
    const { infantry, archers, cavalry } = classifyMilitaryUnits(this.units as AIEntityLike[])
    const military = [...infantry, ...archers, ...cavalry]
    const militaryPower = this.strategy.military.getGroupCombatPower(military)

    if (DEBUG)
      console.log(
        `Villagers: ${villagers.length}/${maxVillagers}, Fantassin: ${infantry.length}/${maxInfantry} (${infantryUnit}), Archers: ${archers.length}/${maxArcher} (${archerUnit}), Cavalry: ${cavalry.length}/${maxCavalry}, Power: ${Math.round(militaryPower)}`
      )

    const previousPhase = this.phase
    this.strategy.updatePhase(villagers.length)
    if (DEBUG && previousPhase !== this.phase) console.log(`Phase: ${previousPhase} → ${this.phase}`)
    if (DEBUG) console.log(`Phase: ${this.phase}`)

    const towncenters = this.buildingsByTypes([BUILDING_TYPES.townCenter])
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

    const notBuiltBuildings = (this.buildings as AIBuildingLike[])
      .filter(b => !b.isBuilt || ((b.hitPoints ?? 0) > 0 && (b.hitPoints ?? 0) < (b.totalHitPoints ?? 1)))
      .sort((a, b) => (a.type === BUILDING_TYPES.house ? -1 : b.type === BUILDING_TYPES.house ? 1 : 0))
    const notBuiltHouses = notBuiltBuildings.filter(b => b.type === BUILDING_TYPES.house)

    const RETREAT_HP_RATIO = 0.3
    const waitingMilitary = military.filter(
      c =>
        c.inactif &&
        c.action !== ACTION_TYPES.attack &&
        (c.hitPoints ?? 0) >= (c.totalHitPoints ?? 1) * RETREAT_HP_RATIO
    )

    if (DEBUG) console.log(`Waiting Military: ${waitingMilitary.length}`)

    // Player losing condition
    if (isPlayerEliminated(this)) {
      if (DEBUG) console.log('Player can no longer act. Dying...')
      this.die()
      return 0
    }

    // Remove depleted resources and destroyed enemies from tracked sets
    this.cleanupSets()
    this.cleanupThreats()

    actions += this.handleThreatResponses({
      villagers,
      waitingMilitary,
      debug: DEBUG,
    })
    actions += this.handleChiefGuard(towncenters)

    const refreshedWaitingMilitary = waitingMilitary.filter(u => u.inactif && u.action !== ACTION_TYPES.attack)

    actions += this.economy.handleVillagerActions({
      villagers,
      map,
      farms,
      notBuiltBuildings,
      storagepits,
      towncenters,
      debug: DEBUG,
    })

    actions += this.strategy.handleMilitaryActions({
      waitingMilitary: refreshedWaitingMilitary,
      debug: DEBUG,
    })

    const strategySnapshot = this.getStrategySnapshot({
      map,
      villagers,
      maxVillagers,
      infantry,
      maxInfantry,
      infantryUnit,
      archers,
      maxArcher,
      archerUnit,
      cavalry,
      maxCavalry,
      notBuiltHouses,
    })

    actions += this.strategy.handleProductionActions(strategySnapshot, DEBUG)
    actions += this.strategy.handleBuildingActions(strategySnapshot, DEBUG)
    actions += this.strategy.handleTechnologyActions(strategySnapshot, DEBUG)

    if (DEBUG) console.log('----Step ended')
    return actions
  }

  die() {
    const {
      context: { players },
    } = this
    if (this._stepTaskId != null) this.context.scheduler.remove(this._stepTaskId)
    this._stepTaskId = null
    players.splice(players.indexOf(this), 1)
  }
}
