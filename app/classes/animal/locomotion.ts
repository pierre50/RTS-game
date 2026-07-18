import { SHEET_TYPES } from '../../constants'

// Locomotion categories: an animal whose current sheet belongs to
// AIRBORNE_SHEETS, or that still has altitude, is airborne. Airborne animals
// must never freeze their animation and must never fall back to a ground
// movement sheet until they have actually landed (altitude back to 0).
export const AIRBORNE_SHEETS: ReadonlySet<string> = new Set([SHEET_TYPES.flying])

type LocomotionState = {
  altitude?: number
  currentSheet?: string
  flyingSheet?: unknown
}

export function isAirborne(animal: LocomotionState): boolean {
  return (animal.altitude ?? 0) > 0 || AIRBORNE_SHEETS.has(animal.currentSheet ?? '')
}

export function resolveMovementSheet(animal: LocomotionState, preferred: string = SHEET_TYPES.walking): string {
  return isAirborne(animal) && animal.flyingSheet ? SHEET_TYPES.flying : preferred
}
