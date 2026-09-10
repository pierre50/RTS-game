import { BUILDING_TYPES } from '../../constants'
import { createInventoryContainer, type InventoryContainer } from '../../lib/inventory/inventoryContainers'
import { applyTheftConsequences, THEFT_SUBJECT_TYPES } from '../../lib/theft/theft'
import { InventoryTransferPanel } from '../inventory/InventoryTransferPanel'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { MenuHost } from '../MenuHost'

function isForeignOwnedBuildingForHero(building: BuildingEntity, hero: UnitEntity | null | undefined): boolean {
  const heroOwner = hero?.owner
  const buildingOwner = building.owner
  return Boolean(heroOwner?.isPlayed && buildingOwner && heroOwner.label !== buildingOwner.label)
}

export function createHeroBuildingContainerBody(
  building: BuildingEntity,
  menu: MenuHost,
  onChange: () => void
): InventoryTransferPanel | null {
  if (building.type !== BUILDING_TYPES.chest) return null
  const hero = menu.context.controls.heroUnit
  if (!hero) return null

  const chestContainer = createInventoryContainer(building, {
    id: building.label,
    labelKey: 'inventoryChest',
  })
  const heroContainer = createInventoryContainer(hero, {
    id: hero.label,
    labelKey: 'inventoryYourBag',
  })

  return new InventoryTransferPanel({
    context: menu.context,
    destination: chestContainer,
    isTheftTransfer: (source: InventoryContainer, transferTarget: InventoryContainer) =>
      source.id === chestContainer.id &&
      transferTarget.id === heroContainer.id &&
      isForeignOwnedBuildingForHero(building, hero),
    source: heroContainer,
    onChange,
    onTransfer: event => {
      if (
        event.source.id !== chestContainer.id ||
        event.destination.id !== heroContainer.id ||
        !isForeignOwnedBuildingForHero(building, hero)
      ) {
        return
      }
      applyTheftConsequences({
        actor: hero,
        owner: building.owner ?? null,
        subject: THEFT_SUBJECT_TYPES.chest,
        target: building,
      })
    },
  })
}
