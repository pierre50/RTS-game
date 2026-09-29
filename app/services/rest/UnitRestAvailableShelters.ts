import { hasBuildingShelterCapacity } from '../../lib/buildings/buildingOccupancy'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import { sendUnitToRestSite } from './UnitRestLifecycle'
import { restDistance } from './UnitRestMath'
import { shouldRest } from './UnitRestRules'
import { getShelterRestSite, isShelterUnsafe } from './UnitRestShelter'
import { isVillager } from './UnitRestStateTransitions'

export function assignAvailableShelters(
  shelters: Set<BuildingEntity>,
  isEveningRest: (unit: UnitEntity) => boolean
): void {
  for (const building of shelters) {
    if (isShelterUnsafe(building) || !hasBuildingShelterCapacity(building)) continue
    const candidates = (building.owner?.units ?? [])
      .filter(
        unit =>
          isVillager(unit) &&
          unit.shelterState?.reason === 'sleep' &&
          unit.shelterState.status === 'outside' &&
          unit.sleepVisualState !== 'sleeping' &&
          !unit.lookingAtHero &&
          isEveningRest(unit) &&
          shouldRest(unit)
      )
      .sort((a, b) => restDistance(a, building) - restDistance(b, building))
    for (const unit of candidates) {
      if (!hasBuildingShelterCapacity(building)) break
      const site = getShelterRestSite(unit, building)
      if (site) sendUnitToRestSite(unit, 'sleep', site, { transition: false })
    }
  }
  shelters.clear()
}
