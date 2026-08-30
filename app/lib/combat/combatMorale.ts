import { BUCKET_SIZE, FAMILY_TYPES, UNIT_TYPES } from '../constants'
import { getEntityWeaponPower } from '../equipment/equipmentStats'
import { getCombatBehavior, getCombatMoraleRoll } from './combatBehavior'
import { getEntitySpaceMapLike } from '../mapSpaces'
import type { CombatEntity } from '../../types/combat'
import type { RuntimeMap } from '../../types/map'

const SPARE_A_WEAKENED_ATTACKER_HEALTH_RATIO = 0.4
const MORALE_SCAN_RADIUS = 6
const CIVILIAN_SURRENDER_HEALTH_RATIO = 0.28
const SOLDIER_SURRENDER_HEALTH_RATIO = 0.18

export type CombatMoraleDecision = 'fight' | 'flee' | 'surrender'

type SpaceLookupEntity = Parameters<typeof getEntitySpaceMapLike>[0]

function getCombatEntitySpaceMap(source: CombatEntity) {
  return getEntitySpaceMapLike(source as SpaceLookupEntity, source.context?.map as RuntimeMap | null | undefined)
}

function canAttack(source?: CombatEntity | null): boolean {
  return getEntityWeaponPower(source as Parameters<typeof getEntityWeaponPower>[0] | null | undefined) > 0
}

function getHealthRatio(entity?: CombatEntity | null): number {
  const total = entity?.totalHitPoints ?? 0
  if (total <= 0) return 1
  return Math.max(0, Math.min(1, (entity?.hitPoints ?? total) / total))
}

function isLeaderUnit(source: CombatEntity): boolean {
  return source.type === UNIT_TYPES.hero || source.type === UNIT_TYPES.chief
}

function usesCombatMoralePersonality(source: CombatEntity): boolean {
  return canAttack(source)
}

function shouldStandGroundFromMorale(source: CombatEntity): boolean {
  if (!usesCombatMoralePersonality(source)) return false
  const behavior = getCombatBehavior(source as Parameters<typeof getCombatBehavior>[0])
  return getCombatMoraleRoll(source as Parameters<typeof getCombatMoraleRoll>[0]) < behavior.bravery
}

function isCriticallyOutmatched(source: CombatEntity, attacker?: CombatEntity | null): boolean {
  const behavior = getCombatBehavior(source as Parameters<typeof getCombatBehavior>[0])
  return (
    getHealthRatio(source) <= behavior.fleeHealthRatio &&
    getHealthRatio(attacker) > SPARE_A_WEAKENED_ATTACKER_HEALTH_RATIO &&
    !shouldStandGroundFromMorale(source)
  )
}

function isSurrenderEligible(source: CombatEntity, attacker?: CombatEntity | null): boolean {
  if (isLeaderUnit(source)) return false
  if (
    !attacker ||
    attacker.family !== FAMILY_TYPES.unit ||
    !attacker.owner ||
    !source.owner?.isEnemy?.(attacker.owner as never)
  ) {
    return false
  }
  return source.type === UNIT_TYPES.villager || canAttack(source)
}

function combatWeight(entity: CombatEntity): number {
  const hp = Math.max(0, entity.hitPoints ?? entity.totalHitPoints ?? 0)
  const weaponPower = Math.max(0, getEntityWeaponPower(entity as Parameters<typeof getEntityWeaponPower>[0]))
  const armor = Math.max(0, entity.meleeArmor ?? 0) + Math.max(0, entity.pierceArmor ?? 0)
  const buildingBias = entity.family === FAMILY_TYPES.building ? 1.35 : 1
  return (hp + weaponPower * 8 + armor * 4) * buildingBias
}

function belongsToSameSide(source: CombatEntity, target: CombatEntity): boolean {
  if (!source.owner || !target.owner) return false
  if (source.owner.label === target.owner.label) return true
  return source.owner.isEnemy?.(target.owner as never) === false
}

function isEnemyOf(source: CombatEntity, target: CombatEntity): boolean {
  return Boolean(source.owner && target.owner && source.owner.isEnemy?.(target.owner as never))
}

function addUniqueCombatant(list: CombatEntity[], entity?: CombatEntity | null): void {
  if (!entity || entity.isDead || entity.isDestroyed || (entity.hitPoints ?? 0) <= 0) return
  if (!list.includes(entity)) list.push(entity)
}

