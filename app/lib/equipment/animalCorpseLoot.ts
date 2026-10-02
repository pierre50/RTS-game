import { notifyVillageWorkChanged } from '../units/villageWorkEvents'
import { collectiveHarvestBudget } from '../economy/collectiveTasks'
import { personalFoodReserve } from '../economy/villagerProvisions'
import { materialAmount } from '../economy/constructionMaterials'
import { ANIMAL_CORPSE_DROPS } from '../../config/animalGatherLoot'
import {
  createInventoryContainer,
  moveInventoryResource,
  type InventoryStorage,
} from '../inventory/inventoryContainers'
import type { ResourceAmount } from '../../types/common'
import type { UnitEntity } from '../../types/entities'
import {
  buildingAcceptsInventoryResource,
  getUnitResourceCarryRemaining,
  findResourceDeliveryTarget,
  getBuildingStorageRemaining,
} from '../resources/resourceDelivery'

export type AnimalLootSource = {
  type: string
  isDead?: boolean
  isDestroyed?: boolean
  quantity?: number
  inventory?: InventoryStorage
  updateTexture?: () => void
}

/** Old saved carcasses retain their remaining meat, without a fresh bonus roll. */
export function initializeAnimalCorpseLoot(animal: AnimalLootSource, random?: () => number): void {
  if (!animal.isDead) return
  if (animal.inventory) {
    animal.quantity = animal.inventory.resources?.meat ?? 0
    return
  }
  const resources: ResourceAmount = { meat: Math.max(0, animal.quantity ?? 0) }
  if (random) {
    for (const drop of ANIMAL_CORPSE_DROPS[animal.type] ?? []) {
      if (random() < drop.chance) resources[drop.resource] = drop.min + Math.floor(random() * (drop.max - drop.min + 1))
    }
  }
  animal.inventory = { resources }
}

function syncAnimalLootQuantity(animal: AnimalLootSource): void {
  animal.quantity = animal.inventory?.resources?.meat ?? 0
  animal.updateTexture?.()
}

export function hasAnimalCorpseLoot(animal: AnimalLootSource): boolean {
  return Boolean(
    animal.isDead &&
      !animal.isDestroyed &&
      (animal.inventory
        ? Object.values(animal.inventory.resources ?? {}).some(n => (n ?? 0) > 0)
        : (animal.quantity ?? 0) > 0)
  )
}

export function pickupAnimalResource(
  animal: AnimalLootSource,
  unit: UnitEntity,
  resource: keyof ResourceAmount,
  amount?: number
): number {
  if (!animal.isDead || animal.isDestroyed) return 0
  initializeAnimalCorpseLoot(animal)
  const moved = moveInventoryResource(
    createInventoryContainer(animal, { id: 'animal', labelKey: 'animal' }),
    createInventoryContainer(unit, {
      id: 'unit',
      labelKey: 'unit',
      maxAcceptableResourceAmount: () => getUnitResourceCarryRemaining(unit),
    }),
    resource,
    amount
  )
  if (moved) syncAnimalLootQuantity(animal)
  return moved
}

export function canRecoverAnimalLootForDelivery(animal: AnimalLootSource, unit: UnitEntity): boolean {
  if (!hasAnimalCorpseLoot(animal) || getUnitResourceCarryRemaining(unit) <= 0) return false
  const resources = animal.inventory?.resources ?? { meat: animal.quantity ?? 0 }
  return Object.entries(resources).some(([resource, amount]) => {
    if (!amount) return false
    if (unit.owner && collectiveHarvestBudget(unit.owner, unit, resource as keyof ResourceAmount) <= 0) return false
    const probe = Object.assign(Object.create(unit) as UnitEntity, {
      inventory: { resources: { [resource]: resource === 'meat' ? personalFoodReserve() + 1 : 1 } },
    })
    return (
      Boolean(findResourceDeliveryTarget(probe)) ||
      (resource === 'meat' && materialAmount(unit.inventory?.resources ?? {}, 'food') < personalFoodReserve())
    )
  })
}

/** Use the normal delivery routing rules before adding a resource to the hunter's bag. */
export function takeAnimalLootForDelivery(animal: AnimalLootSource, unit: UnitEntity): number {
  initializeAnimalCorpseLoot(animal)
  let moved = 0
  const resources = animal.inventory?.resources ?? {}
  const keys = Object.keys(resources) as Array<keyof ResourceAmount>
  keys.sort((a, b) => Number(b === 'meat') - Number(a === 'meat'))
  for (const resource of keys) {
    const probe = Object.assign(Object.create(unit) as UnitEntity, {
      inventory: { resources: { [resource]: resource === 'meat' ? personalFoodReserve() + 1 : 1 } },
    })
    const depot = findResourceDeliveryTarget(probe)
    if (!depot) {
      if (resource === 'meat')
        moved += pickupAnimalResource(
          animal,
          unit,
          resource,
          Math.max(0, personalFoodReserve() - materialAmount(unit.inventory?.resources ?? {}, 'food'))
        )
      continue
    }
    const room = Math.max(
      0,
      getBuildingStorageRemaining(depot) -
        Object.entries(unit.inventory?.resources ?? {}).reduce(
          (sum, [key, n]) =>
            sum + (buildingAcceptsInventoryResource(depot, key as keyof ResourceAmount) ? (n ?? 0) : 0),
          0
        )
    )
    const budget = unit.owner ? collectiveHarvestBudget(unit.owner, unit, resource) : Infinity
    moved += pickupAnimalResource(animal, unit, resource, Math.min(room, budget))
  }
  if (moved > 0) notifyVillageWorkChanged(unit.owner)
  return moved
}
