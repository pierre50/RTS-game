import { accelerator } from '../constants'

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

export const timeoutRecurs = (second, condition, callback) => {
  if (condition()) {
    setTimeout(() => {
      if (condition()) {
        callback()
        timeoutRecurs(second, condition, callback)
      }
    }, (second * 1000) / 100 / accelerator)
  }
}

export const getActionCondition = (source, target, action, props = {}) => {
  if (!action) {
    return false
  }
  const conditions = {
    delivery: props =>
      target.life > 0 &&
      target.isBuilt &&
      (target.type === 'TownCenter' || target.type === props.buildingType),
    takemeat: () =>
      source.type === 'Villager' &&
      target.name === 'animal' &&
      target.quantity > 0 &&
      target.isDead &&
      !target.isDestroyed,
    hunt: () => source.type === 'Villager' && target.name === 'animal' && target.quantity > 0 && !target.isDead,
    chopwood: () => source.type === 'Villager' && target.type === 'Tree' && target.quantity > 0 && !target.isDestroyed,
    farm: () =>
      source.type === 'Villager' &&
      target.type === 'Farm' &&
      target.life > 0 &&
      target.owner === source.owner &&
      target.quantity > 0 &&
      (!target.isUsedBy || target.isUsedBy === source) &&
      !target.isDead,
    forageberry: () =>
      source.type === 'Villager' && target.type === 'Berrybush' && target.quantity > 0 && !target.isDestroyed,
    minestone: () =>
      source.type === 'Villager' && target.type === 'Stone' && target.quantity > 0 && !target.isDestroyed,
    minegold: () => source.type === 'Villager' && target.type === 'Gold' && target.quantity > 0 && !target.isDestroyed,
    build: () =>
      source.type === 'Villager' &&
      target.owner === source.owner &&
      target.name === 'building' &&
      target.life > 0 &&
      (!target.isBuilt || target.life < target.lifeMax) &&
      !target.isDead,
    attack: () =>
      target &&
      target.owner !== source.owner &&
      (target.name === 'building' || target.name === 'unit' || target.name === 'animal') &&
      target.life > 0 &&
      !target.isDead,
  }
  return target && source.life > 0 && !source.isDead && conditions[action](props)
}
