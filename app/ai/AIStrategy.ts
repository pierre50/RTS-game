import { AGE_GATE_MAX_UNLOCKABLE_VALUE, AGE_UP_ENABLED, BUILDING_TYPES, UNIT_TYPES } from '../constants'
import { canAfford, getPositionInGridAroundInstance, instancesDistance } from '../lib'
import { hasLivingChief } from '../lib/chief'
import { AIMilitary } from './AIMilitary'
import {
  AGE_UP_BUFFERS,
  AGE_UP_COSTS,
  AI_DIFFICULTIES,
  CHIEF_TECH_PRIORITY,
  MAX_ARCHER_BY_AGE,
  MAX_BUILDING_BY_AGE,
  MAX_BUILDING_BY_AGE_FROZEN,
  MAX_CAVALRY_BY_AGE,
  MAX_INFANTRY_BY_AGE,
  MAX_VILLAGER_PER_AGE,
  NEXT_AGE,
  TECH_PRIORITY_BY_BUILDING,
  VILLAGE_TARGET_PERCENTAGE_BY_AGE,
} from './config'
import { ARCHER_TECH_UPGRADES, getBestUnitFromTechs } from './unitGroups'
import type { UnitCreationExtra } from '../types/entities'
import type {
  AIAge,
  AIBuildingLike,
  AIDifficultyConfig,
  AIEntityLike,
  AIGridPosition,
  AIResourceAmount,
  AIResourceName,
  AIStrategyPlayerLike,
  AIStrategySnapshot,
  AITechCondition,
} from './types'

type AgeMap<T> = Record<AIAge, T>
type NextAgeMap = Partial<Record<1 | 2 | 3, string>>
type BuildingListByType = Record<string, AIBuildingLike[]>
type MilitaryOptions = Parameters<AIMilitary['handleActions']>[0]
type MilitaryActionsResult = ReturnType<AIMilitary['handleActions']>
type ResourceLedger = Record<string, number | undefined>

const RESOURCE_NAMES: AIResourceName[] = ['wood', 'food', 'gold', 'stone']
const WHEAT_TILES_PER_FIELD = 16
const MAX_AI_WHEAT_FIELDS = 4

function resourceEntries(cost: AIResourceAmount = {}): [AIResourceName, number][] {
  return RESOURCE_NAMES.map(resource => [resource, cost[resource]] as [AIResourceName, number | undefined]).filter(
    (entry): entry is [AIResourceName, number] => typeof entry[1] === 'number'
  )
}

function asResourceLedger(player: AIStrategyPlayerLike): ResourceLedger {
  return {
    wood: player.wood,
    food: player.food,
    gold: player.gold,
    stone: player.stone,
  }
}

export class AIStrategy {
  ai: AIStrategyPlayerLike
  difficulty: string
  difficultyConfig: AIDifficultyConfig
  nextAge: NextAgeMap
  maxVillagerPerAge: AgeMap<number>
  villageTargetPercentageByAge: AgeMap<Record<keyof AIResourceAmount, number>>
  maxBuildingByAge: AgeMap<Record<string, number>>
  maxInfantryByAge: AgeMap<number>
  maxArcherByAge: AgeMap<number>
  maxCavalryByAge: AgeMap<number>
  chiefTechPriority: string[]
  techPriorityByBuilding: Record<string, string[]>
  military: AIMilitary

  constructor(ai: AIStrategyPlayerLike, difficulty: string = 'medium') {
    this.ai = ai
    this.difficulty = difficulty
    this.difficultyConfig =
      (AI_DIFFICULTIES as Record<string, AIDifficultyConfig>)[difficulty] || AI_DIFFICULTIES.medium
    this.nextAge = NEXT_AGE
    this.maxVillagerPerAge = MAX_VILLAGER_PER_AGE
    this.villageTargetPercentageByAge = VILLAGE_TARGET_PERCENTAGE_BY_AGE
    this.maxBuildingByAge = AGE_UP_ENABLED ? MAX_BUILDING_BY_AGE : MAX_BUILDING_BY_AGE_FROZEN
    this.maxInfantryByAge = MAX_INFANTRY_BY_AGE
    this.maxArcherByAge = MAX_ARCHER_BY_AGE
    this.maxCavalryByAge = MAX_CAVALRY_BY_AGE
    this.chiefTechPriority = CHIEF_TECH_PRIORITY
    this.techPriorityByBuilding = TECH_PRIORITY_BY_BUILDING
    this.military = new AIMilitary(ai, this)
  }

