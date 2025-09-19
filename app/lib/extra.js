import { instanceIsInPlayerSight } from './grid'
import { degreeToDirection, uuidv4 } from './maths'

export function setUnitTexture(sheet, instance, ACCELERATOR) {
  const animationSpeed = {
    standingSheet: 0.15,
    corpseSheet: 0,
  }
  const { paused } = instance.context
  if (paused) {
    return
  }
  const sheetToReset = ['actionSheet', 'dyingSheet', 'corpseSheet']
  // Sheet don't exist we just block the current sheet
  if (!instance[sheet]) {
    if (instance.currentSheet !== 'walkingSheet' && instance.walkingSheet) {
      instance.sprite.textures = [instance.walkingSheet.textures[Object.keys(instance.walkingSheet.textures)[0]]]
    } else {
      instance.sprite.textures = [instance.sprite.textures[instance.sprite.currentFrame]]
    }
    instance.currentSheet = 'walkingSheet'
    instance.sprite.stop()
    instance.sprite.anchor.set(
      instance.sprite.textures[instance.sprite.currentFrame].defaultAnchor.x,
      instance.sprite.textures[instance.sprite.currentFrame].defaultAnchor.y
    )
    return
  }
  // Reset action loop
  if (!sheetToReset.includes(sheet)) {
    instance.sprite.onLoop = null
    instance.sprite.onFrameChange = null
  }
  const goto = instance.currentSheet === sheet && instance.sprite.currentFrame
  instance.currentSheet = sheet
  const direction = degreeToDirection(instance.degree)
  switch (direction) {
    case 'southest':
      instance.sprite.scale.x = -1
      instance.sprite.textures = instance[sheet].animations['southwest']
      break
    case 'northest':
      instance.sprite.scale.x = -1
      instance.sprite.textures = instance[sheet].animations['northwest']
      break
    case 'est':
      instance.sprite.scale.x = -1
      instance.sprite.textures = instance[sheet].animations['west']
      break
    default:
      instance.sprite.scale.x = 1
      instance.sprite.textures = instance[sheet].animations[direction]
  }
  instance.sprite.animationSpeed = (instance[sheet].data.animationSpeed ?? animationSpeed[sheet] ?? 0.3) * ACCELERATOR
  goto && goto < instance.sprite.textures.length ? instance.sprite.gotoAndPlay(goto) : instance.sprite.play()
}

/**
 * Filters an object by the specified keys.
 * @param {object} obj - The object to filter.
 * @param {Array<string>} keys - The keys to retain in the new object.
 * @returns {object} - The filtered object.
 */
export function filterObject(obj, keys) {
  if (typeof obj !== 'object' || obj === null) {
    throw new Error('Expected an object to filter.')
  }
  return keys.reduce((acc, key) => {
    if (obj.hasOwnProperty(key)) {
      acc[key] = obj[key]
    }
    return acc
  }, {})
}

/**
 * Modal constructor for displaying content in a modal dialog.
 * @param {HTMLElement} content - The content to display inside the modal.
 */
export var Modal = function (content) {
  if (!(content instanceof HTMLElement)) {
    throw new Error('Content must be an HTML element.')
  }

  const id = uuidv4()

  this.open = () => {
    const modal = document.createElement('div')
    modal.id = id
    modal.className = 'modal'

    const modalContent = document.createElement('div')
    modalContent.className = 'modal-content'
    modalContent.appendChild(content)

    modal.appendChild(modalContent)
    document.body.appendChild(modal)
    return modal
  }

  this.close = () => {
    const modal = document.getElementById(id)
    if (modal) {
      modal.remove()
    }
  }

  this.open()
}

/**
 * Custom timeout implementation with pause and resume functionality.
 * @param {function} callback - The function to execute after the delay.
 * @param {number} delay - The delay in milliseconds.
 */
export var CustomTimeout = function (callback, delay) {
  if (typeof callback !== 'function' || typeof delay !== 'number') {
    throw new Error('Invalid arguments for CustomTimeout.')
  }

  let timerId,
    start,
    remaining = delay

  this.pause = () => {
    window.clearTimeout(timerId)
    timerId = null
    remaining -= Date.now() - start
    return remaining
  }

  this.resume = () => {
    if (timerId) {
      return // Already running
    }

    start = Date.now()
    timerId = window.setTimeout(callback, remaining)
  }

  this.reset = () => {
    this.pause()
    remaining = delay
    this.resume()
  }

  this.resume() // Start the timer immediately
}

