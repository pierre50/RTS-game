import { createInventoryContainer } from '../../lib/inventory/inventoryContainers'
import { t } from '../../lib/lang'
import { getUnitBagTitle, getUnitResourceCarryRemaining } from '../../lib/resources/resourceDelivery'
import type { UnitEntity } from '../../types/entities'
import type { MenuHost } from '../MenuHost'

export function createHeroBagContainer(hero: UnitEntity, menu: MenuHost) {
  return createInventoryContainer(hero, {
    id: hero.label,
    labelKey: 'inventoryYourBag',
    label: getUnitBagTitle(hero),
    maxAcceptableResourceAmount: () => getUnitResourceCarryRemaining(hero),
    onResourceRejected: () => menu.showMessage(t('heroBagFull'), 'warning'),
    canAcceptEquipment: () => getUnitResourceCarryRemaining(hero) > 0,
    onEquipmentRejected: () => menu.showMessage(t('heroBagFull'), 'warning'),
  })
}