  applyConfig(target: AIStrategyPlayerLike): void {
    target.difficultyConfig = this.difficultyConfig
    target.nextAge = this.nextAge
    target.maxVillagerPerAge = this.maxVillagerPerAge
    target.villageTargetPercentageByAge = this.villageTargetPercentageByAge
    target.maxBuildingByAge = this.maxBuildingByAge
    target.maxInfantryByAge = this.maxInfantryByAge
    target.maxArcherByAge = this.maxArcherByAge
    target.maxCavalryByAge = this.maxCavalryByAge
    target.techPriorityByBuilding = this.techPriorityByBuilding
  }

  // Vrai si l'IA doit être considérée comme ayant atteint `requiredAge` : soit réellement (age-up
  // actif), soit parce que ce palier est "atteignable" (<= AGE_GATE_MAX_UNLOCKABLE_VALUE) et qu'on
  // ne veut pas la brider à vie pendant que le passage d'âge est désactivé.
  hasReachedAge(requiredAge: number): boolean {
    if (!AGE_UP_ENABLED) return requiredAge <= AGE_GATE_MAX_UNLOCKABLE_VALUE
    return this.ai.age >= requiredAge
  }

  canResearchTech(techKey: string): boolean {
    const { ai } = this
    const tech = ai.techs[techKey]
    if (!tech?.conditions) return true
    return tech.conditions.every((cond: AITechCondition) => {
      if (cond.key === 'age') {
        const ageValue = typeof cond.value === 'number' ? cond.value : Number(cond.value)
        if (cond.op === '>=') return this.hasReachedAge(ageValue)
        if (cond.op === '=') return ai.age === ageValue
      }
      if (cond.key === 'technologies') {
        const technology = String(cond.value)
        if (cond.op === 'includes') return ai.technologies.includes(technology)
        if (cond.op === 'notincludes') return !ai.technologies.includes(technology)
      }
      return true
    })
  }

  getBestInfantryUnit(): string {
    return 'Fantassin'
  }

  getBestArcherUnit(): string {
    return getBestUnitFromTechs(this.ai.technologies, ARCHER_TECH_UPGRADES, 'Bowman')
  }

  updatePhase(villagersCount: number, militaryCount: number, militaryPower: number = 0): string {
    const { ai, difficultyConfig } = this
    const attackPowerThreshold = this.military.getDesiredAttackPower()
    const fallbackPowerThreshold = attackPowerThreshold * 0.4
    if (ai.phase === 'economy' && villagersCount >= difficultyConfig.econToMilVillagers) {
      ai.phase = 'military_build'
      return 'military_build'
    }
    if (ai.phase === 'military_build' && villagersCount < Math.floor(difficultyConfig.econToMilVillagers * 0.6)) {
      ai.phase = 'economy'
      return 'economy'
    }
    if (
      ai.phase === 'military_build' &&
      militaryCount >= Math.max(2, Math.ceil(difficultyConfig.attackThreshold * 0.5)) &&
      militaryPower >= attackPowerThreshold
    ) {
      ai.phase = 'attack'
      return 'attack'
    }
    if (
      ai.phase === 'attack' &&
      (militaryCount < Math.ceil(difficultyConfig.attackThreshold * 0.4) || militaryPower < fallbackPowerThreshold)
    ) {
      ai.phase = 'military_build'
      return 'military_build'
    }
    return ai.phase
  }

  handleMilitaryActions(options: MilitaryOptions): MilitaryActionsResult {
    return this.military.handleActions(options)
  }

  isTechnologyInProgress(_technologyType: string, _buildingList: AIBuildingLike[] = []): boolean {
    return false
  }

  getTrainingLoad(buildings: AIBuildingLike[] = []): number {
    return buildings.reduce((total: number, building: AIBuildingLike) => {
      if (!building || building.isDead || building.isDestroyed) return total
      return total + (building.queue?.length || 0) + (building.loading != null ? 1 : 0)
    }, 0)
  }

