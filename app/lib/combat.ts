import {
  ACTION_TYPES,
  BUCKET_SIZE,
  FAMILY_TYPES,
  MINING_RESOURCE_CONFIG,
  RESOURCE_TYPES,
  UNIT_TYPES,
} from '../constants'
import { getEntityWeaponPower, UNARMED_UNIT_WEAPON_POWER } from './equipmentStats'
import { angleDelta, getPointsDegree } from './maths'
import { canUpgradeUnitAtBuilding } from './unitUpgrades'
import type { ConfigValue } from '../types/config'
import type { PlayerLike } from '../types/player'

export type CombatEntity = {
  allowAction?: string[]
  category?: string
  degree?: number
  family?: string
  hitPoints?: number
  isBuilt?: boolean
  isDead?: boolean
  isDestroyed?: boolean
  isUsedBy?: CombatEntity | null
  loading?: number | null
  equipment?: string[]
  meleeArmor?: number
  owner?: PlayerLike | null
  pierceArmor?: number
  quantity?: number
  totalHitPoints?: number
  type?: string
  units?: string[]
  trainingType?: string | null
  trainingUnit?: CombatEntity | null
  heroDefenseActive?: boolean
  showHeroDefenseFlash?: () => void
  sprite?: unknown
  context?: {
    map?: {
      grid?: Array<Array<{ border?: boolean; category?: string; solid?: boolean }>>
      instanceBuckets?: Array<Array<Set<CombatEntity>>> | null
    }
  }
  x?: number
  y?: number
  i?: number
  j?: number
}

export type CombatDamageType = 'melee' | 'pierce'

export type Condition = {
  key: string
  op: '=' | '!=' | '<' | '<=' | '>=' | '>' | 'includes' | 'notincludes'
  value: ConfigValue
}

export type ActionProps = {
  buildingTypes?: string[]
  trainingType?: string
}

type MiningActionConfig = {
  action: string
}

function getMiningActionEntries(): Array<[string, MiningActionConfig]> {
  const config = MINING_RESOURCE_CONFIG ?? {
    [RESOURCE_TYPES.stone]: { action: ACTION_TYPES.minestone },
    [RESOURCE_TYPES.gold]: { action: ACTION_TYPES.minegold },
  }
  return Object.entries(config)
    .filter(([resourceType, entry]) => Boolean(resourceType && entry?.action))
    .map(([resourceType, entry]) => [resourceType, { action: entry.action }])
}

function canAttack(source?: CombatEntity | null): boolean {
  return getEntityWeaponPower(source) > 0
}

function canAttackResource(source?: CombatEntity | null, target?: CombatEntity | null): boolean {
  return (
    target?.family === FAMILY_TYPES.resource &&
    target.type === RESOURCE_TYPES.berrybush &&
    getEntityWeaponPower(source) > UNARMED_UNIT_WEAPON_POWER
  )
}

export function isFriendlyTarget(source?: CombatEntity | null, target?: CombatEntity | null): boolean {
  if (!source?.owner || !target?.owner) return false
  if (source.owner.label === target.owner.label) return true
  return source.owner.isEnemy?.(target.owner) === false
}

const COMBATANT_FLEE_HEALTH_RATIO = 0.3
const SPARE_A_WEAKENED_ATTACKER_HEALTH_RATIO = 0.4
const MORALE_SCAN_RADIUS = 6
const CIVILIAN_SURRENDER_HEALTH_RATIO = 0.28
const SOLDIER_SURRENDER_HEALTH_RATIO = 0.18

export type CombatMoraleDecision = 'fight' | 'flee' | 'surrender'

function getHealthRatio(entity?: CombatEntity | null): number {
  const total = entity?.totalHitPoints ?? 0
  if (total <= 0) return 1
  return Math.max(0, Math.min(1, (entity?.hitPoints ?? total) / total))
}

// Heroes/chiefs are combat-capable Civilians (they lead from the front), so they
// don't get the villager/priest "flee from anything that fights back" treatment.
function isLeaderUnit(source: CombatEntity): boolean {
  return source.type === UNIT_TYPES.hero || source.type === UNIT_TYPES.chief
}

