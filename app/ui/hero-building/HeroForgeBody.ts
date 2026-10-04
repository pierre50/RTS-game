import { getAvailableHeroCraftRecipes } from '../../lib/hero/heroCrafting'
import { t } from '../../lib/lang'
import { getPlayerResourceTotals } from '../../lib/resources/playerResourceTotals'
import { createInventoryActionRow } from '../inventory/InventoryActionRow'
import { inventoryCostMetaParts } from '../inventory/InventoryCostMeta'
import { createInventoryEquipmentIcon } from '../inventory/InventoryItemIcons'
import { HeroCraftingBody } from './HeroCraftingBody'
import { canManageForge, canResearchForgeUpgrade, researchForgeUpgrade } from '../../lib/equipment/forgeResearch'
import {
  FORGE_FAMILIES,
  FORGE_ICONS,
  FORGE_MATERIALS,
  getForgeTier,
  getForgeUpgradeCost,
  type ForgeFamily,
} from '../../lib/equipment/forgeUpgrades'

export class HeroForgeBody extends HeroCraftingBody {
  renderCraft(): void {
    this.craftPanel.textContent = ''
    const recipes = getAvailableHeroCraftRecipes(this.menu.context.player, 'forge')
    for (const [title, items] of [
      ['forgeCategoryEquipment', recipes.filter(recipe => !recipe.iconResource && !recipe.id.startsWith('arrow_'))],
      ['forgeCategoryArrows', recipes.filter(recipe => recipe.id.startsWith('arrow_'))],
    ] as const) {
      if (!items.length) continue
      this.appendSection(t(title), grid => items.forEach(recipe => grid.appendChild(this.createCraftButton(recipe))))
    }
    for (const [title, families] of [
      ['forgeCategoryTools', FORGE_FAMILIES.slice(0, 3)],
      ['forgeCategoryMilitary', FORGE_FAMILIES.slice(3)],
    ] as const) {
      this.appendSection(
        t(title),
        grid => families.forEach(family => grid.appendChild(this.createUpgradeButton(family)))
      )
    }
  }

  createUpgradeButton(family: ForgeFamily): HTMLElement {
    const { player, controls } = this.menu.context
    const tier = getForgeTier(player, family)
    const maximum = tier === 3
    const nextTier = Math.min(3, tier + 1)
    const cost = getForgeUpgradeCost(family, nextTier)
    const title = maximum
      ? t(`forgeFamily_${family}`)
      : t('forgeUpgradeTitle', {
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
        title:
          !disabled || maximum
            ? undefined
            : t(
                !this.canUse()
                  ? 'forgeRequiresAccess'
                  : !canManageForge(player, this.building, controls.heroUnit)
                    ? 'forgeUpgradeRequiresCommand'
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