function nearbyCombatants(
  source: CombatEntity,
  attacker?: CombatEntity | null
): { allies: CombatEntity[]; enemies: CombatEntity[] } {
  const allies: CombatEntity[] = []
  const enemies: CombatEntity[] = []
  addUniqueCombatant(allies, source)
  if (attacker && isEnemyOf(source, attacker)) addUniqueCombatant(enemies, attacker)

  const map = getCombatEntitySpaceMap(source)
  const buckets = map?.instanceBuckets ?? source.context?.map?.instanceBuckets
  const sourceI = source.i
  const sourceJ = source.j
  if (!buckets || sourceI == null || sourceJ == null || !buckets.length || !buckets[0]?.length)
    return { allies, enemies }

  const bucketSize = BUCKET_SIZE || 8
  const radiusSq = MORALE_SCAN_RADIUS * MORALE_SCAN_RADIUS
  const minBi = Math.max(Math.floor((sourceI - MORALE_SCAN_RADIUS) / bucketSize), 0)
  const maxBi = Math.min(Math.floor((sourceI + MORALE_SCAN_RADIUS) / bucketSize), buckets.length - 1)
  const minBj = Math.max(Math.floor((sourceJ - MORALE_SCAN_RADIUS) / bucketSize), 0)
  const maxBj = Math.min(Math.floor((sourceJ + MORALE_SCAN_RADIUS) / bucketSize), buckets[0].length - 1)

  for (let bi = minBi; bi <= maxBi; bi++) {
    for (let bj = minBj; bj <= maxBj; bj++) {
      for (const target of buckets[bi][bj]) {
        if (!target || target === source || target.isDead || target.isDestroyed || (target.hitPoints ?? 0) <= 0)
          continue
        if (target.family !== FAMILY_TYPES.unit && target.family !== FAMILY_TYPES.building) continue
        if (target.i == null || target.j == null) continue
        const di = target.i - sourceI
        const dj = target.j - sourceJ
        if (di * di + dj * dj > radiusSq) continue
        if (belongsToSameSide(source, target)) addUniqueCombatant(allies, target)
        else if (isEnemyOf(source, target)) addUniqueCombatant(enemies, target)
      }
    }
  }

  return { allies, enemies }
}

function hasEscapeCell(source: CombatEntity, attacker?: CombatEntity | null): boolean {
  const map = getCombatEntitySpaceMap(source)
  const grid = map?.grid ?? source.context?.map?.grid
  if (!grid || source.i == null || source.j == null || attacker?.i == null || attacker?.j == null) return true
  const di = source.i - attacker.i
  const dj = source.j - attacker.j
  const len = Math.sqrt(di * di + dj * dj) || 1
  const maxDist = Math.max(2, Math.min(source.i + source.j + 1, grid.length, MORALE_SCAN_RADIUS))
  for (let dist = 1; dist <= maxDist; dist++) {
    const ti = Math.round(source.i + (di / len) * dist)
    const tj = Math.round(source.j + (dj / len) * dist)
    const cell = grid[ti]?.[tj]
    if (cell && cell.category !== 'Water' && !cell.solid && !cell.border) return true
  }
  return false
}

function shouldSurrenderWhenAttacked(source: CombatEntity, attacker?: CombatEntity | null): boolean {
  if (!isSurrenderEligible(source, attacker)) return false
  if (shouldStandGroundFromMorale(source)) return false
  const healthRatio = getHealthRatio(source)
  const surrenderHealth =
    source.category === 'Civilian' && !isLeaderUnit(source)
      ? CIVILIAN_SURRENDER_HEALTH_RATIO
      : SOLDIER_SURRENDER_HEALTH_RATIO
  if (healthRatio > surrenderHealth) return false

  const { allies, enemies } = nearbyCombatants(source, attacker)
  const allyPower = Math.max(
    1,
    allies.reduce((total, entity) => total + combatWeight(entity), 0)
  )
  const enemyPower = enemies.reduce((total, entity) => total + combatWeight(entity), 0)
  const outnumbered = enemies.length >= allies.length + 2
  const outpowered = enemyPower >= allyPower * 2.1
  const crushed = healthRatio <= surrenderHealth * 0.6 && enemyPower >= allyPower * 1.35

  return !hasEscapeCell(source, attacker) && (crushed || outnumbered || outpowered)
}

export function evaluateCombatMorale(
  source?: CombatEntity | null,
  attacker?: CombatEntity | null
): CombatMoraleDecision {
  if (!source) return 'fight'
  if (shouldSurrenderWhenAttacked(source, attacker)) return 'surrender'
  if (source.category === 'Civilian' && !isLeaderUnit(source)) {
    return canAttack(source) && isCriticallyOutmatched(source, attacker) ? 'flee' : 'fight'
  }
  return canAttack(source) && isCriticallyOutmatched(source, attacker) ? 'flee' : 'fight'
}