  getDesiredBarracksCount(snapshot: Partial<AIStrategySnapshot> | null = null): number {
    const { ai, difficultyConfig } = this
    const barracks: AIBuildingLike[] =
      snapshot?.barracks || ai.buildings.filter((building: AIBuildingLike) => building.type === BUILDING_TYPES.barracks)
    const archeryRanges: AIBuildingLike[] =
      snapshot?.archeryRanges ||
      ai.buildings.filter((building: AIBuildingLike) => building.type === BUILDING_TYPES.archeryRange)
    const stables: AIBuildingLike[] =
      snapshot?.stables || ai.buildings.filter((building: AIBuildingLike) => building.type === BUILDING_TYPES.stable)
    const builtBarracks = barracks.filter(
      (building: AIBuildingLike) => building.isBuilt && !building.isDead && !building.isDestroyed
    )
    const totalMilitary =
      (snapshot?.infantry?.length || 0) + (snapshot?.archers?.length || 0) + (snapshot?.cavalry?.length || 0)
    const militaryProductionBuildings =
      archeryRanges.filter((building: AIBuildingLike) => building.isBuilt && !building.isDead && !building.isDestroyed)
        .length +
      stables.filter((building: AIBuildingLike) => building.isBuilt && !building.isDead && !building.isDestroyed).length

    let desired = ai.phase !== 'economy' ? 1 : 0

    if (
      this.hasReachedAge(2) &&
      ai.phase !== 'economy' &&
      (totalMilitary >= Math.max(8, difficultyConfig.attackThreshold * 2) ||
        this.getTrainingLoad(builtBarracks) >= Math.max(2, builtBarracks.length * 2))
    ) {
      desired = 2
    }

    if (
      ai.age >= 3 &&
      ai.phase === 'attack' &&
      totalMilitary >= Math.max(12, difficultyConfig.attackThreshold * 3) &&
      this.getTrainingLoad(builtBarracks) >= Math.max(3, builtBarracks.length * 2) &&
      militaryProductionBuildings >= 2
    ) {
      desired = 3
    }

    return desired
  }

  getEconomicDemand(): AIResourceAmount {
    const { ai } = this
    const demand: Record<keyof AIResourceAmount, number> = { food: 0, wood: 0, gold: 0, stone: 0 }
    const nextAgeKey = ai.age + 1
    const nextAgeCost = (AGE_UP_COSTS as Record<number, AIResourceAmount>)[nextAgeKey]
    if (AGE_UP_ENABLED && nextAgeCost) {
      const maxVillagers = Math.floor(this.maxVillagerPerAge[ai.age] * ai.difficultyConfig.popCapMultiplier)
      const shouldReserveAgeUp = ai.population >= Math.floor(maxVillagers * 0.7)
      for (const [resource, amount] of resourceEntries(nextAgeCost)) {
        demand[resource] += shouldReserveAgeUp ? amount : Math.max(0, amount - ai[resource])
      }
    }

    if (ai.population + 2 > ai.populationMax) {
      demand.wood += ai.config.buildings[BUILDING_TYPES.house]?.cost?.wood || 0
    }
    const currentBarracks = ai.buildings.filter(
      (building: AIBuildingLike) =>
        building.type === BUILDING_TYPES.barracks && !building.isDead && !building.isDestroyed
    ).length
    const desiredBarracks = this.getDesiredBarracksCount()
    if (ai.phase !== 'economy' && currentBarracks < desiredBarracks) {
      demand.wood +=
        (ai.config.buildings[BUILDING_TYPES.barracks]?.cost?.wood || 0) * (desiredBarracks - currentBarracks)
    }
    if (!ai.buildings.some((building: AIBuildingLike) => building.type === BUILDING_TYPES.market)) {
      demand.wood += ai.config.buildings[BUILDING_TYPES.market]?.cost?.wood || 0
    }

    return demand
  }

