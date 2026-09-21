import type { Modal } from '../../lib'
import {
  getUnitCorpseLootEquipment,
  getUnitCorpseLootResources,
  pickupCorpseEquipment,
  pickupCorpseResource,
} from '../../lib/equipment/equipmentLoot'
import { createInventoryContainer } from '../../lib/inventory/inventoryContainers'
import { t } from '../../lib/lang'
import { getUnitBagTitle, getUnitResourceCarryRemaining } from '../../lib/resources/resourceDelivery'
import type { UnitEntity } from '../../types/entities'
import { createTitledEntityInfoContent } from '../EntityInfoContent'
import { createInspectionModal } from '../InspectionPanel'
import type { MenuHost } from '../MenuHost'
import { getEntityDisplayName } from '../utils/entityDisplayName'
import { createHeroBagContainer } from './HeroBagContainer'
import { InventoryTransferPanel } from './InventoryTransferPanel'

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

    const source = createHeroBagContainer(hero, menu)
    const destination = unit.isDead
      ? {
          id: unit.label,
          labelKey: 'inventoryNpcBag',
          label: t('inventoryNpcBag', { name: getEntityDisplayName(unit) }),
          inventory: {
            equipment: getUnitCorpseLootEquipment(unit),
            resources: getUnitCorpseLootResources(unit),
          },
        }
      : createInventoryContainer(unit, {
          id: unit.label,
          labelKey: 'inventoryNpcBag',
          label: getUnitBagTitle(unit, getEntityDisplayName(unit)),
          maxAcceptableResourceAmount: () => getUnitResourceCarryRemaining(unit),
          onResourceRejected: () => menu.showMessage(t('unitResourceCarryFull'), 'warning'),
          canAcceptEquipment: () => getUnitResourceCarryRemaining(unit) > 0,
          onEquipmentRejected: () => menu.showMessage(t('unitResourceCarryFull'), 'warning'),
        })
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
      onChange: () => {
        source.label = getUnitBagTitle(hero)
        if (!unit.isDead) destination.label = getUnitBagTitle(unit, getEntityDisplayName(unit))
        menu.updateHeroStatus?.(hero)
      },
    })
    this.element.appendChild(transfer.element)
    this.element.setAttribute('aria-label', t('inventoryNpcBag', { name: getEntityDisplayName(unit) }))
  }
}
