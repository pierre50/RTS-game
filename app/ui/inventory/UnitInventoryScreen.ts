import { createInventoryContainer } from '../../lib/inventory/inventoryContainers'
import {
  getUnitCorpseLootEquipment,
  getUnitCorpseLootResources,
  pickupCorpseEquipment,
  pickupCorpseResource,
} from '../../lib/equipment/equipmentLoot'
import { t } from '../../lib/lang'
import { createTitledEntityInfoContent } from '../EntityInfoContent'
import { createInspectionModal } from '../InspectionPanel'
import { getEntityDisplayName } from '../utils/entityDisplayName'
import { InventoryTransferPanel } from './InventoryTransferPanel'
import type { UnitEntity } from '../../types/entities'
import type { MenuHost } from '../MenuHost'
import type { Modal } from '../../lib'

/** The same character inventory screen serves conversations and corpse inspection. */
export class UnitInventoryScreen {
  readonly element = document.createElement('div')

  constructor(
    private menu: MenuHost,
    private unit: UnitEntity
  ) {
    this.element.className = 'unit-inventory-screen'
    this.render()
  }

  open(onClose: () => void): Modal {
    return createInspectionModal({
      proximity: { context: this.menu.context, targets: () => [this.unit] },
      title: getEntityDisplayName(this.unit),
      inspection: false,
      panelClass: 'inventory-transfer-modal',
      content: this.element,
      onClose,
    })
  }

  render(): void {
    const { menu, unit } = this
    const hero = menu.context.controls.heroUnit
    const content = createTitledEntityInfoContent(menu.context.app, unit)
    this.element.replaceChildren(content)
    if (!hero || unit.isDestroyed) return

    const source = createInventoryContainer(hero, { id: hero.label, labelKey: 'inventoryYourBag' })
    const destination = unit.isDead
      ? {
          id: unit.label,
          labelKey: 'inventoryBag',
          inventory: {
            equipment: getUnitCorpseLootEquipment(unit),
            resources: getUnitCorpseLootResources(unit),
          },
        }
      : createInventoryContainer(unit, { id: unit.label, labelKey: 'inventoryBag' })
    const transfer = new InventoryTransferPanel({
      context: menu.context,
      source,
      destination,
      canTransfer: () => !unit.isDestroyed,
      ...(unit.isDead
        ? {
            canTransfer: from => from === destination && !unit.isDestroyed,
            moveEquipment: (_from, _to, equipment) => pickupCorpseEquipment(unit, hero, equipment),
            moveResource: (_from, _to, resource, amount) => pickupCorpseResource(unit, hero, resource, amount),
          }
        : {}),
      onChange: () => menu.updateHeroStatus?.(hero),
    })
    const info = content.classList.contains('selection-info') ? content : content.querySelector('.selection-info')
    ;(info ?? content).appendChild(transfer.element)
    this.element.setAttribute('aria-label', t('inventoryNpcBag', { name: getEntityDisplayName(unit) }))
  }
}
