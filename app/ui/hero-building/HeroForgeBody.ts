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
import { createInventorySection } from '../inventory/InventorySection'
import { canManageForge, canResearchForgeUpgrade, researchForgeUpgrade } from '../../lib/equipment/forgeResearch'
import {
  FORGE_FAMILIES,
  FORGE_ICONS,
  FORGE_MATERIALS,
  getForgeTier,
  getForgeUpgradeCost,
  type ForgeFamily,
} from '../../lib/equipment/forgeUpgrades'

export class HeroForgeBody {
  craftPanel = document.createElement('div')

  constructor(
    private menu: MenuHost,
    private building: BuildingEntity
  ) {
    this.craftPanel.className = 'forge-body'
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
    const recipes = getAvailableHeroCraftRecipes(this.menu.context.player)
    for (const [title, items] of [
      ['forgeCategoryEquipment', recipes.filter(recipe => !recipe.iconResource && !recipe.id.startsWith('arrow_'))],
      ['forgeCategoryConsumables', recipes.filter(recipe => recipe.iconResource)],
      ['forgeCategoryArrows', recipes.filter(recipe => recipe.id.startsWith('arrow_'))],
    ] as const) {
      if (!items.length) continue
      this.appendSection(t(title), grid => items.forEach(recipe => grid.appendChild(this.createCraftButton(recipe))))
    }
    // Village upgrades follow the hero's own crafting; the scope notice opens them once.
    const scope = t(
      canManageForge(this.menu.context.player, this.building, this.menu.context.controls.heroUnit)
        ? 'forgeUpgradeScope'
        : 'forgeUpgradeRequiresCommand'
    )
    for (const [title, families, description] of [
      ['forgeCategoryTools', FORGE_FAMILIES.slice(0, 3), scope],
      ['forgeCategoryMilitary', FORGE_FAMILIES.slice(3), undefined],
    ] as const) {
      this.appendSection(
        t(title),
        grid => families.forEach(family => grid.appendChild(this.createUpgradeButton(family))),
        description
      )
    }
  }

  private appendSection(title: string, renderItems: (grid: HTMLDivElement) => void, description?: string): void {
    this.craftPanel.appendChild(
      createInventorySection({
        title,
        description,
        gridClassName: 'forge-craft-body inventory-section-list',
        renderItems,
      })
    )
  }

  createUpgradeButton(family: ForgeFamily): HTMLElement {
    const { player, controls } = this.menu.context
    const tier = getForgeTier(player, family)
    const maximum = tier === 3
    const nextTier = Math.min(3, tier + 1)
    const cost = getForgeUpgradeCost(family, nextTier)
    const title = maximum ? t(`forgeFamily_${family}`) : t('forgeUpgradeTitle', {
      current: t(`forgeMaterial_${FORGE_MATERIALS[tier]}`),
      family: t(`forgeFamily_${family}`),
      material: t(`forgeMaterial_${FORGE_MATERIALS[nextTier]}`),
    })
    const disabled = maximum || !canResearchForgeUpgrade(player, this.building, family, controls.heroUnit)
    const { element, icon } = createInventoryActionRow(this.menu, {
      id: `forge-upgrade-${family}`,
      title,
      description: t(`forgeEffect_${family}`),
      badge: maximum ? t('forgeMaximum') : undefined,
      meta: maximum ? t('forgeCurrentMaterial', { material: t(`forgeMaterial_${FORGE_MATERIALS[tier]}`) }) : '',
      metaParts: maximum ? [] : inventoryCostMetaParts(cost, getPlayerResourceTotals(player, { includeHero: false })),
      disabled,
      trailingAction: {
        label: t(maximum ? 'forgeMaximum' : 'forgeUpgradeAction'),
        disabled,
        title: !disabled || maximum ? undefined : t(
          !this.canUse() ? 'forgeRequiresAccess'
            : !canManageForge(player, this.building, controls.heroUnit) ? 'forgeUpgradeRequiresCommand'
              : 'forgeResourcesMissing'
        ),
        onClick: () => {
          if (!researchForgeUpgrade(player, this.building, family, nextTier, controls.heroUnit)) {
            this.menu.showMessage(t('forgeUpgradeUnavailable'), 'warning')
          } else {
            this.menu.showMessage(t('forgeUpgradeSuccess', { item: title }), 'success')
            this.menu.updateTopbar?.()
          }
          this.renderCraft()
          this.craftPanel.querySelector<HTMLButtonElement>(`#forge-upgrade-${family} button`)?.focus()
        },
      },
    })
    icon.appendChild(
      createInventoryEquipmentIcon(this.menu.context, `${FORGE_ICONS[family]}_${FORGE_MATERIALS[nextTier]}`, 'craft')
    )
    return element
  }
}
