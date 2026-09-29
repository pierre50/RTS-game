import { BUILDING_TYPES } from '../../app/constants'
import { getEntitySpaceId } from '../../app/lib/mapSpaces'
import type { GameContextLike } from '../../app/types/context'
import type { BuildingEntity } from '../../app/types/entities'
import { getBuildingInteriorSpaceForBuilding } from './BuildingInteriorSpaceLookup'
import type { BuildingInventory } from './BuildingInteriorSpaceTypes'

function clearBuildingInventory(inventory: BuildingInventory | null | undefined): void {
  if (!inventory) return
  inventory.resources = {}
  inventory.equipment = []
}

function removeInteriorChest(context: GameContextLike, chest: BuildingEntity): void {
  if (chest.currentCell?.has === chest) {
    chest.currentCell.has = null
    chest.currentCell.solid = false
  }
  context.map.removeFromInstanceBucket?.(chest)
  const buildings = chest.owner?.buildings
  const index = buildings?.indexOf(chest) ?? -1
  if (index >= 0) buildings?.splice(index, 1)
  chest.isDead = true
  chest.isDestroyed = true
  ;(chest as { parent?: { removeChild?: (child: BuildingEntity) => void } }).parent?.removeChild?.(chest)
  chest.destroy?.({ children: true, texture: false })
}

export function destroyBuildingInteriorInventory(context: GameContextLike, building: BuildingEntity): void {
  const space = getBuildingInteriorSpaceForBuilding(context, building)
  const interiorChests = space
    ? [...(building.owner?.buildings ?? [])].filter(chest => {
        if (chest.type !== BUILDING_TYPES.chest) return false
        if (chest.isDead || chest.isDestroyed) return false
        return getEntitySpaceId(chest) === space.id
      })
    : []
  clearBuildingInventory(building.inventory)

  for (const saved of building.interiorBuildings ?? []) clearBuildingInventory(saved.inventory)

  for (const chest of interiorChests) {
    clearBuildingInventory(chest.inventory)
    removeInteriorChest(context, chest)
  }
}
