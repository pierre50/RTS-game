import { BUILDING_TYPES } from '../../constants'
import type { BuildingEntity, UnitEntity } from '../../types/entities'

function inventorySignature(hero: UnitEntity | null | undefined): string[] {
  return [hero?.inventory?.equipment?.join(',') || '', JSON.stringify(hero?.inventory?.resources ?? {})]
}

export function getHeroBuildingInteractiveInventorySignature(
  building: BuildingEntity,
  hero: UnitEntity | null | undefined
): string {
  if (building.type === BUILDING_TYPES.market) {
    return [building.marketGold ?? '', building.marketStock?.join(',') || '', ...inventorySignature(hero)].join('|')
  }
  if (building.type === BUILDING_TYPES.chest) {
    return [
      building.owner?.label ?? '',
      building.inventory?.equipment?.join(',') || '',
      JSON.stringify(building.inventory?.resources ?? {}),
      ...inventorySignature(hero),
    ].join('|')
  }
  return ''
}
