import type { BuildingEntity, UnitEntity } from '../../types/entities'
import { sendUnitToRestSite } from './UnitRestLifecycle'
import { restDistance } from './UnitRestMath'
import { shouldRest } from './UnitRestRules'
import { getRestTargetSite, isRestTargetAvailable } from './UnitRestShelter'
import { hasDailyRestSchedule } from '../../lib/units/villagerSchedule'

export function assignAvailableBeds(beds: Set<BuildingEntity>, isEveningRest: (unit: UnitEntity) => boolean): void {
  for (const building of beds) {
    const candidates = (building.owner?.units ?? [])
      .filter(
        unit =>
          hasDailyRestSchedule(unit) &&
          unit.shelterState?.reason === 'sleep' &&
          unit.shelterState.status === 'outside' &&
          unit.sleepVisualState !== 'sleeping' &&
          !unit.lookingAtHero &&
          isEveningRest(unit) &&
          shouldRest(unit)
      )
      .sort((a, b) => restDistance(a, building) - restDistance(b, building))
    for (const unit of candidates) {
      if (unit.shelterState?.restTarget?.type === 'CampBedroll' || !isRestTargetAvailable(unit, building)) continue
      const site = getRestTargetSite(unit, building)
      if (site) sendUnitToRestSite(unit, 'sleep', site, { transition: false })
    }
  }
  beds.clear()
}
