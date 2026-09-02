import { canAfford } from '../../lib/accounting'
import { getPositionInGridAroundInstance } from '../../lib/grid/placement'
import { getClosestInstance } from '../../lib/grid/queries'
import { instancesDistance } from '../../lib/maths'
import { ACTION_TYPES, BUILDING_TYPES, FAMILY_TYPES, RESOURCE_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import { AI_CHIEF_SUCCESSION_DELAY_MS, isChiefUnit } from '../../lib/chief'
import { refreshBakedLpcUnitAssets } from '../../lib/lpc'
import type { EnemyMemory } from '../../ai/AIThreatManager'
import type { AIAge, AIBuildingLike, AIEntityLike } from '../../ai/types'
import type { RuntimeEntity, UnitCreationExtra, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { PlayerLike } from '../../types/player'

const CHIEF_FORUM_GUARD_RANGE = 8
const CHIEF_HERO_TALK_RANGE = 2.5

type AIPlayerBehaviorHost = {
  age: AIAge
  config: {
    buildings: Record<string, { cost?: unknown }>
  }
  context: {
    controls?: { heroUnit?: UnitEntity | null }
    map: {
      grid: RuntimeCell[][]
      randomItem?: <T>(items: T[]) => T | undefined
      randomRange(min: number, max: number): number
    }
  }
  difficultyConfig: { stepDelayBase: number }
  foundedResources: Record<string, Set<RuntimeEntity>>
  foundedAnimals: Set<RuntimeEntity>
  foundedDeadAnimals: Set<RuntimeEntity>
  foundedEnemyBuildings: Set<RuntimeEntity>
  foundedEnemyUnits: Set<RuntimeEntity>
  enemyBuildingMemory: Map<string, EnemyMemory>
  enemyUnitMemory: Map<string, EnemyMemory>
  chiefLossDetectedAt: number | null
  chiefWanderReadyAt: Map<string, number>
  strategy: {
    getAgeUpReserve(): unknown
    canSpendWithReserve(cost: Partial<Record<'wood' | 'food' | 'stone' | 'gold', number>>, reserve: unknown): boolean
  }
  buildingsByTypes(types: string[]): AIBuildingLike[]
  hasNotReachBuildingLimit(buildingType: string, buildings: AIEntityLike[]): boolean
  buyBuilding(i: number, j: number, buildingType: string): boolean
  getNow(): number
  getLivingChiefs(): AIEntityLike[]
  getVisibleHostilesNear(target: AIEntityLike, radius?: number): AIEntityLike[]
  getActiveThreats?: () => Array<{
    target: AIEntityLike
    hostiles: AIEntityLike[]
    profile?: {
      isNearHome?: boolean
      isInVillageCore?: boolean
      isDirectVillageAssault?: boolean
      isCriticalBuilding?: boolean
    }
  }>
  isEnemy(owner?: unknown): boolean
  _refreshEnemyMemory(memoryMap: Map<string, EnemyMemory>): void
}

export function cleanupAITrackingSets(ai: AIPlayerBehaviorHost) {
  for (const resources of Object.values(ai.foundedResources)) {
    for (const resource of resources) {
      if ((resource.quantity ?? 0) <= 0 || resource.isDead) resources.delete(resource)
    }
  }
  for (const animal of ai.foundedAnimals) {
    if (animal.isDead || animal.isDestroyed || (animal.hitPoints ?? 0) <= 0) ai.foundedAnimals.delete(animal)
  }
  for (const animal of ai.foundedDeadAnimals) {
    if (animal.isDestroyed || (animal.quantity ?? 0) <= 0) ai.foundedDeadAnimals.delete(animal)
  }
  for (const building of ai.foundedEnemyBuildings) {
    if (building.isDead || building.isDestroyed || !ai.isEnemy(building.owner))
      ai.foundedEnemyBuildings.delete(building)
  }
  for (const unit of ai.foundedEnemyUnits) {
    if (unit.isDead || unit.isDestroyed || (unit.hitPoints ?? 0) <= 0 || !ai.isEnemy(unit.owner)) {
      ai.foundedEnemyUnits.delete(unit)
    }
  }
  ai._refreshEnemyMemory(ai.enemyBuildingMemory)
  ai._refreshEnemyMemory(ai.enemyUnitMemory)
}

export function createAIUnitExtraOptions(ai: AIPlayerBehaviorHost, type: string, debug = false): UnitCreationExtra {
  return {
    handleSetDest: (target: RuntimeEntity | RuntimeCell) => {
      if (!('family' in target)) return
      if (type !== UNIT_TYPES.villager || target.family !== FAMILY_TYPES.resource) return

      const buildingType =
        target.type === RESOURCE_TYPES.berrybush || target.isDead ? BUILDING_TYPES.granary : BUILDING_TYPES.storagePit
      const buildings = ai.buildingsByTypes([buildingType])
      const reserve = ai.strategy.getAgeUpReserve()
      const cost = ai.config.buildings[buildingType].cost as Partial<Record<'wood' | 'food' | 'stone' | 'gold', number>>
      if (!canAfford(ai as Parameters<typeof canAfford>[0], cost) || !ai.strategy.canSpendWithReserve(cost, reserve)) {
        return
      }
      if (!ai.hasNotReachBuildingLimit(buildingType, buildings)) return

      const closestBuilding = getClosestInstance(target, [
        ...buildings,
        ...ai.buildingsByTypes([BUILDING_TYPES.townCenter]),
      ])
      if (closestBuilding && instancesDistance(closestBuilding, target) <= 5) return

      const pos = getPositionInGridAroundInstance(target, ai.context.map.grid, [1, 5], 1)
      if (pos && ai.buyBuilding(pos.i, pos.j, buildingType) && debug) {
        console.log(`Building ${buildingType} at:`, pos)
      }
    },
  }
}

export function refreshAIChiefSuccession(ai: AIPlayerBehaviorHost, villagers: AIEntityLike[]): number {
  if (ai.getLivingChiefs().length > 0) {
    ai.chiefLossDetectedAt = null
    return 0
  }

  const now = ai.getNow()
  ai.chiefLossDetectedAt ??= now
  if (now - ai.chiefLossDetectedAt < AI_CHIEF_SUCCESSION_DELAY_MS) return 0

  const candidates = villagers.filter(villager => !villager.isDead && !villager.isDestroyed && !isChiefUnit(villager))
  if (!candidates.length) return 0
  const promoted = ai.context.map.randomItem
    ? ai.context.map.randomItem(candidates)
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
  ai.chiefLossDetectedAt = null
  return 1
}

export function handleAIChiefGuard(ai: AIPlayerBehaviorHost, towncenters: AIBuildingLike[]): number {
  const anchor = towncenters.find(towncenter => towncenter.isBuilt && !towncenter.isDead && !towncenter.isDestroyed)
  if (!anchor) return 0
  let actions = 0
  const now = ai.getNow()
  const hero = getApproachableHeroNearChiefAnchor(ai, anchor)
  const activeVillageThreat = ai
    .getActiveThreats?.()
    .find(
      threat =>
        threat.hostiles[0] &&
        (threat.profile?.isNearHome ||
          threat.profile?.isInVillageCore ||
          threat.profile?.isDirectVillageAssault ||
          threat.profile?.isCriticalBuilding)
    )
  for (const chief of ai.getLivingChiefs()) {
    if (chief.controlMode === 'hero') continue
    const activeThreatTarget = activeVillageThreat?.hostiles[0]
    if (activeThreatTarget && chief.dest !== activeThreatTarget) {
      chief.sendTo?.(activeThreatTarget, ACTION_TYPES.attack)
      actions++
      continue
    }

    const hostiles = ai.getVisibleHostilesNear(anchor, 12)
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

    if (chief.inactif && now >= (ai.chiefWanderReadyAt.get(chief.label) ?? 0)) {
      const guardCell = getPositionInGridAroundInstance(anchor, ai.context.map.grid, [2, 6], 0)
      ai.chiefWanderReadyAt.set(chief.label, now + ai.context.map.randomRange(6000, 12000))
      if (guardCell) {
        chief.sendTo?.(guardCell as RuntimeCell)
        actions++
      }
    }
  }
  return actions
}

export function getApproachableHeroNearChiefAnchor(
  ai: AIPlayerBehaviorHost,
  anchor: AIBuildingLike
): UnitEntity | null {
  const hero = ai.context.controls?.heroUnit
  if (!hero || hero.isDead || hero.isDestroyed || !hero.owner) return null
  if (ai.isEnemy(hero.owner) || hero.owner.isEnemy?.(ai as unknown as PlayerLike)) return null
  return instancesDistance(anchor, hero) <= CHIEF_FORUM_GUARD_RANGE ? hero : null
}
