import { BUILDING_TYPES } from '../../constants'
import { HERO_TRAP_ITEM } from './heroCrafting'

const PLACEABLE_INVENTORY_BUILDINGS: Record<string, string> = {
  [HERO_TRAP_ITEM]: BUILDING_TYPES.trap,
}

export function getPlaceableInventoryBuildingType(item: string | null | undefined): string | null {
  if (!item) return null
  return PLACEABLE_INVENTORY_BUILDINGS[item] ?? null
}
