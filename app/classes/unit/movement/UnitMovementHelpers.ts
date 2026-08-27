import {
  ACTION_TYPES,
  BUILDING_TYPES,
  FAMILY_TYPES,
  MINING_RESOURCE_CONFIG,
  RELIEF_CLIMB_SPEED_MULTIPLIER,
  SHEET_TYPES,
  UNIT_TYPES,
  WORK_TYPES,
} from '../../../constants'
import { getInstanceDegree, getMiningActions, instancesDistance, resumeVillagerAutonomy } from '../../../lib'
import { isHeroControlled } from '../../../lib/units/unitControl'
import { getEnergyMoveSpeedMultiplier } from '../../../lib/units/unitEnergy'
import {
  CAUTIOUS_ANIMAL_APPROACH_RANGE,
  clearRequestedMoveSpeedFactor,
  getRequestedMoveSpeedFactor,
  requestUnitWalk,
} from '../../../lib/units/unitLocomotion'
import { applyWorkForAction } from '../UnitCommands'
import { debugCombatMove } from './UnitMovementDebug'
import type { RuntimeEntity, UnitEntity } from '../../../types/entities'
import type { RuntimeCell } from '../../../types/map'

export const CAPTURE_HORSE_TRIGGER_RANGE = 4
export const MAX_BLOCKED_GATHER_APPROACH_DISTANCE = 6
export const SLIDE_PROBE_ANGLES = [Math.PI / 8, Math.PI / 4, (3 * Math.PI) / 8]

export type SendToOptions = { forceRepath?: boolean; allowBlockedGatherApproach?: boolean; preserveAutonomy?: boolean }
export type DirectMoveOptions = { facingDirX?: number; facingDirY?: number }

function getVillagerWorkForAction(action: string | null | undefined): string | null {
  if (!action) return null
  const miningConfig = Object.values(MINING_RESOURCE_CONFIG ?? {}).find(config => config.action === action)
  if (miningConfig?.work) return miningConfig.work
  switch (action) {
    case ACTION_TYPES.chopwood:
      return WORK_TYPES.woodcutter
    case ACTION_TYPES.forageberry:
      return WORK_TYPES.forager
    case ACTION_TYPES.farm:
      return WORK_TYPES.farmer
    case ACTION_TYPES.hunt:
    case ACTION_TYPES.takemeat:
      return WORK_TYPES.hunter
    case ACTION_TYPES.captureHorse:
      return WORK_TYPES.horseCapture
    case ACTION_TYPES.build:
      return WORK_TYPES.builder
    default:
      return null
  }
}

export function syncVillagerWorkForAction(unit: UnitEntity, action: string | null | undefined): void {
  if (unit.type !== UNIT_TYPES.villager) return
  const work = getVillagerWorkForAction(action)
  if (!work) return
  applyWorkForAction(unit, work, action ?? null)
}

