import type { LoadedGameConfig } from '../types/save'
import { fail, isObject, validateArray, validateEntityPosition } from './SaveValidationPrimitives'

function invalid(label: string): never {
  return fail(`Invalid save file: ${label} has invalid training data.`)
}

function validateAmounts(value: unknown, label: string): void {
  if (value == null) return
  if (!isObject(value)) invalid(label)
  for (const amount of Object.values(value)) {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) invalid(label)
  }
}

function validateExtra(value: unknown, label: string): void {
  if (value == null) return
  if (!isObject(value)) invalid(label)
  for (const key of ['name', 'horseColor', 'companionHorseColor']) {
    if (value[key] != null && typeof value[key] !== 'string') invalid(label)
  }
  if (value.gender != null && value.gender !== 'male' && value.gender !== 'female') invalid(label)
  for (const key of ['mountedOnHorse', 'isChief']) {
    if (value[key] != null && typeof value[key] !== 'boolean') invalid(label)
  }
  for (const key of ['speed', 'hitPoints']) {
    const number = value[key]
    if (number != null && (typeof number !== 'number' || !Number.isFinite(number) || number < 0)) invalid(label)
  }
  validateAmounts(value.experience, label)
  if (
    value.appearanceVariants != null &&
    (!isObject(value.appearanceVariants) ||
      Object.values(value.appearanceVariants).some(part => typeof part !== 'string'))
  )
    invalid(label)
}

export function validatePlayerTraining(
  buildings: unknown[],
  units: unknown[],
  size: number,
  config: LoadedGameConfig
): void {
  const labels = new Set(units.filter(isObject).map(unit => unit.label))
  for (const building of buildings) {
    if (!isObject(building)) continue
    validateExtra(building.trainingExtra, 'building')
    if (building.trainingQueue == null) continue
    validateArray(building.trainingQueue, 'trainingQueue')
    for (const entry of building.trainingQueue) {
      if (!isObject(entry) || typeof entry.type !== 'string' || !config.units?.[entry.type]) invalid('entry')
      const trainee = entry.trainee
      validateEntityPosition(trainee, size, 'trainee')
      if (
        typeof trainee.type !== 'string' ||
        !config.units?.[trainee.type] ||
        typeof trainee.label !== 'string' ||
        !trainee.label ||
        labels.has(trainee.label)
      )
        invalid('trainee')
      labels.add(trainee.label)
      validateExtra(trainee, 'trainee')
      validateExtra(entry.extra, 'entry')
      validateAmounts(entry.cost, 'cost')
      const start = entry.trainingStartedDay
      const end = entry.trainingCompleteDay
      if (
        typeof start !== 'number' ||
        !Number.isSafeInteger(start) ||
        start < 1 ||
        typeof end !== 'number' ||
        !Number.isSafeInteger(end) ||
        end < start
      )
        invalid('dates')
      if (
        entry.loading != null &&
        (typeof entry.loading !== 'number' ||
          !Number.isFinite(entry.loading) ||
          entry.loading < 0 ||
          entry.loading > 100)
      )
        invalid('progress')
    }
    if (
      building.trainingQueue.length &&
      (!Array.isArray(building.queue) ||
        building.queue.length !== building.trainingQueue.length ||
        building.trainingQueue.some(
          (entry, index) => isObject(entry) && entry.type !== (building.queue as unknown[])[index]
        ))
    ) {
      invalid('queue')
    }
  }
}