  getAgeUpReserve(): AIResourceAmount {
    if (!AGE_UP_ENABLED) return {}
    const { ai } = this
    const nextAgeCost = (AGE_UP_COSTS as Record<number, AIResourceAmount>)[ai.age + 1]
    if (!nextAgeCost) return {}

    const maxVillagers = Math.floor(this.maxVillagerPerAge[ai.age] * ai.difficultyConfig.popCapMultiplier)
    return ai.population >= Math.floor(maxVillagers * 0.7) ? nextAgeCost : {}
  }

  canSpendWithReserve(cost: AIResourceAmount, reserve: AIResourceAmount = {}): boolean {
    const { ai } = this
    return resourceEntries(cost).every(([resource, amount]) => ai[resource] - amount >= (reserve[resource] || 0))
  }

  buyUnits(
    currentCount: number,
    maxCount: number,
    buildingList: AIBuildingLike[],
    unitType: string,
    extra: UnitCreationExtra | undefined,
    reserve: AIResourceAmount = {},
    debug: boolean = false
  ): number {
    const unitsNeeded = maxCount - currentCount
    let unitsBought = 0
    if (unitsNeeded <= 0) return 0
    const unitCost = this.ai.config.units[unitType]?.cost || {}
    for (const building of buildingList) {
      if (unitsBought >= unitsNeeded) break
      if (
        building &&
        this.canSpendWithReserve(unitCost, reserve) &&
        building.buyUnit?.(unitType, false, false, extra)
      ) {
        unitsBought++
        if (debug) console.log(`Buying ${unitType} from ${building.type}, Total Bought: ${unitsBought}`)
      }
    }
    return unitsBought
  }

  handleProductionActions(snapshot: AIStrategySnapshot, debug: boolean = false): number {
    const {
      villagers,
      maxVillagers,
      towncenters,
      infantry,
      maxInfantry,
      barracks,
      infantryUnit,
      archers,
      maxArcher,
      archeryRanges,
      archerUnit,
    } = snapshot

    let actions = 0
    const reserve = this.getEconomicDemand()
    const chiefAlive = hasLivingChief(this.ai)

    if (chiefAlive) {
      actions += this.buyUnits(
        villagers.length,
        maxVillagers,
        towncenters,
        UNIT_TYPES.villager,
        undefined,
        reserve,
        debug
      )
    }
    actions += this.buyUnits(infantry.length, maxInfantry, barracks, infantryUnit, undefined, reserve, debug)
    actions += this.buyUnits(archers.length, maxArcher, archeryRanges, archerUnit, undefined, reserve, debug)
    return actions
  }

  getViableBerryBushCount(): number {
    const { ai } = this
    const dropSites = ai.buildings.filter(
      (building: AIBuildingLike) =>
        [BUILDING_TYPES.townCenter, BUILDING_TYPES.granary].includes(building.type) &&
        building.isBuilt &&
        !building.isDead &&
        !building.isDestroyed
    )
    const homeAnchor = ai.getHomeAnchor()
    const MAX_BERRY_DROP_DIST = 14
    const MAX_BERRY_HOME_DIST = 30

    return [...ai.foundedBerrybushs].filter((bush: AIEntityLike) => {
      if (!bush || bush.isDead || (bush.quantity || 0) <= 0) return false
      if (dropSites.length > 0) {
        const nearDropSite = dropSites.some(
          (site: AIBuildingLike) => Math.abs(bush.i - site.i) + Math.abs(bush.j - site.j) <= MAX_BERRY_DROP_DIST
        )
        if (!nearDropSite) return false
      }
      if (!homeAnchor) return true
      return Math.abs(bush.i - homeAnchor.i) + Math.abs(bush.j - homeAnchor.j) <= MAX_BERRY_HOME_DIST
    }).length
  }

  buyBuildingIfNeeded(
    condition: boolean,
    buildingType: string,
    buildingsByType: BuildingListByType,
    positionCallback: () => AIGridPosition | null,
    reserve: AIResourceAmount = {},
    debug: boolean = false
  ): boolean {
    const { ai } = this
    const building = ai.config.buildings[buildingType]
    if (
      condition &&
      canAfford(asResourceLedger(ai), building.cost) &&
      this.canSpendWithReserve(building.cost || {}, reserve) &&
      ai.hasNotReachBuildingLimit(buildingType, buildingsByType[buildingType])
    ) {
      const pos = positionCallback()
      if (pos && ai.buyBuilding(pos.i, pos.j, buildingType)) {
        if (debug) console.log(`Buying building: ${buildingType} at position:`, pos)
        return true
      }
    }
    return false
  }

