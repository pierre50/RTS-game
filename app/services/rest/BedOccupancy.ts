import { getHouseholdUnits } from '../../lib/housing/households'
import type { BuildingEntity, UnitEntity } from '../../types/entities'

/** Includes reservations made while travelling and manual hero sleep. */
export function isBedOccupied(unit: UnitEntity, bed: BuildingEntity): boolean {
  const units = new Set(unit.context?.players?.flatMap(player => player.units ?? []) ?? unit.owner?.units ?? [])
  const hero = unit.context?.controls?.heroUnit
  if (hero) units.add(hero)
  if (
    bed.label &&
    (unit.context?.players ?? (unit.owner ? [unit.owner] : [])).some(owner =>
      getHouseholdUnits(owner).some(
        other => other !== unit && !other.isDead && !other.isDestroyed && other.homeBedLabel === bed.label
      )
    )
  )
    return true
  return [...units].some(
    other =>
      other !== unit &&
      !other.isDead &&
      !other.isDestroyed &&
      (other.heroSleepTarget === bed ||
        (other.shelterState?.restTarget === bed && other.shelterState.status !== 'wakingUp'))
  )
}
