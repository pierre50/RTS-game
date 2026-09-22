import type { Modal } from '../../lib'
import type { AnimalEntity } from '../../types/entities'
import type { MenuHost } from '../MenuHost'
import { initializeAnimalCorpseLoot, pickupAnimalResource } from '../../lib/equipment/animalCorpseLoot'
import { createInventoryContainer } from '../../lib/inventory/inventoryContainers'
import { createInspectionModal } from '../InspectionPanel'
import { createTitledEntityInfoContent } from '../EntityInfoContent'
import { getEntityDisplayName } from '../utils/entityDisplayName'
import { createHeroBagContainer } from './HeroBagContainer'
import { InventoryTransferPanel } from './InventoryTransferPanel'

export class AnimalInventoryScreen {
  readonly element = document.createElement('div')
  constructor(
    private menu: MenuHost,
    private animal: AnimalEntity
  ) {
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
    this.element.replaceChildren(createTitledEntityInfoContent(menu.context.app, animal))
    const hero = menu.context.controls.heroUnit
    if (!hero || animal.isDestroyed || !animal.isDead) return
    initializeAnimalCorpseLoot(animal)
    const source = createHeroBagContainer(hero, menu)
    const destination = createInventoryContainer(animal, {
      id: animal.label,
      labelKey: 'animal',
      label: getEntityDisplayName(animal),
    })
    const transfer = new InventoryTransferPanel({
      context: menu.context,
      source,
      destination,
      canTransfer: from => from === destination && !animal.isDestroyed,
      moveResource: (_from, _to, resource, amount) => pickupAnimalResource(animal, hero, resource, amount),
      onChange: () => {
        menu.updateHeroStatus?.(hero)
        menu.refreshInventory?.()
      },
    })
    this.element.appendChild(transfer.element)
  }
}
