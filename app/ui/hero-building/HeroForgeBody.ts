import { RESOURCE_ICON_IDS } from '../../constants'
import { renderBuildingAvatar } from '../../lib/avatar'
import { getIconPath } from '../../lib/graphics/assets'
import {
  canCraftHeroRecipe,
  craftHeroRecipe,
  getAvailableHeroCraftRecipes,
  getMissingCraftResources,
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

export class HeroForgeBody {
  craftPanel = document.createElement('div')

  constructor(
    private menu: MenuHost,
    private building: BuildingEntity
  ) {
    this.craftPanel.className = 'forge-craft-body inventory-section-list'
    this.renderCraft()
  }

  canUse(): boolean {
    const hero = this.menu.context.controls.heroUnit
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
  ): Array<{ text: string; className: string }> {
    const { player } = this.menu.context
    const totals = getPlayerResourceTotals(player, { hero, includeHero: Boolean(hero) })
    return inventoryCostMetaParts(cost, totals)
  }

  getCraftMissingResourceMessage(cost: ResourceAmount): string {
    const { player } = this.menu.context
    const hero = this.menu.context.controls.heroUnit
    const missing = getMissingCraftResources(player, cost, hero)
    const resource = Object.keys(missing)
      .map(key => t(key))
      .join(', ')
    return t('needMore', { resource })
  }

  createCraftButton(recipe: HeroCraftRecipe): HTMLElement {
    const { app, player } = this.menu.context
    const hero = this.menu.context.controls.heroUnit
    const disabled = !this.canUse() || !hero || !canCraftHeroRecipe(player, recipe, hero)
    const { element, icon } = createInventoryActionRow(this.menu, {
      id: `craft-${recipe.id}`,
      className: 'inventory-craft-row',
      disabled,
      title: t(recipe.labelKey),
      description: t(recipe.descriptionKey ?? 'craftArrowDescription'),
      meta: '',
      metaParts: this.getCraftCostMetaParts(recipe.cost, hero),
      trailingAction: {
        disabled,
        label: t('inventoryTabCraft'),
        onClick: () => {
          if (!hero || !this.canUse()) return
          if (!craftHeroRecipe(player, hero, recipe)) {
            this.menu.showMessage(this.getCraftMissingResourceMessage(recipe.cost), 'warning')
            this.renderCraft()
            return
          }
          this.menu.updateTopbar?.()
          this.menu.showMessage(
            t('craftRecipeSuccess', { item: t(recipe.labelKey), count: recipe.outputCount }),
            'success'
          )
          this.renderCraft()
        },
      },
    })
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

  renderCraft(): void {
    this.craftPanel.textContent = ''
    for (const recipe of getAvailableHeroCraftRecipes(this.menu.context.player)) {
      this.craftPanel.appendChild(this.createCraftButton(recipe))
    }
  }
}
