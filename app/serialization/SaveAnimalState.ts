import { ACTION_TYPES, SHEET_TYPES } from '../constants'
import { isHorseTamingStatus } from '../lib/horses/horseTaming'
import { fail, isObject, validateOptionalFiniteNumber, validateOptionalBoolean, validateAnimalPath, validateOptionalGridDestination } from './SaveValidationPrimitives'

const ANIMAL_ACTIONS = new Set<string>(Object.values(ACTION_TYPES))
const ANIMAL_SHEETS = new Set<string>(Object.values(SHEET_TYPES))
export function validateAnimalState(
  animal: Record<string, unknown>,
  definition: Record<string, unknown>,
  size: number,
  label: string
): void {
  validateOptionalFiniteNumber(animal.quantity, `${label}.quantity`)
  validateOptionalBoundedNumber(animal.quantity, definition.totalQuantity, `${label}.quantity`)
  validateOptionalFiniteNumber(animal.hitPoints, `${label}.hitPoints`)
  validateOptionalBoundedNumber(animal.hitPoints, definition.totalHitPoints, `${label}.hitPoints`)
  validateOptionalBoolean(animal.isDead, `${label}.isDead`)
  validateOptionalBoolean(animal.isDestroyed, `${label}.isDestroyed`)
  validateSavedHorseTamingStatus(animal, label)
  if (animal.isDestroyed === true && animal.isDead !== true) {
    fail(`Invalid save file: ${label} is destroyed but not dead.`)
  }
  if (animal.action != null && (typeof animal.action !== 'string' || !ANIMAL_ACTIONS.has(animal.action))) {
    fail(`Invalid save file: ${label}.action is invalid.`)
  }
  if (
    animal.currentSheet != null &&
    (typeof animal.currentSheet !== 'string' || !ANIMAL_SHEETS.has(animal.currentSheet))
  ) {
    fail(`Invalid save file: ${label}.currentSheet is invalid.`)
  }
  validateAnimalPath(animal.path, size, `${label}.path`)
  validateOptionalGridDestination(animal.dest, size, `${label}.dest`)
  validateOptionalGridDestination(animal.previousDest, size, `${label}.previousDest`)
  validateOptionalGridDestination(animal.realDest, size, `${label}.realDest`)
}

export function validateSavedHorseTamingStatus(record: unknown, label: string): void {
  if (!isObject(record) || record.tamingStatus == null) return
  if (!isHorseTamingStatus(record.tamingStatus)) {
    fail(`Invalid save file: ${label}.tamingStatus is invalid.`)
  }
}

function validateOptionalBoundedNumber(value: unknown, max: unknown, label: string): void {
  if (typeof value === 'number' && typeof max === 'number' && (value < 0 || value > max)) {
    fail(`Invalid save file: ${label} is out of range.`)
  }
}
