import { canForgeProduce } from '../../equipment/forgeProduction'
import { getBuildingLevel } from '../../buildings/buildingLevel'
import { isCommunalResourceStore } from '../../economy/constructionStores'
import { observeEconomyChange, recordEconomyFlow } from '../../economy/economyTelemetry'
import { equipmentBaseKey, isEquipmentBroken } from '../../equipment/equipmentCondition'
import { HERO_CRAFT_RECIPES } from '../../hero/heroCraftRecipes'
import { getBaseTerritory } from '../../territory/baseTerritory'
import { getPlayerResourceTotals, withdrawChestResources } from '../../resources/playerResourceTotals'
import type { ResourceStoreOwner } from '../../resources/playerResourceStores'
import type { BuildingEntity, UnitEntity } from '../../../types/entities'
import type { PlayerLike } from '../../../types/player'
import type { SaveEntityState, SavePlayerState } from '../../../types/save'

type SupplyOwner = PlayerLike | SavePlayerState
export type SupplyUnit = UnitEntity | SaveEntityState

/** Only public local depots and workshops supply residents; private chests and markets do not. */
export function townSupplies(unit: SupplyUnit, owner: SupplyOwner) {
  const town = getBaseTerritory({ i: unit.i, j: unit.j, spaceId: unit.spaceId }, [owner])?.center
  if (!town) return undefined
  const buildings = (owner.buildings ?? [])
    .flatMap(building => [building, ...(building.interiorBuildings ?? [])])
    .filter(
      building =>
        building.isBuilt !== false &&
        !building.isDead &&
        !building.isDestroyed &&
        (!('owner' in building) || !building.owner || building.owner.label === owner.label) &&
        getBaseTerritory(building, [owner])?.center === town
    )
  const stores = buildings.filter(
    building =>
      ['TownCenter', 'StoragePit', 'Granary', 'Forge'].includes(building.type) ||
      (building.type === 'Chest' && isCommunalResourceStore(building, owner))
  )
  const forge = buildings
    .filter(building => building.type === 'Forge' && building.isBuilt)
    .sort((a, b) => getBuildingLevel(b) - getBuildingLevel(a))[0]
  const depot =
    stores.find(building => building.type === 'Chest') ??
    stores.find(building => building.type === 'StoragePit') ??
    stores.find(building => building === town)!
  return {
    town,
    stores,
    forge,
    depot,
    ledger: owner as ResourceStoreOwner,
    payment: { includeHero: false, settlement: town },
  }
}

export function storeTownEquipment(store: BuildingEntity | SaveEntityState, item: string, count = 1): void {
  store.inventory ??= {}
  store.inventory.equipment ??= []
  store.inventory.equipment.push(...Array<string>(count).fill(item))
}

/** Existing equipment is usable without a workshop; only production checks the recipe station. */
export function takeOrCraftTownEquipment(unit: SupplyUnit, owner: SupplyOwner, item: string): string | undefined {
  const supplies = townSupplies(unit, owner)
  if (!supplies) return undefined
  for (const store of supplies.stores) {
    const index =
      store.inventory?.equipment?.findIndex(stock => equipmentBaseKey(stock) === item && !isEquipmentBroken(stock)) ??
      -1
    if (index >= 0) return store.inventory!.equipment!.splice(index, 1)[0]
  }
  const recipe = HERO_CRAFT_RECIPES.find(recipe => recipe.outputEquipment === item)
  if (!recipe || (recipe.station !== 'inventory' && !(recipe.station === 'forge' && supplies.forge))) return undefined
  if (recipe.station === 'forge' && !canForgeProduce(recipe, supplies.forge)) return undefined
  if (
    !observeEconomyChange(
      owner,
      'craftConsumed',
      () => getPlayerResourceTotals(supplies.ledger, supplies.payment),
      'removed',
      () => withdrawChestResources(supplies.ledger, recipe.cost, supplies.payment)
    )
  )
    return undefined
  recordEconomyFlow(owner, 'craftProduced', { ['item:' + item]: recipe.outputCount })
  return item
}
