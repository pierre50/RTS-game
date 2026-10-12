import {
  canRepairEquipment,
  getEquipmentRepairCost,
  getEquipmentRepairTargets,
  repairEquipment,
  type EquipmentRepairTarget,
} from '../../lib/equipment/equipmentRepair'
import { t } from '../../lib/lang'
import { getEquipmentStacks } from '../../lib/equipment/equipmentLoot'
import type { ResourceAmount } from '../../types/common'
import type { BuildingEntity } from '../../types/entities'
import type { MenuHost } from '../MenuHost'
import { createInventoryEquipmentRow } from '../inventory/InventoryItemRows'
import {
  appendInventoryScrollBody,
  createInventorySection,
  createInventorySectionTitle,
} from '../inventory/InventorySection'
import type { inventoryCostMetaParts } from '../inventory/InventoryCostMeta'

type ForgeRepairInventoryOptions = {
  menu: MenuHost
  building: BuildingEntity
  costParts: (cost: ResourceAmount) => ReturnType<typeof inventoryCostMetaParts>
  refresh: () => void
}

/** Shared inventory rows and stacks, filtered to equipment that needs repair. */
export function createForgeRepairInventory(options: ForgeRepairInventoryOptions): HTMLElement {
  const { menu, building, refresh } = options
  const { player, controls } = menu.context
  const hero = controls.heroUnit
  const panel = document.createElement('div')
  panel.className = 'forge-repair-inventory inventory-tile-grid'
  if (!hero) return panel
  const targets = getEquipmentRepairTargets(hero)
  panel.appendChild(createInventorySectionTitle(t('forgeRepairTitle')))
  const body = appendInventoryScrollBody(panel)
  if (!targets.length) {
    const empty = document.createElement('p')
    empty.className = 'inventory-transfer-empty'
    empty.textContent = t('forgeRepairNothing')
    body.appendChild(empty)
    return panel
  }
  const createEquipment = (count: number, id: string, target: EquipmentRepairTarget): HTMLElement => {
    const { element } = createInventoryEquipmentRow(menu.context, {
      id,
      equipment: target.item,
      count,
      showValue: false,
      className: 'forge-repairable-item',
      description: t('forgeRepairItemDescription'),
      metaParts: options.costParts(getEquipmentRepairCost(target.item)),
      trailingAction: {
        label: t('forgeRepairAction'),
        disabled: !canRepairEquipment(player, hero, building, target),
        onClick: () => {
          if (repairEquipment(player, hero, building, target)) {
            menu.updateTopbar?.()
            menu.showMessage(t('forgeRepairSuccess'), 'success')
          }
          refresh()
        },
      },
    })
    element.title = element.getAttribute('aria-label') ?? ''
    return element
  }
  const bagTargets = targets.filter(target => target.location === 'bag')
  if (bagTargets.length) {
    const bag = createInventorySection({
      title: t('inventoryYourBag'),
      presentation: 'items',
      renderItems: grid => {
        for (const stack of getEquipmentStacks(bagTargets.map(target => target.item))) {
          const target = bagTargets.find(target => target.item === stack.equipment)!
          grid.appendChild(createEquipment(stack.count, `forge-bag-${stack.equipment}`, target))
        }
      },
    })
    body.appendChild(bag)
  }

  // Keep repair access to worn gear without pretending that it occupies bag capacity.
  const equipped = targets.filter(target => target.location !== 'bag')
  if (equipped.length) {
    const section = createInventorySection({
      title: t('inventoryEquippedEquipment'),
      presentation: 'items',
      renderItems: grid => {
        for (const target of equipped) {
          grid.appendChild(createEquipment(1, `forge-${target.location}-${target.key}`, target))
        }
      },
    })
    body.appendChild(section)
  }
  return panel
}