/**
 * Throttles a function to ensure it only executes once within a specified time frame.
 * @param {Function} callback - The function to throttle.
 * @param {number} wait - The time frame in milliseconds to throttle calls.
 * @param {boolean} [immediate=false] - If true, trigger the function on the leading edge instead of the trailing.
 * @returns {Function} - The throttled function.
 */
export function throttle(callback, wait, immediate = false) {
  if (typeof callback !== 'function' || typeof wait !== 'number') {
    throw new Error('Invalid arguments: callback must be a function and wait must be a number.')
  }

  let timeout = null
  let initialCall = true

  return function (...args) {
    const callNow = immediate && initialCall

    const next = () => {
      callback.apply(this, args)
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

/**
 * Debounces a function to ensure it only executes after a specified delay.
 * @param {Function} callback - The function to debounce.
 * @param {number} wait - The delay in milliseconds before the function can be called again.
 * @returns {Function} - The debounced function.
 */
export const debounce = (callback, wait) => {
  if (typeof callback !== 'function' || typeof wait !== 'number') {
    throw new Error('Invalid arguments: callback must be a function and wait must be a number.')
  }

  let timeoutId = null
  return function (...args) {
    window.clearTimeout(timeoutId)
    timeoutId = window.setTimeout(() => {
      callback.apply(this, args)
    }, wait)
  }
}

/**
 * Maps loading types to their corresponding work roles.
 * @param {string} loadingType - The type of resource being loaded.
 * @returns {string} - The corresponding work role for the loading type.
 */
export function getWorkWithLoadingType(loadingType) {
  const workMapping = {
    wheat: 'farmer',
    wood: 'woodcutter',
    berry: 'forager',
    stone: 'stoneminer',
    gold: 'goldminer',
    meat: 'hunter',
    fish: 'fisher',
  }

  return workMapping[loadingType] || 'default' // Fallback to 'default' if loadingType is not found
}

/**
 * Capitalizes the first letter of a string.
 * @param {string} string - The input string to capitalize.
 * @returns {string} - The string with the first letter capitalized.
 */
export function capitalizeFirstLetter(string) {
  if (typeof string !== 'string') {
    throw new TypeError('Expected a string')
  }

  return string.length > 0 ? string.charAt(0).toUpperCase() + string.slice(1) : ''
}

/**
 * Calculates the damage dealt by a source to a target.
 * @param {object} source - The attacking unit with attack attributes.
 * @param {object} target - The defending unit with armor attributes.
 * @returns {number} The calculated damage, at least 1.
 */
export function getDamage(source, target) {
  const meleeAttack = source.meleeAttack || 0
  const pierceAttack = source.pierceAttack || 0
  const meleeArmor = target.meleeArmor || 0
  const pierceArmor = target.pierceArmor || 0

  // Calculate damage considering armor
  return Math.max(1, Math.max(0, meleeAttack - meleeArmor) + Math.max(0, pierceAttack - pierceArmor))
}

/**
 * Calculates the remaining hit points of a target after taking damage.
 * @param {object} source - The attacking unit (for damage calculation).
 * @param {object} target - The defending unit with hit points.
 * @param {number} [defaultDamage] - An optional damage value.
 * @returns {number} The remaining hit points of the target, at least 0.
 */
export function getHitPointsWithDamage(source, target, defaultDamage) {
  const damage = defaultDamage || getDamage(source, target)
  return Math.max(0, target.hitPoints - damage)
}

/**
 * Updates a nested property in an object based on the specified operation.
 * @param {Object} target - The object to be updated.
 * @param {Object} operation - An object describing the update operation.
 * @param {string} operation.key - The key representing the path to the property.
 * @param {string} operation.op - The operation to perform ('*' or '+').
 * @param {number} operation.value - The value to use in the operation.
 */
export const updateObject = (target, operation) => {
  if (typeof target !== 'object' || target === null) {
    throw new Error('Target must be a non-null object.')
  }

  if (!operation || !operation.key || !operation.op || typeof operation.value !== 'number') {
    throw new Error('Invalid operation: key, op, and value are required.')
  }

  function setToValue(obj, value, path) {
    const keys = path.split('.')
    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) {
        throw new Error(`Path not found: ${keys.slice(0, i + 1).join('.')}`)
      }
      obj = obj[keys[i]]
    }
    obj[keys[keys.length - 1]] = value
  }

  const keys = operation.key.split('.')
  let result = target

  // Navigate to the specified path
  for (const key of keys) {
    if (result[key] === undefined) {
      throw new Error(`Key not found: ${operation.key}`)
    }
    result = result[key]
  }

  switch (operation.op) {
    case '*':
      setToValue(target, result * Number(operation.value), operation.key)
      break
    case '+':
      setToValue(target, result + Number(operation.value), operation.key)
      break
    default:
      throw new Error(`Invalid operation: ${operation.op}`)
  }
}

export const canUpdateMinimap = (instance, player) => {
  return instance.owner.isPlayed || (player.name !== instance.owner.name && instanceIsInPlayerSight(instance, player))
}

/**
 * Checks if a given condition is valid based on specified values.
 * @param {Object} condition - The condition object containing operation, key, and value.
 * @param {Object} values - The values to evaluate against.
 * @returns {boolean} - True if the condition is valid, false otherwise.
 */
export const isValidCondition = (condition, values) => {
  if (!condition) {
    return true // No condition means it's always valid
  }

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

/**
 * Compares two arrays for equality, disregarding order.
 * @param {Array} a - The first array.
 * @param {Array} b - The second array.
 * @returns {boolean} - True if arrays are equal, false otherwise.
 */
const arraysEqual = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  if (a.length !== b.length) return false

  const sortedA = a.slice().sort()
  const sortedB = b.slice().sort()

  return sortedA.every((val, index) => val === sortedB[index])
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
      (!props || props.buildingTypes.includes(target.type)),
    takemeat: () =>
      source.type === 'Villager' &&
      target.family === 'animal' &&
      target.quantity > 0 &&
      target.isDead &&
      !target.isDestroyed,
    fishing: () =>
      target.category === 'Fish' &&
      target.allowAction.includes(source.type) &&
      target.quantity > 0 &&
      !target.isDestroyed,
    hunt: () =>
      source.type === 'Villager' &&
      target.family === 'animal' &&
      target.quantity > 0 &&
      target.hitPoints > 0 &&
      !target.isDead,
    chopwood: () => source.type === 'Villager' && target.type === 'Tree' && target.quantity > 0 && !target.isDead,
    farm: () =>
      source.type === 'Villager' &&
      target.type === 'Farm' &&
      target.hitPoints > 0 &&
      target.owner?.name === source.owner.name &&
      target.quantity > 0 &&
      (!target.isUsedBy || target.isUsedBy === source) &&
      !target.isDead,
    forageberry: () =>
      source.type === 'Villager' && target.type === 'Berrybush' && target.quantity > 0 && !target.isDead,
    minestone: () => source.type === 'Villager' && target.type === 'Stone' && target.quantity > 0 && !target.isDead,
    minegold: () => source.type === 'Villager' && target.type === 'Gold' && target.quantity > 0 && !target.isDead,
    build: () =>
      source.type === 'Villager' &&
      target.owner?.name === source.owner.name &&
      target.family === 'building' &&
      target.hitPoints > 0 &&
      (!target.isBuilt || target.hitPoints < target.totalHitPoints) &&
      !target.isDead,
    attack: () =>
      target &&
      target.owner?.name !== source.owner.name &&
      ['building', 'unit', 'animal'].includes(target.family) &&
      target.hitPoints > 0 &&
      !target.isDead,
    heal: () =>
      target &&
      target.owner?.name === source.owner.name &&
      target.family === 'unit' &&
      target.hitPoints > 0 &&
      target.hitPoints < target.totalHitPoints &&
      !target.isDead,
  }
  return target && target !== source && source.hitPoints > 0 && !source.isDead && conditions[action](props)
}