  buyWheatFieldIfNeeded(
    condition: boolean,
    currentWheatTiles: AIEntityLike[],
    positionCallback: () => AIGridPosition | null,
    reserve: AIResourceAmount = {},
    debug: boolean = false
  ): boolean {
    const { ai } = this
    const field = ai.config.buildings[BUILDING_TYPES.farm]
    if (
      condition &&
      field &&
      canAfford(asResourceLedger(ai), field.cost) &&
      this.canSpendWithReserve(field.cost || {}, reserve)
    ) {
      const pos = positionCallback()
      if (pos && ai.buyBuilding(pos.i, pos.j, BUILDING_TYPES.farm)) {
        if (debug) {
          const fieldCount = Math.ceil(currentWheatTiles.length / WHEAT_TILES_PER_FIELD)
          console.log(`Planting wheat field ${fieldCount + 1} at position:`, pos)
        }
        return true
      }
    }
    return false
  }

  handleBuildingActions(snapshot: AIStrategySnapshot, debug: boolean = false): number {
    const { ai } = this
    const {
      map,
      otherPlayers,
      towncenters,
      maxVillagers,
      houses,
      farms,
      barracks,
      granarys,
      storagepits,
      markets,
      archeryRanges,
      stables,
      watchTowers,
      notBuiltHouses,
    } = snapshot

    const anchor = towncenters[0] || ai.getHomeAnchor()
    if (!anchor) return 0

    const buildingsByType = {
      [BUILDING_TYPES.townCenter]: towncenters,
      [BUILDING_TYPES.house]: houses,
      [BUILDING_TYPES.barracks]: barracks,
      [BUILDING_TYPES.granary]: granarys,
      [BUILDING_TYPES.storagePit]: storagepits,
      [BUILDING_TYPES.market]: markets,
      [BUILDING_TYPES.archeryRange]: archeryRanges,
      [BUILDING_TYPES.stable]: stables,
      [BUILDING_TYPES.watchTower]: watchTowers,
    }

    const isEnemyFacing = (origin: AIGridPosition) => (cell: AIGridPosition) =>
      otherPlayers.every(player => instancesDistance(cell, player) <= instancesDistance(origin, player))
    const ageUpReserve = this.getAgeUpReserve()
    const buy = (
      condition: boolean,
      buildingType: string,
      positionCallback: () => AIGridPosition | null,
      preserveAgeReserve: boolean = true
    ) =>
      this.buyBuildingIfNeeded(
        condition,
        buildingType,
        buildingsByType,
        positionCallback,
        preserveAgeReserve ? ageUpReserve : {},
        debug
      )

    let actions = 0
    const desiredBarracks = this.getDesiredBarracksCount(snapshot)

    if (
      buy(
        ai.population + 2 > ai.populationMax && !notBuiltHouses.length,
        BUILDING_TYPES.house,
        () => getPositionInGridAroundInstance(anchor, map.grid, [6, 10], 0),
        false
      )
    )
      actions++

    if (
      buy(ai.phase !== 'economy' && barracks.length < desiredBarracks, BUILDING_TYPES.barracks, () =>
        getPositionInGridAroundInstance(anchor, map.grid, [6, 20], 1, false, isEnemyFacing(anchor))
      )
    )
      actions++

    if (
      buy(markets.length === 0, BUILDING_TYPES.market, () =>
        getPositionInGridAroundInstance(anchor, map.grid, [6, 20], 1, false, isEnemyFacing(anchor))
      )
    )
      actions++

    if (
      buy(barracks.length > 0, BUILDING_TYPES.archeryRange, () =>
        getPositionInGridAroundInstance(anchor, map.grid, [6, 20], 1, false, isEnemyFacing(anchor))
      )
    )
      actions++

    if (
      buy(barracks.length > 0, BUILDING_TYPES.stable, () =>
        getPositionInGridAroundInstance(anchor, map.grid, [6, 20], 1, false, isEnemyFacing(anchor))
      )
    )
      actions++

    if (
      buy(ai.technologies.includes('ResearchWatchTower'), BUILDING_TYPES.watchTower, () =>
        getPositionInGridAroundInstance(anchor, map.grid, [6, 15], 2, false, isEnemyFacing(anchor))
      )
    )
      actions++

    const livingWheatTiles = farms.filter(farm => !farm.isDead && !farm.isDestroyed && (farm.quantity ?? 0) > 0)
    const currentWheatFields = Math.ceil(livingWheatTiles.length / WHEAT_TILES_PER_FIELD)
    const desiredWheatFields = Math.min(MAX_AI_WHEAT_FIELDS, Math.max(1, Math.ceil(maxVillagers / 10)))
    const wheatAnchor = granarys.find(granary => granary.isBuilt && !granary.isDead && !granary.isDestroyed) || anchor
    if (
      this.buyWheatFieldIfNeeded(
        ai.technologies.includes('Farming') && granarys.length > 0 && currentWheatFields < desiredWheatFields,
        livingWheatTiles,
        () => getPositionInGridAroundInstance(wheatAnchor, map.grid, [4, 14], 4, false),
        ageUpReserve,
        debug
      )
    )
      actions++

    return actions
  }

