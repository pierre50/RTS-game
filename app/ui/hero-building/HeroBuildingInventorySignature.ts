import { BUILDING_TYPES } from '../../constants'
import type { BuildingEntity, UnitEntity } from '../../types/entities'

function inventorySignature(hero: UnitEntity | null | undefined): string[] {
  return [hero?.inventory?.equipment?.join(',') || '', JSON.stringify(hero?.inventory?.resources ?? {})]
}

export function getHeroBuildingInteractiveInventorySignature(
  building: BuildingEntity,
  hero: UnitEntity | null | undefined
): string {
  if (building.type === BUILDING_TYPES.forge) {
    return [
      ...inventorySignature(hero),
      JSON.stringify(hero?.inventory?.activeWeapons ?? {}),
      JSON.stringify(hero?.inventory?.equipped ?? {}),
    ].join('|')
  }
  if (building.type === BUILDING_TYPES.market) {
    return [
      building.marketGold ?? '',
      building.marketStock?.join(',') || '',
      building.buildingLevel ?? 0,
      JSON.stringify(building.marketResourceStock ?? {}),
      ...inventorySignature(hero),
    ].join('|')
  }
  if (building.type === BUILDING_TYPES.chest) {
    return [
      building.owner?.label ?? '',
      building.inventory?.equipment?.join(',') || '',
      JSON.stringify(building.inventory?.resources ?? {}),
      ...inventorySignature(hero),
    ].join('|')
  }
  if (!building.isBuilt && building.constructionMaterials) return inventorySignature(hero).join('|')
  return ''
}
