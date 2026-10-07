import type { BuildingEntity, UnitEntity } from '../../types/entities'
import { sendUnitToRestSite } from './UnitRestLifecycle'
import { restDistance } from './UnitRestMath'
import { shouldRest } from './UnitRestRules'
import { selectRestSite } from './UnitRestPlanning'
import { hasDailyRestSchedule } from '../../lib/units/village/villagerSchedule'

export function assignAvailableBeds(beds: Set<BuildingEntity>, isEveningRest: (unit: UnitEntity) => boolean): void {
  for (const building of beds) {
    if (!building.isBuilt || building.isDead || building.isDestroyed || building.buildingUpgrade) continue
    const candidates = (building.owner?.units ?? [])
      .filter(
        unit =>
          hasDailyRestSchedule(unit) &&
          unit.shelterState?.reason === 'sleep' &&
          ['outside', 'movingToRest', 'windingDown'].includes(unit.shelterState.status) &&
          unit.sleepVisualState !== 'sleeping' &&
          !unit.lookingAtHero &&
          isEveningRest(unit) &&
          shouldRest(unit)
      )
      .sort((a, b) => restDistance(a, building) - restDistance(b, building))
    for (const unit of candidates) {
      if (unit.owner !== building.owner || unit.shelterState?.restTarget?.type === 'CampBedroll') continue
      selectRestSite(unit, undefined, site => {
        if (!site?.restTarget || site.restTarget.type !== 'CampBedroll') return false
        return sendUnitToRestSite(unit, 'sleep', site, { transition: false })
      })
    }
  }
  beds.clear()
}
