import type { UnitEntity } from '../../types/entities'

/** A combatant walking through a door must not receive an economy or guard order. */
export function hasInteriorCombatRoute(unit: object): boolean {
  return Boolean((unit as UnitEntity).spacePortalState?.combatTarget)
}
