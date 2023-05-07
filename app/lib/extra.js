export function throttle(callback, wait, immediate = false) {
  let timeout = null
  let initialCall = true

  return function () {
    const callNow = immediate && initialCall
    const next = () => {
      callback.apply(this, arguments)
      timeout = null
    }

    if (callNow) {
      initialCall = false
      next()
    }

    if (!timeout) {
      timeout = setTimeout(next, wait)
    }
  }
}

export const debounce = (callback, wait) => {
  let timeoutId = null
  return function () {
    window.clearTimeout(timeoutId)
    timeoutId = window.setTimeout(() => {
      callback.apply(this, arguments)
    }, wait)
  }
}

export function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

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

export const updateObject = (target, operation) => {
  function setToValue(obj, value, path) {
    var i
    path = path.split('.')
    for (i = 0; i < path.length - 1; i++) obj = obj[path[i]]

    obj[path[i]] = value
  }
  const result = operation.key.split('.').reduce((previous, current) => previous[current], target)
  switch (operation.op) {
    case '*':
      setToValue(target, result * Number(operation.value), operation.key)
      break
    case '+':
      setToValue(target, result + Number(operation.value), operation.key)
      break
  }
}
export const isValidCondition = (condition, values) => {
  if (!condition) {
    return true
  }

  const { op, key, value } = condition
  const exceptedValue = values[key]

  switch (op) {
    case '=':
    case '!=': {
      const result = Array.isArray(value)
        ? JSON.stringify(value.sort()) === JSON.stringify(exceptedValue).sort()
        : value === exceptedValue

      return op === '!=' ? !result : result
    }
    case '<':
      return exceptedValue < value
    case '<=':
      return exceptedValue <= value
    case '>=':
      return exceptedValue >= value
    case '>':
      return exceptedValue > value
    case 'includes':
      return exceptedValue.includes(value)
    case 'notincludes':
      return !exceptedValue.includes(value)
    default:
      throw new Error(`Invalid condition operation provided (${op})`)
  }
}

export const getActionCondition = (source, target, action, props) => {
  if (!action) {
    return false
  }
  const conditions = {
    delivery: props =>
      source.loading > 0 && 
      target.hitPoints > 0 &&
      target.isBuilt &&
      (target.type === 'TownCenter' || (!props ? true : props.buildingType && target.type === props.buildingType)),
    takemeat: () =>
      source.type === 'Villager' &&
      target.name === 'animal' &&
      target.quantity > 0 &&
      target.isDead &&
      !target.isDestroyed,
    hunt: () =>
      source.type === 'Villager' &&
      target.name === 'animal' &&
      target.quantity > 0 &&
      target.hitPoints > 0 &&
      !target.isDead,
    chopwood: () => source.type === 'Villager' && target.type === 'Tree' && target.quantity > 0 && !target.isDead,
    farm: () =>
      source.type === 'Villager' &&
      target.type === 'Farm' &&
      target.hitPoints > 0 &&
      target.owner === source.owner &&
      target.quantity > 0 &&
      (!target.isUsedBy || target.isUsedBy === source) &&
      !target.isDead,
    forageberry: () =>
      source.type === 'Villager' && target.type === 'Berrybush' && target.quantity > 0 && !target.isDead,
    minestone: () => source.type === 'Villager' && target.type === 'Stone' && target.quantity > 0 && !target.isDead,
    minegold: () => source.type === 'Villager' && target.type === 'Gold' && target.quantity > 0 && !target.isDead,
    build: () =>
      source.type === 'Villager' &&
      target.owner === source.owner &&
      target.name === 'building' &&
      target.hitPoints > 0 &&
      (!target.isBuilt || target.hitPoints < target.totalHitPoints) &&
      !target.isDead,
    attack: () =>
      target &&
      target.owner !== source.owner &&
      (target.name === 'building' || target.name === 'unit' || target.name === 'animal') &&
      target.hitPoints > 0 &&
      !target.isDead,
    heal: () =>
      target &&
      target.owner === source.owner &&
      target.name === 'unit' &&
      target.hitPoints > 0 &&
      target.hitPoints < target.totalHitPoints &&
      !target.isDead,
  }
  return target && target !== source && source.hitPoints > 0 && !source.isDead && conditions[action](props)
}
