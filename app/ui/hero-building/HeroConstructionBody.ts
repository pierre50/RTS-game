import { FOOD_RESOURCE_NAMES } from '../../constants'
import { remainingConstructionMaterials, deliverConstructionMaterials } from '../../lib/economy/constructionMaterials'
import { createInventoryContainer } from '../../lib/inventory/inventoryContainers'
import { t } from '../../lib/lang'
import { notifyVillageWorkChanged } from '../../lib/units/village/villageWorkEvents'
import type { ResourceAmount } from '../../types/common'
import type { BuildingEntity } from '../../types/entities'
import { createHeroBagContainer } from '../inventory/HeroBagContainer'
import { InventoryTransferPanel } from '../inventory/InventoryTransferPanel'
import { createResourceCost } from '../ResourceCost'
import type { MenuHost } from '../MenuHost'

function neededAtSite(building: BuildingEntity, resource: keyof ResourceAmount): number {
  const missing = remainingConstructionMaterials(building)
  if (FOOD_RESOURCE_NAMES.includes(resource as (typeof FOOD_RESOURCE_NAMES)[number]))
    return (missing[resource] ?? 0) + (missing.food ?? 0)
  return missing[resource] ?? 0
}

export function createHeroConstructionBody(
  building: BuildingEntity,
  menu: MenuHost,
  onChange: () => void
): HTMLElement | null {
  const hero = menu.context.controls.heroUnit
  if (!hero || building.owner !== hero.owner || building.isBuilt || !building.constructionMaterials) return null

  const missing = remainingConstructionMaterials(building)
  if (!Object.keys(missing).length) {
    const ready = document.createElement('div')
    ready.className = 'construction-ready-instruction'
    ready.textContent = t('constructionReadyInstruction')
    return ready
  }

  const ledger = building.constructionMaterials
  const site = createInventoryContainer(
    {},
    {
      id: `construction-${building.label}`,
      labelKey: 'constructionSiteHeading',
      canAcceptResource: resource => neededAtSite(building, resource) > 0 && !building.constructionPaused,
      maxAcceptableResourceAmount: resource => (building.constructionPaused ? 0 : neededAtSite(building, resource)),
      onResourceRejected: () => menu.showMessage(t('constructionMaterialNotNeeded'), 'warning'),
    }
  )
  const bag = createHeroBagContainer(hero, menu)
  const panel = new InventoryTransferPanel({
    context: menu.context,
    destination: site,
    source: bag,
    canTransfer: source => source.id === bag.id,
    visibleInventory: container =>
      container.id === site.id
        ? { resources: {}, equipment: [] }
        : {
            resources: Object.fromEntries(
              Object.entries(hero.inventory?.resources ?? {}).filter(
                ([resource, amount]) => amount > 0 && neededAtSite(building, resource as keyof ResourceAmount) > 0
              )
            ) as ResourceAmount,
            equipment: [],
          },
    emptyText: container => (container.id === bag.id ? t('constructionNoUsefulMaterials') : t('inventoryEmptySlot')),
    showItemCount: container => container.id === bag.id,
    additionalItems: container => {
      if (container.id !== site.id) return []
      const progress: ResourceAmount = {}
      for (const key of Object.keys(ledger.cost) as Array<keyof ResourceAmount>) {
        progress[key] = (ledger.delivered[key] ?? 0) + (ledger.consumed[key] ?? 0)
      }
      return [
        createResourceCost({ mode: 'progress', cost: ledger.cost, progress, showResourceNames: true, heading: '' }),
      ]
    },
    moveResource: (source, destination, resource, requested) => {
      if (source.id !== bag.id || destination.id !== site.id) return 0
      const available = Math.max(0, Math.floor(source.inventory.resources?.[resource] ?? 0))
      const amount = Math.min(available, requested ?? available, neededAtSite(building, resource))
      if (amount <= 0) return 0
      const delivered = deliverConstructionMaterials(building, [{ [resource]: amount }])
      const moved = Object.values(delivered).reduce((total, value) => total + value, 0)
      if (moved > 0) {
        source.inventory.resources![resource] = available - moved
        if (!source.inventory.resources![resource]) delete source.inventory.resources![resource]
      }
      return moved
    },
    onTransfer: () => notifyVillageWorkChanged(hero.owner),
    onChange,
  })
  panel.element.classList.add('construction-transfer-panel')
  return panel.element
}
