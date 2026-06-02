import { BUILDING_TYPES, FAMILY_TYPES, RESOURCE_TYPES, UNIT_TYPES } from '../constants'

export function getDamage(source, target) {
  const meleeAttack = source.meleeAttack || 0
  const pierceAttack = source.pierceAttack || 0
  const meleeArmor = target.meleeArmor || 0
  const pierceArmor = target.pierceArmor || 0
  return Math.max(1, Math.max(0, meleeAttack - meleeArmor) + Math.max(0, pierceAttack - pierceArmor))
}

export function getHitPointsWithDamage(source, target, defaultDamage) {
  const damage = defaultDamage || getDamage(source, target)
  return Math.max(0, target.hitPoints - damage)
}

const arraysEqual = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  if (a.length !== b.length) return false
  const sortedA = a.slice().sort()
  const sortedB = b.slice().sort()
  return sortedA.every((val, index) => val === sortedB[index])
}

export const isValidCondition = (condition, values) => {
  if (!condition) return true

  const { op, key, value } = condition
  const expectedValue = values[key]

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
      return expectedValue < value
    case '<=':
      return expectedValue <= value
    case '>=':
      return expectedValue >= value
    case '>':
      return expectedValue > value
    case 'includes':
      return expectedValue.includes(value)
    case 'notincludes':
      return !expectedValue.includes(value)
    default:
      throw new Error(`Invalid condition operation provided: ${op}`)
  }
}

export const getActionCondition = (source, target, action, props) => {
  if (!action) return false

  const conditions = {
    delivery: props =>
      source.loading > 0 &&
      target.hitPoints > 0 &&
      target.isBuilt &&
      (!props || props.buildingTypes.includes(target.type)),
    takemeat: () =>
      source.type === UNIT_TYPES.villager &&
      target.family === FAMILY_TYPES.animal &&
      target.quantity > 0 &&
      target.isDead &&
      !target.isDestroyed,
    fishing: () =>
      target.category === 'Fish' &&
      target.allowAction.includes(source.type) &&
      target.quantity > 0 &&
      !target.isDestroyed,
    hunt: () =>
      source.type === UNIT_TYPES.villager &&
      target.family === FAMILY_TYPES.animal &&
      target.quantity > 0 &&
      target.hitPoints > 0 &&
      !target.isDead,
    chopwood: () =>
      source.type === UNIT_TYPES.villager &&
      target.type === RESOURCE_TYPES.tree &&
      target.quantity > 0 &&
      !target.isDead,
    farm: () =>
      source.type === UNIT_TYPES.villager &&
      target.type === BUILDING_TYPES.farm &&
      target.hitPoints > 0 &&
      target.owner?.label === source.owner.label &&
      target.quantity > 0 &&
      (!target.isUsedBy || target.isUsedBy === source) &&
      !target.isDead,
    forageberry: () =>
      source.type === UNIT_TYPES.villager &&
      target.type === RESOURCE_TYPES.berrybush &&
      target.quantity > 0 &&
      !target.isDead,
    minestone: () =>
      source.type === UNIT_TYPES.villager &&
      target.type === RESOURCE_TYPES.stone &&
      target.quantity > 0 &&
      !target.isDead,
    minegold: () =>
      source.type === UNIT_TYPES.villager &&
      target.type === RESOURCE_TYPES.gold &&
      target.quantity > 0 &&
      !target.isDead,
    build: () =>
      source.type === UNIT_TYPES.villager &&
      target.owner?.label === source.owner.label &&
      target.family === FAMILY_TYPES.building &&
      target.hitPoints > 0 &&
      (!target.isBuilt || target.hitPoints < target.totalHitPoints) &&
      !target.isDead,
    attack: () =>
      target &&
      source.owner?.isEnemy(target.owner) &&
      [FAMILY_TYPES.building, FAMILY_TYPES.unit, FAMILY_TYPES.animal].includes(target.family) &&
      target.hitPoints > 0 &&
      !target.isDead,
    heal: () =>
      target &&
      target.owner?.label === source.owner.label &&
      target.family === FAMILY_TYPES.unit &&
      target.hitPoints > 0 &&
      target.hitPoints < target.totalHitPoints &&
      !target.isDead,
  }
  return target && target !== source && source.hitPoints > 0 && !source.isDead && conditions[action](props)
}
