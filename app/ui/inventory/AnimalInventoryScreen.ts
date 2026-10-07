import { t } from '../../lib/lang'
import { getUnitBagTitle } from '../../lib/resources/resourceDelivery'
import { createTitledEntityInfoContent } from '../inspection/EntityInfoContent'
import type { Modal } from '../../lib'
import type { AnimalEntity } from '../../types/entities'
import type { MenuHost } from '../MenuHost'
import { initializeAnimalCorpseLoot, pickupAnimalResource } from '../../lib/equipment/animalCorpseLoot'
import { createInventoryContainer, moveInventoryResource } from '../../lib/inventory/inventoryContainers'
import { createInspectionModal } from '../inspection/InspectionPanel'
import { getEntityDisplayName } from '../utils/entityDisplayName'
import { createHeroBagContainer } from './HeroBagContainer'
import { InventoryTransferPanel } from './InventoryTransferPanel'

export class AnimalInventoryScreen {
  readonly element = document.createElement('div')
  constructor(
    private menu: MenuHost,
    private animal: AnimalEntity
  ) {
    this.element.className = 'unit-inventory-screen'
    this.render()
  }

  open(onClose: () => void): Modal {
    return createInspectionModal({
      proximity: { context: this.menu.context, targets: () => [this.animal] },
      title: getEntityDisplayName(this.animal),
      inspection: false,
      panelClass: 'inventory-transfer-modal',
      content: this.element,
      onClose,
    })
  }

  render(): void {
    const { menu, animal } = this
    this.element.replaceChildren()
    const hero = menu.context.controls.heroUnit
    if (!hero || animal.isDestroyed || !animal.isDead) return
    initializeAnimalCorpseLoot(animal)
    const source = createHeroBagContainer(hero, menu)
    const lootLabel = () =>
      t('animalLootCount', {
        name: getEntityDisplayName(animal),
        count:
          (animal.inventory?.equipment?.length ?? 0) +
          Object.values(animal.inventory?.resources ?? {}).reduce(
            (sum, amount) => sum + Math.max(0, Math.floor(amount ?? 0)),
            0
          ),
      })
    const destination = createInventoryContainer(animal, {
      id: animal.label,
      labelKey: 'animal',
      label: lootLabel(),
    })
    const transfer = new InventoryTransferPanel({
      context: menu.context,
      source,
      destination,
      canTransfer: () => !animal.isDestroyed,
      moveResource: (from, to, resource, amount) => {
        if (from === destination) return pickupAnimalResource(animal, hero, resource, amount)
        const moved = moveInventoryResource(from, to, resource, amount)
        if (moved > 0) {
          initializeAnimalCorpseLoot(animal)
          animal.updateTexture?.()
        }
        return moved
      },
      onChange: () => {
        destination.label = lootLabel()
        source.label = getUnitBagTitle(hero)
        menu.updateHeroStatus?.(hero)
        menu.refreshInventory?.()
      },
    })
    this.element.appendChild(createTitledEntityInfoContent(menu.context.app, animal))
    this.element.appendChild(transfer.element)
  }
}
