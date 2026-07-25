import { t } from './lang'
import type { BuildingEntity, UnitEntity } from '../types/entities'

export function showUnitCannotEnterBuildingMessage(unit: UnitEntity, building: BuildingEntity): void {
  unit.context?.menu?.showMessage(
    t('unitCannotEnterBuilding', {
      unit: t(unit.type),
      building: t(building.type),
    }),
    'warning'
  )
}
