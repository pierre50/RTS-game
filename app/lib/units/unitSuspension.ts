import { notifyVillageStateChanged } from './village/villageStateEvents'
import type { UnitEntity } from '../../types/entities'

export type UnitSuspensionReason = 'camp-paused' | 'distant-work'
type Suspension = { reason: UnitSuspensionReason; wake: () => void; waking?: boolean }
const suspensions = new WeakMap<UnitEntity, Suspension>()

/** The owning system settles or resumes its activity before releasing the suspension. */
export function setUnitSuspension(unit: UnitEntity, suspension?: Suspension): void {
  if (suspensions.get(unit)?.reason !== suspension?.reason) notifyVillageStateChanged(unit.owner)
  if (suspension) suspensions.set(unit, suspension)
  else suspensions.delete(unit)
}
export function isUnitSuspended(unit: UnitEntity): boolean {
  return suspensions.has(unit)
}
export function unitSuspensionReason(unit: UnitEntity): UnitSuspensionReason | undefined {
  return suspensions.get(unit)?.reason
}
export function wakeUnitSimulation(unit: UnitEntity): void {
  const suspension = suspensions.get(unit)
  if (!suspension || suspension.waking) return
  suspension.waking = true
  try {
    suspension.wake()
  } finally {
    suspension.waking = false
  }
}