  buyTechnology(
    buildingList: AIBuildingLike[],
    technologyType: string,
    reserve: AIResourceAmount = {},
    debug: boolean = false
  ): number {
    const cost = this.ai.techs[technologyType]?.cost || {}
    if (!this.canSpendWithReserve(cost, reserve)) return 0
    if (this.ai.buyTechnology?.(technologyType)) {
      const source = buildingList.find(building => building && !building.isDead && !building.isDestroyed)
      if (debug) console.log(`Buying ${technologyType}${source ? ` after building ${source.type}` : ''}`)
      return 1
    }
    return 0
  }

  handleTechnologyActions(snapshot: AIStrategySnapshot, debug: boolean = false): number {
    const { ai } = this
    if (!hasLivingChief(ai)) return 0
    const { maxVillagers, barracks, archeryRanges, storagepits, markets, granarys } = snapshot
    let actions = 0

    const nextAgeKey = (ai.age + 1) as 1 | 2 | 3
    if (AGE_UP_ENABLED && ai.nextAge[nextAgeKey]) {
      const cost = (AGE_UP_COSTS as Record<number, AIResourceAmount>)[nextAgeKey] || {}
      const buffer = (AGE_UP_BUFFERS as Record<number, AIResourceAmount>)[nextAgeKey] || {}
      const popReady = ai.population >= Math.floor(maxVillagers * 0.8)
      const resReady = resourceEntries(cost).every(([res, amount]) => ai[res] >= amount + (buffer[res] || 0))
      if (popReady && resReady && !this.isTechnologyInProgress(ai.nextAge[nextAgeKey])) {
        actions += this.buyTechnology([], ai.nextAge[nextAgeKey], {}, debug)
      }
    }

    const ageUpReserve = this.getAgeUpReserve()
    for (const tech of this.chiefTechPriority) {
      if (ai.technologies.includes(tech)) continue
      if (!this.canResearchTech(tech)) continue
      if (this.isTechnologyInProgress(tech)) continue
      actions += this.buyTechnology([], tech, ageUpReserve, debug)
    }

    const buildingListByType: BuildingListByType = {
      [BUILDING_TYPES.barracks]: barracks,
      [BUILDING_TYPES.archeryRange]: archeryRanges,
      [BUILDING_TYPES.storagePit]: storagepits,
      [BUILDING_TYPES.market]: markets,
      [BUILDING_TYPES.granary]: granarys,
    }
    for (const [buildingType, techList] of Object.entries(ai.techPriorityByBuilding) as [string, string[]][]) {
      const buildings = buildingListByType[buildingType]
      for (const tech of techList) {
        if (ai.technologies.includes(tech)) continue
        if (!this.canResearchTech(tech)) continue
        if (this.isTechnologyInProgress(tech, buildings)) continue
        const bought = this.buyTechnology(buildings, tech, ageUpReserve, debug)
        if (bought) {
          actions += bought
          break
        }
      }
    }

    return actions
  }
}
