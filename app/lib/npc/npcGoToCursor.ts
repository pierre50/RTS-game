import { ACTION_TYPES, FAMILY_TYPES, TYPE_ACTION } from '../constants'
import { canUnitEnterBuildingInterior } from '../buildings/interiorAccess'
import type { CursorState } from '../hero/heroCursor'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

function canAnyUnitPerform(units: UnitEntity[], target: RuntimeEntity, action: string): boolean {
  return units.some(unit => !unit.isDead && !unit.isDestroyed && Boolean(unit.getActionCondition?.(target, action)))
}

function resolveResourceCursorState(units: UnitEntity[], target: RuntimeEntity): CursorState {
  const kind = target.category || target.type
  const action = kind ? TYPE_ACTION[kind as keyof typeof TYPE_ACTION] : undefined
  return action && canAnyUnitPerform(units, target, action) ? 'resource' : 'move'
}

function resolveBuildingCursorState(units: UnitEntity[], target: BuildingEntity): CursorState {
  if (
    canAnyUnitPerform(units, target, ACTION_TYPES.build) ||
    canAnyUnitPerform(units, target, ACTION_TYPES.delivery)
  ) {
    return 'resource'
  }
  if (canAnyUnitPerform(units, target, ACTION_TYPES.attack)) return 'combat'
  return 'move'
}

function resolveAnimalCursorState(units: UnitEntity[], target: RuntimeEntity): CursorState {
  if (target.isDead && canAnyUnitPerform(units, target, ACTION_TYPES.takemeat)) return 'resource'
  if (
    canAnyUnitPerform(units, target, ACTION_TYPES.attack) ||
    canAnyUnitPerform(units, target, ACTION_TYPES.hunt) ||
    canAnyUnitPerform(units, target, ACTION_TYPES.captureHorse)
  ) {
    return 'combat'
  }
  return 'move'
}

function resolveUnitCursorState(units: UnitEntity[], target: RuntimeEntity): CursorState {
  if (
    canAnyUnitPerform(units, target, ACTION_TYPES.attack) ||
    canAnyUnitPerform(units, target, ACTION_TYPES.convert)
  ) {
    return 'combat'
  }
  if (canAnyUnitPerform(units, target, ACTION_TYPES.heal)) return 'resource'
  return 'move'
}

export function resolveNpcGoToCursorState(
  units: UnitEntity[] | null | undefined,
  hoverTarget: RuntimeEntity | null,
  hoverCell: RuntimeCell | null,
  context: GameContextLike | null
): CursorState {
  const activeUnits = (units ?? []).filter(unit => !unit.isDead && !unit.isDestroyed)
  if (!activeUnits.length) return 'default'

  const entryBuilding = hoverCell ? context?.getBuildingInteriorEntryTargetForCell?.(hoverCell) : null
  if (entryBuilding && activeUnits.some(unit => canUnitEnterBuildingInterior(unit, entryBuilding))) return 'enter'

  if (hoverTarget?.family === FAMILY_TYPES.resource) return resolveResourceCursorState(activeUnits, hoverTarget)
  if (hoverTarget?.family === FAMILY_TYPES.building) {
    return resolveBuildingCursorState(activeUnits, hoverTarget as BuildingEntity)
  }
  if (hoverTarget?.family === FAMILY_TYPES.animal) return resolveAnimalCursorState(activeUnits, hoverTarget)
  if (hoverTarget?.family === FAMILY_TYPES.unit) return resolveUnitCursorState(activeUnits, hoverTarget)

  return 'move'
}
