import { CELL_HEIGHT, CELL_WIDTH, STEP_TIME, UNIT_TYPES } from '../../constants'
import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import {
  canUnitUseCellAsIdleDestination,
  canUseReservedPassageCellForTransit,
  createReservedPassageCellLookup,
} from '../../lib/buildings/passageCells'
import { getInstanceClosestFreeCellPath, getInstancePath } from '../../lib/grid/movement'
import { getEntityCell, sameMapSpace } from '../../lib/mapSpaces'
import {
  getMinutesUntilVillagerBed,
  getMinutesUntilVillagerWorkEnds,
  shouldVillagerBeAsleep,
  shouldVillagerWork,
} from '../../lib/units/villagerSchedule'
import type { RuntimeEntity, UnitEntity, UnitResourceDeliveryReturnTask } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

const GAME_HOUR_MS = DAY_NIGHT_CONFIG.dayLengthMs / DAY_NIGHT_CONFIG.hoursPerDay
const GAME_MINUTE_MS = GAME_HOUR_MS / 60
const AVERAGE_PATH_CELL_DISTANCE_PX = Math.hypot(CELL_WIDTH / 2, CELL_HEIGHT / 2)
const REST_TRAVEL_BUFFER_RATIO = 1.15
const MIN_RETURN_TASK_WORK_MINUTES = 30

function isVillager(unit: UnitEntity): boolean {
  return unit.type === UNIT_TYPES.villager
}

function getUnitSpeed(unit: UnitEntity): number {
  const configuredSpeed = unit.owner?.config?.units?.[unit.type]?.speed
  return typeof unit.speed === 'number' ? unit.speed : typeof configuredSpeed === 'number' ? configuredSpeed : 1
}

function estimatePathTravelMs(unit: UnitEntity, pathLength: number): number | null {
  const speed = getUnitSpeed(unit)
  if (speed <= 0) return null
  return ((pathLength * AVERAGE_PATH_CELL_DISTANCE_PX) / speed) * STEP_TIME * REST_TRAVEL_BUFFER_RATIO
}

function estimateTravelMsToCell(unit: UnitEntity, targetCell: RuntimeCell): number | null {
  const map = unit.context?.map
  if (!map) return null
  if (unit.i === targetCell.i && unit.j === targetCell.j) return 0
  const path = getInstancePath(unit, targetCell.i, targetCell.j, map)
  if (!path.length) return null
  return estimatePathTravelMs(unit, path.length)
}

function estimateTravelMsToEntity(
  unit: UnitEntity,
  target: RuntimeEntity,
  action: string | null | undefined
): number | null {
  const map = unit.context?.map
  if (!map || !sameMapSpace(unit, target)) return null
  if (unit.isUnitAtDest?.(action, target)) return 0
  const passageLookup = createReservedPassageCellLookup(unit.context)
  const path = getInstanceClosestFreeCellPath<RuntimeCell>(unit, target, map, {
    isCellAllowed: cell => canUnitUseCellAsIdleDestination(unit, cell, { passageLookup }),
    pathfinding: {
      canPassThroughSolidCell: cell => canUseReservedPassageCellForTransit(cell, passageLookup),
    },
  })
  if (path.length) return estimatePathTravelMs(unit, path.length)
  const targetCell = getEntityCell(target, map)
  return targetCell ? estimateTravelMsToCell(unit, targetCell) : null
}

function estimateTravelMsToReturnTask(unit: UnitEntity, task: UnitResourceDeliveryReturnTask): number | null {
  const dest = task.dest
  if (!dest) return null
  if ('has' in dest) return estimateTravelMsToCell(unit, dest)
  return estimateTravelMsToEntity(unit, dest, task.action)
}

export function canResumeVillagerReturnTaskBeforeRest(
  unit: UnitEntity,
  task: UnitResourceDeliveryReturnTask | null | undefined
): boolean {
  if (!isVillager(unit)) return true
  if (!shouldVillagerWork(unit)) return false
  if (!task?.dest) return true

  const travelMs = estimateTravelMsToReturnTask(unit, task)
  if (travelMs == null) return false
  const remainingWorkMs = getMinutesUntilVillagerWorkEnds(unit) * GAME_MINUTE_MS
  const usefulWorkMs = MIN_RETURN_TASK_WORK_MINUTES * GAME_MINUTE_MS
  return travelMs + usefulWorkMs <= remainingWorkMs
}

export function canReachShelterBeforeBed(unit: UnitEntity, targetCell: RuntimeCell): boolean {
  if (!isVillager(unit)) return true
  if (shouldVillagerBeAsleep(unit)) return true
  const remainingMs = getMinutesUntilVillagerBed(unit) * GAME_MINUTE_MS
  // Even an unobstructed diagonal route must cover this many cells.
  const minimumCells = Math.max(Math.abs(unit.i - targetCell.i), Math.abs(unit.j - targetCell.j))
  const minimumMs = estimatePathTravelMs(unit, minimumCells)
  if (minimumMs == null || minimumMs > remainingMs) return false
  const travelMs = estimateTravelMsToCell(unit, targetCell)
  return travelMs != null && travelMs <= remainingMs
}
