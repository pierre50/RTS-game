import { BUILDING_TYPES } from '../../app/constants'
import { getBuildingInteriorDecorationLayout } from '../../app/lib/buildings/interiorDecorations'
import { getEntitySpaceId } from '../../app/lib/mapSpaces'
import type { ResourceAmount } from '../../app/types/common'
import type { GameContextLike } from '../../app/types/context'
import type { BuildingEntity } from '../../app/types/entities'
import { getBuildingInteriorSpaceForBuilding } from './BuildingInteriorSpaceLookup'
import type { BuildingInventory } from './BuildingInteriorSpaceTypes'

function mergeInventoryResources(target: BuildingInventory, resources: ResourceAmount | null | undefined): void {
  if (!resources) return
  for (const [resource, amount] of Object.entries(resources)) {
    if (!amount || amount <= 0) continue
    target.resources = target.resources ?? {}
    target.resources[resource as keyof ResourceAmount] =
      (target.resources[resource as keyof ResourceAmount] ?? 0) + amount
  }
}

function mergeInventoryEquipment(target: BuildingInventory, equipment: string[] | null | undefined): void {
  if (!equipment?.length) return
  target.equipment = [...(target.equipment ?? []), ...equipment]
}

function mergeBuildingInventory(target: BuildingInventory, source: BuildingInventory | null | undefined): void {
  mergeInventoryResources(target, source?.resources)
  mergeInventoryEquipment(target, source?.equipment)
}

function hasInventoryContent(inventory: BuildingInventory): boolean {
  return Boolean(
    Object.values(inventory.resources ?? {}).some(amount => (amount ?? 0) > 0) || (inventory.equipment?.length ?? 0) > 0
  )
}

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

function buildingHasConfiguredInteriorChest(building: BuildingEntity): boolean {
  return getBuildingInteriorDecorationLayout(building, { includeFireCamp: false }).some(
    item => item.type === BUILDING_TYPES.chest
  )
}

export function extractBuildingInteriorChestInventory(
  context: GameContextLike,
  building: BuildingEntity
): BuildingInventory | null {
  const space = getBuildingInteriorSpaceForBuilding(context, building)
  const interiorChests = space
    ? [...(building.owner?.buildings ?? [])].filter(chest => {
        if (chest.type !== BUILDING_TYPES.chest) return false
        if (chest.isDead || chest.isDestroyed) return false
        return getEntitySpaceId(chest) === space.id
      })
    : []
  if (!buildingHasConfiguredInteriorChest(building) && interiorChests.length === 0) return null

  const merged: BuildingInventory = {}
  mergeBuildingInventory(merged, building.inventory)
  clearBuildingInventory(building.inventory)

  for (const chest of interiorChests) {
    mergeBuildingInventory(merged, chest.inventory)
    clearBuildingInventory(chest.inventory)
    removeInteriorChest(context, chest)
  }

  return hasInventoryContent(merged) ? merged : null
}
