import { BUILDING_TYPES, FAMILY_TYPES, RESOURCE_TYPES, UNIT_TYPES } from '../constants'
import type { PlayerLike } from '../types/player'

type OwnerLike = {
  isEnemy?: (owner?: PlayerLike | null) => boolean
  label?: string
  technologies?: string[]
}

type CombatEntity = {
  allowAction?: string[]
  category?: string
  family?: string
  hitPoints?: number
  isBuilt?: boolean
  isDead?: boolean
  isDestroyed?: boolean
  isUsedBy?: unknown
  loading?: number | null
  meleeArmor?: number
  meleeAttack?: number
  owner?: PlayerLike | null
  pierceArmor?: number
  pierceAttack?: number
  quantity?: number
  totalHitPoints?: number
  transportCapacity?: number
  transportedUnits?: CombatEntity[]
  type?: string
}

export type Condition = {
  key: string
  op: '=' | '!=' | '<' | '<=' | '>=' | '>' | 'includes' | 'notincludes'
  value: unknown
}

type ActionProps = {
  buildingTypes?: string[]
}

function canAttack(source?: CombatEntity | null): boolean {
  return Boolean(source && ((source.meleeAttack || 0) > 0 || (source.pierceAttack || 0) > 0))
}

export function shouldFleeWhenAttacked(source?: CombatEntity | null): boolean {
  return source?.category === 'Boat' && !canAttack(source)
}

function canConvert(source?: CombatEntity | null, target?: CombatEntity | null): boolean {
  if (!source || source.type !== UNIT_TYPES.priest || !target || !source.owner?.isEnemy?.(target.owner)) return false
  if (target.family === FAMILY_TYPES.unit && target.type !== UNIT_TYPES.priest) return true
  const hasMonotheism = source.owner.technologies?.includes('Monotheism')
  return !!hasMonotheism && (target.family === FAMILY_TYPES.building || target.type === UNIT_TYPES.priest)
}

function canLoadTransport(source?: CombatEntity | null, target?: CombatEntity | null): boolean {
  const cargo = Array.isArray(target?.transportedUnits) ? target.transportedUnits : []
  const load = cargo.filter(unit => unit && !unit.isDead && !unit.isDestroyed).length
  return Boolean(
    source &&
      target &&
      source !== target &&
      source.family === FAMILY_TYPES.unit &&
      target.family === FAMILY_TYPES.unit &&
      source.owner?.label === target.owner?.label &&
      source.category !== 'Boat' &&
      source.type !== UNIT_TYPES.fishingBoat &&
      (target.transportCapacity ?? 0) > 0 &&
      load < (target.transportCapacity ?? 0)
  )
}

function getDamage(source: CombatEntity, target: CombatEntity): number {
  const meleeAttack = source.meleeAttack || 0
  const pierceAttack = source.pierceAttack || 0
  const meleeArmor = target.meleeArmor || 0
  const pierceArmor = target.pierceArmor || 0
  return Math.max(1, Math.max(0, meleeAttack - meleeArmor) + Math.max(0, pierceAttack - pierceArmor))
}

export function getHitPointsWithDamage(source: CombatEntity, target: CombatEntity, defaultDamage?: number): number {
  const damage = defaultDamage || getDamage(source, target)
  return Math.max(0, (target.hitPoints ?? 0) - damage)
}

const arraysEqual = (a: unknown, b: unknown): boolean => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  if (a.length !== b.length) return false
  const sortedA = a.slice().sort()
  const sortedB = b.slice().sort()
  return sortedA.every((val, index) => val === sortedB[index])
}

export const isValidCondition = (condition: Condition | null | undefined, values: object): boolean => {
  if (!condition) return true

  const { op, key, value } = condition
  const expectedValue = (values as Record<string, unknown>)[key]

  if (expectedValue === undefined) {
    throw new Error(`Key not found in values: ${key}`)
  }

  switch (op) {
    case '=':
    case '!=': {
      const result = Array.isArray(value) ? arraysEqual(value, expectedValue) : value === expectedValue
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
        source.type === UNIT_TYPES.villager &&
          target.family === FAMILY_TYPES.animal &&
          (target.quantity ?? 0) > 0 &&
          target.isDead &&
          !target.isDestroyed
      ),
    fishing: () =>
      target.category === 'Fish' &&
      !!target.allowAction?.includes(source.type ?? '') &&
      (target.quantity ?? 0) > 0 &&
      !target.isDestroyed,
    hunt: () =>
      source.type === UNIT_TYPES.villager &&
      target.family === FAMILY_TYPES.animal &&
      (target.quantity ?? 0) > 0 &&
      (target.hitPoints ?? 0) > 0 &&
      !target.isDead,
    chopwood: () =>
      source.type === UNIT_TYPES.villager &&
      target.type === RESOURCE_TYPES.tree &&
      (target.quantity ?? 0) > 0 &&
      !target.isDead,
    farm: () =>
      source.type === UNIT_TYPES.villager &&
      target.type === BUILDING_TYPES.farm &&
      (target.hitPoints ?? 0) > 0 &&
      target.owner?.label === source.owner?.label &&
      (target.quantity ?? 0) > 0 &&
      (!target.isUsedBy || target.isUsedBy === source) &&
      !target.isDead,
    forageberry: () =>
      source.type === UNIT_TYPES.villager &&
      target.type === RESOURCE_TYPES.berrybush &&
      (target.quantity ?? 0) > 0 &&
      !target.isDead,
    minestone: () =>
      source.type === UNIT_TYPES.villager &&
      target.type === RESOURCE_TYPES.stone &&
      (target.quantity ?? 0) > 0 &&
      !target.isDead,
    minegold: () =>
      source.type === UNIT_TYPES.villager &&
      target.type === RESOURCE_TYPES.gold &&
      (target.quantity ?? 0) > 0 &&
      !target.isDead,
    build: () =>
      source.type === UNIT_TYPES.villager &&
      target.owner?.label === source.owner?.label &&
      target.family === FAMILY_TYPES.building &&
      (target.hitPoints ?? 0) > 0 &&
      (!target.isBuilt || (target.hitPoints ?? 0) < (target.totalHitPoints ?? 0)) &&
      !target.isDead,
    attack: () =>
      Boolean(
        canAttack(source) &&
          target &&
          source.owner?.isEnemy?.(target.owner) &&
          [FAMILY_TYPES.building, FAMILY_TYPES.unit, FAMILY_TYPES.animal].includes(target.family ?? '') &&
          (target.hitPoints ?? 0) > 0 &&
          !target.isDead
      ),
    heal: () =>
      target &&
      target.owner?.label === source.owner?.label &&
      target.family === FAMILY_TYPES.unit &&
      (target.hitPoints ?? 0) > 0 &&
      (target.hitPoints ?? 0) < (target.totalHitPoints ?? 0) &&
      !target.isDead,
    convert: () => canConvert(source, target) && (target.hitPoints ?? 0) > 0 && !target.isDead,
    loadTransport: () => canLoadTransport(source, target),
  }
  return Boolean(
    target && target !== source && (source.hitPoints ?? 0) > 0 && !source.isDead && conditions[action]?.(props)
  )
}
