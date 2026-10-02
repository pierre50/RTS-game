import { sameMapSpace } from '../../lib/mapSpaces'
import { isInteriorTheftDefender } from '../../ai/AITheftDefense'
import type { EnemyMemory } from '../../ai/AIThreatManager'
import type { AIBuildingLike, AIEntityLike } from '../../ai/types'
import { ACTION_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import { AI_CHIEF_SUCCESSION_DELAY_MS, isChiefUnit, isLivingChief } from '../../lib/chief'
import { getPositionInGridAroundInstance } from '../../lib/grid/placement'
import { refreshBakedLpcUnitAssets } from '../../lib/lpc'
import { instancesDistance } from '../../lib/maths'
import { shouldVillagerWork } from '../../lib/units/villagerSchedule'
import { hasInteriorCombatRoute } from '../../lib/units/interiorCombat'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import {} from './AITrackingCleanup'
import { findVillageAnchor } from './AIVillageDefense'

const CHIEF_FORUM_GUARD_RANGE = 8
const CHIEF_HERO_TALK_RANGE = 2.5

export type AIPlayerBehaviorHost = {
  civ?: string
  factionId?: string | null
  context: {
    players?: PlayerLike[]
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
  getNow(): number
  getLivingChiefs(): AIEntityLike[]
  getVisibleHostilesNear(target: AIEntityLike, radius?: number): AIEntityLike[]
  getEnemyMemories(options?: { family?: string | null; freshWithin?: number; visibleOnly?: boolean }): EnemyMemory[]
  isEnemy(owner?: unknown): boolean
  _refreshEnemyMemory(memoryMap: Map<string, EnemyMemory>): void
}

export function refreshAIChiefSuccession(ai: AIPlayerBehaviorHost, villagers: AIEntityLike[]): number {
  const faction = ai.factionId ?? ai.civ
  const peers = faction
    ? (ai.context.players ?? []).filter(owner => owner.type === 'AI' && (owner.factionId ?? owner.civ) === faction)
    : []
  const factionChiefs = peers.flatMap(owner => owner.units.filter(isLivingChief))
  const chiefs = factionChiefs.length ? factionChiefs : ai.getLivingChiefs()
  retireDuplicateChiefs(chiefs)
  if (chiefs.length > 0) {
    ai.chiefLossDetectedAt = null
    return 0
  }

  const successorOwner = peers.find(owner =>
    owner.units.some(unit => unit.type === UNIT_TYPES.villager && !unit.isDead && !unit.isDestroyed)
  )
  if (successorOwner && successorOwner !== (ai as unknown as PlayerLike)) return 0
  const now = ai.getNow()
  ai.chiefLossDetectedAt ??= now
  if (now - ai.chiefLossDetectedAt < AI_CHIEF_SUCCESSION_DELAY_MS) return 0
  return promoteChiefSuccessor(ai, villagers)
}

// Old/custom maps may contain several leaders for the same faction. Retain one.
function retireDuplicateChiefs(chiefs: AIEntityLike[]): void {
  for (const duplicate of chiefs.slice(1)) {
    if (duplicate.controlMode === 'hero') continue
    duplicate.isChief = false
    if (duplicate.type === UNIT_TYPES.chief) duplicate.type = UNIT_TYPES.villager
    duplicate.work = null
    refreshBakedLpcUnitAssets(duplicate as UnitEntity)
  }
}

function promoteChiefSuccessor(ai: AIPlayerBehaviorHost, villagers: AIEntityLike[]): number {
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
  const anchor = findVillageAnchor(towncenters)
  if (!anchor) return 0
  let actions = 0
  const now = ai.getNow()
  const hero = getApproachableHeroNearChiefAnchor(ai, anchor)
  for (const chief of ai.getLivingChiefs()) {
    if (isChiefUnavailableForGuard(chief)) continue
    actions += guardChief(ai, chief, anchor, hero, now)
  }
  return actions
}

function isChiefUnavailableForGuard(chief: AIEntityLike): boolean {
  if (chief.controlMode === 'hero' || isInteriorTheftDefender(chief) || hasInteriorCombatRoute(chief)) return true
  const unit = chief as UnitEntity
  return Boolean(
    unit.shelterState || unit.actionLocked || unit.spacePortalState || (unit.spaceId && unit.spaceId !== 'outside')
  )
}

function guardChief(
  ai: AIPlayerBehaviorHost,
  chief: AIEntityLike,
  anchor: AIBuildingLike,
  hero: UnitEntity | null,
  now: number
): number {
  const hostiles = ai.getVisibleHostilesNear(anchor, 12)
  const target = hostiles[0]
  if (target && chief.action !== ACTION_TYPES.attack) {
    chief.lookingAtHero = false
    chief.sendTo?.(target, ACTION_TYPES.attack)
    return 1
  }

  if (chief.lookingAtHero || chief.action === ACTION_TYPES.attack || !shouldVillagerWork(chief as UnitEntity)) return 0

  const distanceToAnchor = Math.abs(chief.i - anchor.i) + Math.abs(chief.j - anchor.j)
  if (distanceToAnchor > CHIEF_FORUM_GUARD_RANGE) {
    chief.sendTo?.(anchor)
    return 1
  }

  if (hero) {
    if (instancesDistance(chief, hero) > CHIEF_HERO_TALK_RANGE && chief.dest !== hero) {
      chief.sendTo?.(hero)
      return 1
    }
    return 0
  }
  return wanderChiefNearAnchor(ai, chief, anchor, now)
}

function wanderChiefNearAnchor(ai: AIPlayerBehaviorHost, chief: AIEntityLike, anchor: AIBuildingLike, now: number) {
  const ready =
    chief.inactif && !(chief as UnitEntity).pendingOrder && now >= (ai.chiefWanderReadyAt.get(chief.label) ?? 0)
  if (!ready) return 0
  const guardCell = getPositionInGridAroundInstance(anchor, ai.context.map.grid, [2, 4], 0)
  ai.chiefWanderReadyAt.set(chief.label, now + ai.context.map.randomRange(30000, 60000))
  if (!guardCell) return 0
  chief.sendTo?.(guardCell as RuntimeCell)
  return 1
}

export function getApproachableHeroNearChiefAnchor(
  ai: AIPlayerBehaviorHost,
  anchor: AIBuildingLike
): UnitEntity | null {
  const hero = ai.context.controls?.heroUnit
  if (!hero || hero.isDead || hero.isDestroyed || !hero.owner || !sameMapSpace(hero, anchor)) return null
  if (ai.isEnemy(hero.owner) || hero.owner.isEnemy?.(ai as unknown as PlayerLike)) return null
  return instancesDistance(anchor, hero) <= CHIEF_FORUM_GUARD_RANGE ? hero : null
}

export { cleanupAITrackingSets } from './AITrackingCleanup'
export { handleAIVisibleEnemyDefense, type AIVillageDefenseResult } from './AIVillageDefense'