// Badly hurt and the thing fighting it is still dangerous: retreat. But finishing off
// an attacker that's nearly dead itself beats running from it (e.g. a villager mid-hunt
// on an almost-dead animal, or a soldier one hit away from winning a duel).
function isCriticallyOutmatched(source: CombatEntity, attacker?: CombatEntity | null): boolean {
  return (
    getHealthRatio(source) <= COMBATANT_FLEE_HEALTH_RATIO &&
    getHealthRatio(attacker) > SPARE_A_WEAKENED_ATTACKER_HEALTH_RATIO
  )
}

export function shouldFleeWhenAttacked(source?: CombatEntity | null, attacker?: CombatEntity | null): boolean {
  return evaluateCombatMorale(source, attacker) === 'flee'
}

function isSurrenderEligible(source: CombatEntity, attacker?: CombatEntity | null): boolean {
  if (isLeaderUnit(source)) return false
  if (
    !attacker ||
    attacker.family !== FAMILY_TYPES.unit ||
    !attacker.owner ||
    !source.owner?.isEnemy?.(attacker.owner)
  ) {
    return false
  }
  return source.type === UNIT_TYPES.villager || canAttack(source)
}

function combatWeight(entity: CombatEntity): number {
  const hp = Math.max(0, entity.hitPoints ?? entity.totalHitPoints ?? 0)
  const weaponPower = Math.max(0, getEntityWeaponPower(entity))
  const armor = Math.max(0, entity.meleeArmor ?? 0) + Math.max(0, entity.pierceArmor ?? 0)
  const buildingBias = entity.family === FAMILY_TYPES.building ? 1.35 : 1
  return (hp + weaponPower * 8 + armor * 4) * buildingBias
}

function belongsToSameSide(source: CombatEntity, target: CombatEntity): boolean {
  if (!source.owner || !target.owner) return false
  if (source.owner.label === target.owner.label) return true
  return source.owner.isEnemy?.(target.owner) === false
}

function isEnemyOf(source: CombatEntity, target: CombatEntity): boolean {
  return Boolean(source.owner && target.owner && source.owner.isEnemy?.(target.owner))
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

  const buckets = source.context?.map?.instanceBuckets
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
  const grid = source.context?.map?.grid
  if (!grid || source.i == null || source.j == null || attacker?.i == null || attacker?.j == null) return true
  const di = source.i - attacker.i
  const dj = source.j - attacker.j
  const len = Math.sqrt(di * di + dj * dj) || 1
  const maxDist = Math.max(
    2,
    Math.min(source.i + source.j + 1, source.context?.map?.grid?.length ?? 2, MORALE_SCAN_RADIUS)
  )
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
    return attacker?.family !== FAMILY_TYPES.animal || isCriticallyOutmatched(source, attacker) ? 'flee' : 'fight'
  }
  return canAttack(source) && isCriticallyOutmatched(source, attacker) ? 'flee' : 'fight'
}

function canConvert(source?: CombatEntity | null, target?: CombatEntity | null): boolean {
  if (!source || source.type !== UNIT_TYPES.priest || !target || !source.owner?.isEnemy?.(target.owner)) return false
  if (target.family === FAMILY_TYPES.unit && target.type !== UNIT_TYPES.priest) return true
  const hasMonotheism = source.owner.technologies?.includes('Monotheism')
  return !!hasMonotheism && (target.family === FAMILY_TYPES.building || target.type === UNIT_TYPES.priest)
}

function isVillagerOrHero(source?: CombatEntity | null): boolean {
  return source?.type === UNIT_TYPES.villager || source?.type === UNIT_TYPES.hero
}

export function isWheatMature(target?: CombatEntity | null): boolean {
  if (!target || target.type !== RESOURCE_TYPES.wheat) return false
  const sprite = target.sprite as { currentFrame?: number; textures?: unknown[] } | null | undefined
  if (
    !sprite ||
    typeof sprite.currentFrame !== 'number' ||
    !Array.isArray(sprite.textures) ||
    !sprite.textures.length
  ) {
    return false
  }
  return sprite.currentFrame >= sprite.textures.length - 1
}