export function isRuntimeEntity(value: RuntimeEntity | RuntimeCell | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

export function isDestroyedEntity(value: RuntimeEntity | RuntimeCell | null | undefined): boolean {
  return isRuntimeEntity(value) && Boolean(value.isDestroyed)
}

export function isMovingUnitEntity(entity: RuntimeEntity | null): entity is UnitEntity {
  return Boolean(entity && entity.family === FAMILY_TYPES.unit && 'hasPath' in entity)
}

export function getPathMoveSpeed(unit: UnitEntity, nextCell: RuntimeCell): number {
  let speed = (unit.speed ?? 0) * getEnergyMoveSpeedMultiplier(unit) * getRequestedMoveSpeedFactor(unit)
  if (nextCell.inclined || (nextCell.z ?? 0) > (unit.currentCell?.z ?? 0)) speed *= RELIEF_CLIMB_SPEED_MULTIPLIER
  return speed
}

export function updateCautiousAnimalApproachSpeed(unit: UnitEntity): void {
  if (usesCautiousAnimalApproach(unit, unit.dest, unit.action)) {
    if (instancesDistance(unit, unit.dest as RuntimeEntity) <= CAUTIOUS_ANIMAL_APPROACH_RANGE) {
      requestUnitWalk(unit)
    } else {
      clearRequestedMoveSpeedFactor(unit)
    }
  }
}

export function usesCautiousAnimalApproach(
  unit: UnitEntity,
  dest: RuntimeEntity | RuntimeCell | null | undefined,
  action: string | null | undefined
): boolean {
  return (
    unit.type === UNIT_TYPES.villager &&
    (action === ACTION_TYPES.hunt || action === ACTION_TYPES.captureHorse) &&
    isRuntimeEntity(dest) &&
    dest.family === FAMILY_TYPES.animal
  )
}

export { getRequestedMoveSpeedFactor, clearRequestedMoveSpeedFactor }

export const POST_BUILD_GATHER_ACTIONS: Record<string, string[]> = {
  [BUILDING_TYPES.granary]: [ACTION_TYPES.forageberry],
  [BUILDING_TYPES.storagePit]: [ACTION_TYPES.chopwood, ...getMiningActions()],
  [BUILDING_TYPES.townCenter]: [
    ACTION_TYPES.chopwood,
    ACTION_TYPES.forageberry,
    ...getMiningActions(),
    ACTION_TYPES.farm,
    ACTION_TYPES.hunt,
    ACTION_TYPES.takemeat,
  ],
}

export const GATHER_SEND_TO_BY_ACTION: Record<string, (unit: UnitEntity, target: RuntimeEntity) => boolean> = {
  [ACTION_TYPES.chopwood]: (unit, target) => (unit.sendToTree ? (unit.sendToTree(target, true), true) : false),
  [ACTION_TYPES.farm]: (unit, target) => (unit.sendToFarm(target, true), true),
  [ACTION_TYPES.forageberry]: (unit, target) =>
    unit.sendToBerrybush ? (unit.sendToBerrybush(target, true), true) : false,
  [ACTION_TYPES.hunt]: (unit, target) => (unit.sendToHunt(target, true), true),
  [ACTION_TYPES.captureHorse]: (unit, target) =>
    unit.sendToCaptureHorse ? unit.sendToCaptureHorse(target, true) !== false : false,
  ...Object.fromEntries(
    getMiningActions().map(action => [
      action,
      (unit: UnitEntity, target: RuntimeEntity) =>
        unit.sendToMineResource ? (unit.sendToMineResource(target, true), true) : false,
    ])
  ),
  [ACTION_TYPES.takemeat]: (unit, target) => (unit.sendToTakeMeat(target, true), true),
}

export const BLOCKED_GATHER_APPROACH_ACTIONS = new Set([
  ACTION_TYPES.chopwood,
  ACTION_TYPES.farm,
  ACTION_TYPES.forageberry,
  ACTION_TYPES.hunt,
  ACTION_TYPES.captureHorse,
  ...getMiningActions(),
  ACTION_TYPES.takemeat,
])

export function isUnitCellOccupant(unit: UnitEntity, cell: RuntimeCell | null | undefined): boolean {
  return Boolean(cell?.has && (cell.has === unit || cell.has.label === unit.label))
}

export function isCellBlockedForUnit(unit: UnitEntity, cell: RuntimeCell | null | undefined): boolean {
  return Boolean(cell && cell.solid && !isUnitCellOccupant(unit, cell))
}

export function clearCellForUnit(unit: UnitEntity, cell: RuntimeCell | null | undefined): void {
  if (!isUnitCellOccupant(unit, cell)) return
  cell!.has = null
  cell!.solid = false
}

export function placeUnitOnCell(unit: UnitEntity, cell: RuntimeCell): void {
  if (cell.has === null || cell.has?.isDestroyed || isUnitCellOccupant(unit, cell)) {
    cell.place(unit)
    cell.solid = true
  }
}

export function cellOccupantIsDest(cell: RuntimeCell, dest: RuntimeEntity | RuntimeCell): boolean {
  return isRuntimeEntity(dest) && Boolean(cell.has?.label && cell.has.label === dest.label)
}

export function startActionIfAlreadyInRange(unit: UnitEntity, dest: RuntimeEntity | RuntimeCell, reason: string): boolean {
  if (!unit.action || !unit.isUnitAtDest?.(unit.action, dest)) return false
  unit.path = []
  unit.stopInterval?.()
  unit.degree = getInstanceDegree(unit, dest.x, dest.y)
  debugCombatMove(unit, reason, unit.currentCell ?? (dest as RuntimeCell), { stage: 'path-step' })
  unit.getAction?.(unit.action)
  return true
}

export function resumeAutonomyBeforeStopping(unit: UnitEntity): boolean {
  if (!unit.autonomousJob || isHeroControlled(unit)) return false
  unit.action = null
  unit.dest = null
  unit.realDest = null
  unit.path = []
  return Boolean(resumeVillagerAutonomy?.(unit))
}

export function isRecoveringAttack(unit: UnitEntity): boolean {
  return unit.combatMode === 'recover' && unit.waitingForEnergyAction === ACTION_TYPES.attack
}

export function pauseCombatRecoveryMove(unit: UnitEntity): void {
  unit.path = []
  unit.action = null
  unit.stopInterval?.()
  unit.setTextures?.(SHEET_TYPES.standing)
  unit.sprite?.stop()
}
