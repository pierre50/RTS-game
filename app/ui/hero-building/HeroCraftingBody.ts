import { getEquipmentDurability } from '../../lib/equipment/equipmentCondition'
import { getHeroCraftRecipeLabel } from '../../lib/hero/heroCraftLabels'
import { RESOURCE_ICON_IDS } from '../../constants'
import { renderBuildingAvatar } from '../../lib/avatar'
import { getIconPath } from '../../lib/graphics/assets'
import {
  canCraftHeroRecipe,
  craftHeroRecipe,
  getMissingCraftResources,
  getMaxHeroCraftCount,
  getHeroCraftPayment,
  type HeroCraftRecipe,
} from '../../lib/hero/heroCrafting'
import { isHeroInteractionTargetReachable } from '../../lib/hero/heroActionRange'
import { getPlaceableInventoryBuildingType } from '../../lib/hero/placeableInventoryItems'
import { t } from '../../lib/lang'
import { getPlayerResourceTotals } from '../../lib/resources/playerResourceTotals'
import type { ResourceAmount } from '../../types/common'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { MenuHost } from '../MenuHost'
import { createInventoryActionRow } from '../inventory/InventoryActionRow'
import { inventoryCostMetaParts } from '../inventory/InventoryCostMeta'
import { createInventoryEquipmentIcon } from '../inventory/InventoryItemIcons'
import { createInventorySection } from '../inventory/InventorySection'

export abstract class HeroCraftingBody<B extends BuildingEntity | undefined = BuildingEntity> {
  craftPanel = document.createElement('div')

  constructor(
    protected menu: MenuHost,
    protected building: B
  ) {
    this.craftPanel.className = 'forge-body'
    if (this.building) this.renderCraft()
  }

  abstract renderCraft(): void

  canUse(): boolean {
    const hero = this.menu.context.controls.heroUnit
    if (!this.building) return Boolean(hero && !hero.isDead && !hero.isDestroyed)
    return Boolean(
      hero &&
        this.building.isBuilt &&
        !this.building.isDead &&
        !this.building.isDestroyed &&
        isHeroInteractionTargetReachable(hero, null, this.building)
    )
  }

  getCraftCostMetaParts(
    cost: ResourceAmount,
    hero: UnitEntity | null | undefined
  ): ReturnType<typeof inventoryCostMetaParts> {
    const { player } = this.menu.context
    const totals = getPlayerResourceTotals(player, {
      hero,
      includeHero: Boolean(hero),
      settlement: this.building ?? hero,
    })
    return inventoryCostMetaParts(cost, totals)
  }

  getCraftMissingResourceMessage(cost: ResourceAmount): string {
    const { player } = this.menu.context
    const hero = this.menu.context.controls.heroUnit
    const missing = getMissingCraftResources(player, cost, hero, this.building)
    const resource = Object.keys(missing)
      .map(key => t(key))
      .join(', ')
    return t('needMore', { resource })
  }

  createCraftButton(recipe: HeroCraftRecipe): HTMLElement {
    const { app, player } = this.menu.context
    const hero = this.menu.context.controls.heroUnit
    const label = getHeroCraftRecipeLabel(recipe)
    const actionLabel = t(
      recipe.category === 'cooking'
        ? 'campfireCook'
        : recipe.station === 'campfire'
          ? 'campfirePrepare'
          : 'craftAction'
    )
    const cost = getHeroCraftPayment(recipe, hero).cost
    const batchCount = Math.min(10, getMaxHeroCraftCount(player, recipe, hero, this.building))
    const batchLabel = `${actionLabel} ${batchCount || 10}`
    const disabled = !this.canUse() || !hero || !canCraftHeroRecipe(player, recipe, hero, this.building)
    const { element, icon } = createInventoryActionRow({
      id: `craft-${recipe.id}`,
      className: 'inventory-craft-row',
      disabled,
      title: label,
      quantity: recipe.outputCount,
      durability: getEquipmentDurability(recipe.outputEquipment),
      description: t(recipe.descriptionKey ?? 'craftArrowDescription'),
      meta: '',
      metaParts: Object.keys(cost).length
        ? this.getCraftCostMetaParts(cost, hero)
        : [{ text: t('craftPreparedMaterials') }],
      trailingAction: {
        disabled,
        label: `${actionLabel} 1`,
        title: t('craftBatchShortcut', { action: batchLabel }),
        onClick: event => {
          if (!hero || !this.canUse()) return
          const count = (event as MouseEvent)?.shiftKey
            ? Math.min(10, getMaxHeroCraftCount(player, recipe, hero, this.building))
            : 1
          if (!craftHeroRecipe(player, hero, recipe, count, this.building)) {
            this.menu.showMessage(
              this.getCraftMissingResourceMessage(getHeroCraftPayment(recipe, hero).cost),
              'warning'
            )
            this.renderCraft()
            return
          }
          this.menu.updateTopbar?.()
          this.menu.showMessage(t('craftRecipeSuccess', { item: label, count: recipe.outputCount * count }), 'success')
          this.renderCraft()
        },
      },
    })
    const action = element.querySelector<HTMLButtonElement>('.inventory-row-action-button')
    if (action) action.dataset.craftBatchLabel = batchLabel
    const placeableBuildingType = getPlaceableInventoryBuildingType(recipe.outputEquipment)
    if (recipe.iconResource) {
      const resourceIcon = document.createElement('img')
      resourceIcon.className = 'img inventory-resource-icon'
      resourceIcon.src = getIconPath(RESOURCE_ICON_IDS[recipe.iconResource].commodity)
      resourceIcon.alt = ''
      icon.appendChild(resourceIcon)
    } else {
      if (placeableBuildingType) {
        const img = document.createElement('img')
        img.className = 'img'
        img.alt = ''
        const canvas = document.createElement('canvas')
        canvas.width = 120
        canvas.height = 120
        renderBuildingAvatar(app, placeableBuildingType, player, canvas)
        img.src = canvas.toDataURL()
        icon.appendChild(img)
      } else {
        icon.appendChild(createInventoryEquipmentIcon(this.menu.context, recipe.outputEquipment, 'craft'))
      }
    }
    return element
  }

  protected appendSection(
    title: string,
    renderItems: (grid: HTMLDivElement) => void,
    description?: string,
    parent: HTMLElement = this.craftPanel
  ): HTMLElement {
    const section = createInventorySection({
      title,
      description,
      gridClassName: 'forge-craft-body inventory-section-list',
      presentation: 'recipes',
      renderItems,
    })
    parent.appendChild(section)
    return section
  }
}