function ownerHasTechnology(source: CombatEntity, technology: string): boolean {
  return Boolean(source.owner?.technologies?.includes(technology))
}

function getArmorForDamageType(target: CombatEntity, damageType: CombatDamageType): number {
  return damageType === 'pierce' ? (target.pierceArmor ?? 0) : (target.meleeArmor ?? 0)
}

function getDamage(
  source: CombatEntity,
  target: CombatEntity,
  damageType: CombatDamageType,
  baseDamage = getEntityWeaponPower(source)
): number {
  const weaponPower = baseDamage
  const armor = Math.max(0, getArmorForDamageType(target, damageType))
  const minimumDamage = weaponPower <= UNARMED_UNIT_WEAPON_POWER ? UNARMED_UNIT_WEAPON_POWER : 1
  return Math.max(minimumDamage, weaponPower - armor)
}

// Hero defense only blocks what it's actually facing — a hit landing outside this frontal
// arc (e.g. from behind) goes through untouched even while heroDefenseActive is true.
const HERO_DEFENSE_FRONTAL_HALF_ANGLE = 90

function isOutsideHeroDefenseArc(source: CombatEntity, target: CombatEntity): boolean {
  const { x: sx, y: sy } = source
  const { x: tx, y: ty, degree } = target
  if (sx == null || sy == null || tx == null || ty == null) return false
  const attackAngle = getPointsDegree(tx, ty, sx, sy)
  return angleDelta(attackAngle, degree ?? 0) > HERO_DEFENSE_FRONTAL_HALF_ANGLE
}

function applyHeroDefenseDamage(source: CombatEntity, target: CombatEntity, damage: number): number {
  if (!target.heroDefenseActive || damage <= 0 || isOutsideHeroDefenseArc(source, target)) return damage
  target.showHeroDefenseFlash?.()
  return 0
}

export function getHitPointsWithDamage(
  source: CombatEntity,
  target: CombatEntity,
  defaultDamage?: number,
  bonusDamage = 0,
  damageType: CombatDamageType = 'melee'
): number {
  if (isFriendlyTarget(source, target)) return target.hitPoints ?? 0
  const rawDamage = getDamage(source, target, damageType, defaultDamage) + Math.max(0, bonusDamage)
  const damage = applyHeroDefenseDamage(source, target, rawDamage)
  return Math.max(0, (target.hitPoints ?? 0) - damage)
}

const arraysEqual = (a: readonly ConfigValue[], b: readonly ConfigValue[]): boolean => {
  if (a.length !== b.length) return false
  const sortedA = a.slice().sort()
  const sortedB = b.slice().sort()
  return sortedA.every((val, index) => val === sortedB[index])
}

export const isValidCondition = (condition: Condition | null | undefined, values: object): boolean => {
  if (!condition) return true

  const { op, key, value } = condition
  const expectedValue = (values as Record<string, ConfigValue>)[key]

  if (expectedValue === undefined) {
    throw new Error(`Key not found in values: ${key}`)
  }

  switch (op) {
    case '=':
    case '!=': {
      const result =
        Array.isArray(value) && Array.isArray(expectedValue)
          ? arraysEqual(value, expectedValue)
          : value === expectedValue
      return op === '!=' ? !result : result
    }
    case '<':
      return Number(expectedValue) < Number(value)
    case '<=':
      return Number(expectedValue) <= Number(value)
    case '>=':
      return Number(expectedValue) >= Number(value)
    case '>':
      return Number(expectedValue) > Number(value)
    case 'includes':
      return Array.isArray(expectedValue) && expectedValue.includes(value)
    case 'notincludes':
      return Array.isArray(expectedValue) && !expectedValue.includes(value)
    default:
      throw new Error(`Invalid condition operation provided: ${op}`)
  }
}

