import { UNIT_TYPES } from '../constants'
import type { LoadedGameConfig } from '../types/save'
import { fail, isObject, validateOptionalGridDestination, validateAnimalPath, validateEntityPosition, validateOptionalBoolean, MAX_MAP_EDGE } from './SaveValidationPrimitives'

const RUNTIME_SAVE_UNIT_TYPES = new Set<string>([
  UNIT_TYPES.banditChief,
  UNIT_TYPES.banditSword,
  UNIT_TYPES.banditArcher,
])

function isSupportedSavedUnitType(type: unknown, config: LoadedGameConfig): type is string {
  return typeof type === 'string' && (Boolean(config.units?.[type]) || RUNTIME_SAVE_UNIT_TYPES.has(type))
}

function validateSavedUnitOrders(unit: Record<string, unknown>): void {
  const reference = (value: unknown, label: string) => {
    if (typeof value === 'string' && value.length) return
    validateOptionalGridDestination(value, MAX_MAP_EDGE, label)
  }
  const task = (value: unknown, label: string) => {
    if (!isObject(value)) fail(`Invalid save file: ${label} is invalid.`)
    reference(value.dest, `${label}.dest`)
    for (const key of ['action', 'work', 'autonomousJob']) {
      if (value[key] != null && typeof value[key] !== 'string') fail(`Invalid save file: ${label}.${key} is invalid.`)
    }
  }
  if (unit.caveOrders != null) {
    task(unit.caveOrders, 'caveOrders')
    if (!isObject(unit.caveOrders) || !unit.cavePosition) fail('Invalid save file: caveOrders has no cave position.')
    reference(unit.caveOrders.previousDest, 'caveOrders.previousDest')
    validateAnimalPath(unit.caveOrders.path, MAX_MAP_EDGE, 'caveOrders.path')
    validateOptionalGridDestination(unit.caveOrders.realDest, MAX_MAP_EDGE, 'caveOrders.realDest')
  }
  if (unit.resourceDelivery != null) {
    if (!isObject(unit.resourceDelivery)) fail('Invalid save file: resourceDelivery is invalid.')
    reference(unit.resourceDelivery.building, 'resourceDelivery.building')
    if (unit.resourceDelivery.returnTask != null) task(unit.resourceDelivery.returnTask, 'resourceDelivery.returnTask')
  }
}

export function validatePlayerUnits(units: unknown[], playerIndex: number, size: number, config: LoadedGameConfig): void {
  units.forEach((unit, unitIndex) => {
    validateEntityPosition(unit, size, `player ${playerIndex} unit ${unitIndex}`)
    validateSavedUnitOrders(unit)
    if (unit.dailySchedule != null) {
      const schedule = unit.dailySchedule
      if (!isObject(schedule)) fail('Invalid save file: dailySchedule is invalid.')
      const minutes = ['wakeMinute', 'workStartMinute', 'workEndMinute', 'bedMinute'].map(key => schedule[key])
      if (minutes.some(value => typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value >= 1440)) {
        fail('Invalid save file: dailySchedule minutes are invalid.')
      }
      if (minutes.some((value, index) => index > 0 && (value as number) <= (minutes[index - 1] as number))) {
        fail('Invalid save file: dailySchedule phases are out of order.')
      }
    }
    if (unit.factionExpedition != null) {
      const expedition = unit.factionExpedition
      if (
        !isObject(expedition) ||
        !['raidId', 'factionId', 'regionId', 'playerLabel'].every(
          key => typeof expedition[key] === 'string' && expedition[key].length > 0
        ) ||
        !['approaching', 'parley', 'hostile', 'leaving'].includes(String(expedition.phase)) ||
        !isObject(expedition.original) ||
        expedition.original.factionExpedition != null ||
        expedition.original.label !== unit.label ||
        expedition.original.type !== unit.type ||
        !isObject(expedition.tribute) ||
        Object.values(expedition.tribute).some(
          value => typeof value !== 'number' || !Number.isFinite(value) || value < 0
        )
      )
        fail('Invalid save file: faction expedition is invalid.')
      validateEntityPosition(expedition.original, MAX_MAP_EDGE, 'faction expedition origin')
    }
    validateOptionalBoolean(unit.exploringForAutonomy, `player ${playerIndex} unit ${unitIndex}.exploringForAutonomy`)
    validateOptionalBoolean(unit.pendingRescueThanks, `player ${playerIndex} unit ${unitIndex}.pendingRescueThanks`)
    if (!isSupportedSavedUnitType(unit.type, config)) {
      fail(`Invalid save file: player ${playerIndex} unit ${unitIndex} has an unsupported type.`)
    }
    if (unit.trainingTargetType != null && !isSupportedSavedUnitType(unit.trainingTargetType, config)) {
      fail(`Invalid save file: player ${playerIndex} unit ${unitIndex} has an unsupported training target.`)
    }
    if (unit.offlineWork != null) {
      const progress = unit.offlineWork
      if (
        !isObject(progress) ||
        typeof progress.target !== 'string' ||
        typeof progress.milliseconds !== 'number' ||
        !Number.isFinite(progress.milliseconds) ||
        progress.milliseconds < 0
      ) {
        fail(`Invalid save file: player ${playerIndex} unit ${unitIndex} has invalid offline work progress.`)
      }
    }
  })
}

export function validatePlayerCorpses(corpses: unknown[], playerIndex: number, size: number, config: LoadedGameConfig): void {
  corpses.forEach((corpse, corpseIndex) => {
    validateEntityPosition(corpse, size, `player ${playerIndex} corpse ${corpseIndex}`)
    if (!isSupportedSavedUnitType(corpse.type, config)) {
      fail(`Invalid save file: player ${playerIndex} corpse ${corpseIndex} has an unsupported type.`)
    }
  })
}

