import { BUILDING_TYPES } from '../../constants'
import { createInventoryContainer, type InventoryContainer } from '../../lib/inventory/inventoryContainers'
import { t } from '../../lib/lang'
import {
  buildingAcceptsInventoryResource,
  getBuildingStorageCapacity,
  getBuildingStorageRemaining,
  getUnitBagTitle,
  isStandaloneStorageChest,
} from '../../lib/resources/resourceDelivery'
import { applyTheftConsequences, THEFT_SUBJECT_TYPES } from '../../lib/theft/theft'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import { createHeroBagContainer } from '../inventory/HeroBagContainer'
import { InventoryTransferPanel } from '../inventory/InventoryTransferPanel'
import type { MenuHost } from '../MenuHost'

function isForeignOwnedBuildingForHero(building: BuildingEntity, hero: UnitEntity | null | undefined): boolean {
  const heroOwner = hero?.owner
  const buildingOwner = building.owner
  return Boolean(heroOwner?.isPlayed && buildingOwner && heroOwner.label !== buildingOwner.label)
}

function getChestResourceTotal(building: BuildingEntity): number {
  return Object.values(building.inventory?.resources ?? {}).reduce(
    (sum, amount) => sum + Math.max(0, Math.floor(amount ?? 0)),
    0
  )
}

function chestLabelWithCapacity(building: BuildingEntity): string {
  return t('inventoryChestCapacity', {
    amount: getChestResourceTotal(building),
    max: getBuildingStorageCapacity(building),
  })
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
    label: chestLabelWithCapacity(building),
    canAcceptResource: resource => buildingAcceptsInventoryResource(building, resource),
    maxAcceptableResourceAmount: () => getBuildingStorageRemaining(building),
    onResourceRejected: () => menu.showMessage(t('storageFull'), 'warning'),
  })
  const heroContainer = createHeroBagContainer(hero, menu)

  let header: HTMLButtonElement | undefined
  if (isStandaloneStorageChest(building) && building.owner && hero.owner?.label === building.owner.label) {
    header = document.createElement('button')
    header.type = 'button'
    header.className = 'ui-btn inventory-transfer-all-button'
    const refresh = () => {
      header!.textContent = t(
        building.villagerDeliveriesBlocked ? 'villagerDeliveriesBlocked' : 'villagerDeliveriesAllowed'
      )
      header!.setAttribute('aria-pressed', String(!building.villagerDeliveriesBlocked))
    }
    header.onclick = () => {
      building.villagerDeliveriesBlocked = !building.villagerDeliveriesBlocked
      refresh()
      onChange()
    }
    refresh()
  }

  return new InventoryTransferPanel({
    header,
    context: menu.context,
    destination: chestContainer,
    isTheftTransfer: (source: InventoryContainer, transferTarget: InventoryContainer) =>
      source.id === chestContainer.id &&
      transferTarget.id === heroContainer.id &&
      isForeignOwnedBuildingForHero(building, hero),
    source: heroContainer,
    onChange: () => {
      chestContainer.label = chestLabelWithCapacity(building)
      heroContainer.label = getUnitBagTitle(hero)
      onChange()
    },
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