export const getActionCondition = (
  source: CombatEntity,
  target: CombatEntity,
  action: string | undefined,
  props?: ActionProps
): boolean => {
  if (!action) return false

  const conditions: Record<string, (props?: ActionProps) => boolean> = {
    delivery: props =>
      Boolean(
        (source.loading ?? 0) > 0 &&
          (target.hitPoints ?? 0) > 0 &&
          target.isBuilt &&
          (!props || props.buildingTypes?.includes(target.type ?? ''))
      ),
    takemeat: () =>
      Boolean(
        isVillagerOrHero(source) &&
          target.family === FAMILY_TYPES.animal &&
          (target.quantity ?? 0) > 0 &&
          target.isDead &&
          !target.isDestroyed
      ),
    hunt: () =>
      isVillagerOrHero(source) &&
      target.family === FAMILY_TYPES.animal &&
      (target.quantity ?? 0) > 0 &&
      (target.hitPoints ?? 0) > 0 &&
      !target.isDead,
    chopwood: () =>
      isVillagerOrHero(source) && target.type === RESOURCE_TYPES.tree && (target.quantity ?? 0) > 0 && !target.isDead,
    farm: () =>
      isVillagerOrHero(source) &&
      ownerHasTechnology(source, 'Farming') &&
      target.type === RESOURCE_TYPES.wheat &&
      isWheatMature(target) &&
      (target.quantity ?? 0) > 0 &&
      (source.type === UNIT_TYPES.hero || !target.isUsedBy || target.isUsedBy === source) &&
      !target.isDead,
    forageberry: () =>
      isVillagerOrHero(source) &&
      target.type === RESOURCE_TYPES.berrybush &&
      (target.quantity ?? 0) > 0 &&
      !target.isDead,
    ...Object.fromEntries(
      getMiningActionEntries().map(([resourceType, config]) => [
        config.action,
        () =>
          isVillagerOrHero(source) &&
          ownerHasTechnology(source, 'Pickaxe') &&
          target.type === resourceType &&
          (target.quantity ?? 0) > 0 &&
          !target.isDead,
      ])
    ),
    build: () =>
      isVillagerOrHero(source) &&
      target.owner?.label === source.owner?.label &&
      target.family === FAMILY_TYPES.building &&
      (target.hitPoints ?? 0) > 0 &&
      (!target.isBuilt || (target.hitPoints ?? 0) < (target.totalHitPoints ?? 0)) &&
      !target.isDead,
    attack: () =>
      Boolean(
        canAttack(source) &&
          target &&
          !isFriendlyTarget(source, target) &&
          (source.owner?.isEnemy?.(target.owner) || canAttackResource(source, target)) &&
          ([FAMILY_TYPES.building, FAMILY_TYPES.unit, FAMILY_TYPES.animal].includes(target.family ?? '') ||
            canAttackResource(source, target)) &&
          (target.hitPoints ?? 0) > 0 &&
          !target.isDead
      ),
    train: props =>
      Boolean(
        target &&
          (source.type === UNIT_TYPES.villager ||
            canUpgradeUnitAtBuilding(target.type, source.type, props?.trainingType)) &&
          target.family === FAMILY_TYPES.building &&
          target.owner?.label === source.owner?.label &&
          target.isBuilt &&
          (target.hitPoints ?? 0) > 0 &&
          !target.isDead &&
          Array.isArray(target.units) &&
          !!props?.trainingType &&
          target.units.includes(props.trainingType)
      ),
    heal: () =>
      target &&
      target.owner?.label === source.owner?.label &&
      target.family === FAMILY_TYPES.unit &&
      (target.hitPoints ?? 0) > 0 &&
      (target.hitPoints ?? 0) < (target.totalHitPoints ?? 0) &&
      !target.isDead,
    convert: () => canConvert(source, target) && (target.hitPoints ?? 0) > 0 && !target.isDead,
  }
  return Boolean(
    target && target !== source && (source.hitPoints ?? 0) > 0 && !source.isDead && conditions[action]?.(props)
  )
}
