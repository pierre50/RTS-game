import { sameCellMapSpace } from '../../lib/mapSpaces'
import { getHouseholdUnits } from '../../lib/housing/households'
import type { BuildingEntity, UnitEntity } from '../../types/entities'

/** NPCs respect reservations; the hero may use a reserved bed that is still empty. */
export function isBedOccupied(unit: UnitEntity, bed: BuildingEntity): boolean {
  const units = new Set(unit.context?.players?.flatMap(player => player.units ?? []) ?? unit.owner?.units ?? [])
  const hero = unit.context?.controls?.heroUnit
  if (hero) units.add(hero)
  const requestingHero = hero === unit || unit.controlMode === 'hero'
  if (
    !requestingHero &&
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
        (other.shelterState?.restTarget === bed &&
          (requestingHero
            ? (other.shelterState.status === 'inside' || other.shelterState.status === 'outside') &&
              Boolean(other.shelterState.targetCell) &&
              sameCellMapSpace(other, other.shelterState.targetCell) &&
              other.i === other.shelterState.targetCell?.i &&
              other.j === other.shelterState.targetCell?.j
            : other.shelterState.status !== 'wakingUp')))
  )
}
