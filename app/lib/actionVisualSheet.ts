import { ACTION_TYPES, SHEET_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'

export const SHOOTING_SHEET_KEY = 'shootingSheet'

export function getActionVisualSheetKey(action?: string | null, unitType?: string | null, work?: string | null): string {
  if (action === ACTION_TYPES.takemeat) return SHEET_TYPES.harvest
  if (unitType === UNIT_TYPES.bowman || work === WORK_TYPES.hunter) {
    return SHOOTING_SHEET_KEY
  }
  return SHEET_TYPES.action
}
