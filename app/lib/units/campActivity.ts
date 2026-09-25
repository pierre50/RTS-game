import { unitSuspensionReason } from './unitSuspension'
import type { UnitEntity } from '../../types/entities'

export function isCampPaused(unit: UnitEntity): boolean {
  return unitSuspensionReason(unit) === 'camp-paused'
}
