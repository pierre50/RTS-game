import { FORGE_IRON_REQUIRED_LEVEL } from '../../config/forge'
import { getBuildingLevel } from '../../lib/buildings/buildingLevel'
import { attachVariantRow } from '../../lib/ui/VariantRow'
import { groupForgeRecipeVariants } from '../../lib/hero/heroForgeRecipes'
import type { HeroCraftRecipe } from '../../lib/hero/heroCrafting'
import { getAvailableHeroCraftRecipes } from '../../lib/hero/heroCrafting'
import { t } from '../../lib/lang'
import { appendInventoryScrollBody, createInventorySectionTitle } from '../inventory/InventorySection'
import { createForgeRepairInventory } from './HeroForgeInventory'
import { HeroCraftingBody } from './HeroCraftingBody'

const selectedMaterials = new WeakMap<HeroForgeBody, Map<string, number>>()

export class HeroForgeBody extends HeroCraftingBody {
  renderCraft(): void {
    this.craftPanel.textContent = ''
    this.craftPanel.className = 'forge-body forge-workspace'
    const catalog = document.createElement('div')
    catalog.className = 'forge-catalog'
    catalog.appendChild(createInventorySectionTitle(t('forgeCraftTitle')))
    if (getBuildingLevel(this.building) < FORGE_IRON_REQUIRED_LEVEL)
      catalog.appendChild(createInventorySectionTitle(t('forgeIronUpgradeRequired')))
    this.craftPanel.appendChild(catalog)
    const catalogueBody = appendInventoryScrollBody(catalog)
    const recipes = getAvailableHeroCraftRecipes(this.menu.context.player, 'forge', this.building)
    for (const [title, items] of [
      ['forgeCategoryIngots', recipes.filter(recipe => recipe.category === 'ingots')],
      ['forgeCategoryWeapons', recipes.filter(recipe => recipe.forgeGroup === 'weapons')],
      ['forgeCategoryArmor', recipes.filter(recipe => recipe.forgeGroup === 'armor')],
      ['forgeCategoryShields', recipes.filter(recipe => recipe.forgeGroup === 'shields')],
      ['forgeCategoryEquipment', recipes.filter(recipe => recipe.category === 'equipment' && !recipe.forgeGroup)],
      ['forgeCategoryArrows', recipes.filter(recipe => recipe.category === 'arrows')],
    ] as const) {
      if (!items.length) continue
      this.appendSection(
        t(title),
        grid => groupForgeRecipeVariants(items).forEach(variants => this.appendMaterialRow(grid, variants)),
        undefined,
        catalogueBody
      )
    }
    this.craftPanel.appendChild(
      createForgeRepairInventory({
        menu: this.menu,
        building: this.building,
        costParts: cost => this.getCraftCostMetaParts(cost, this.menu.context.controls.heroUnit),
        refresh: () => this.renderCraft(),
      })
    )
  }
  private appendMaterialRow(grid: HTMLElement, recipes: HeroCraftRecipe[]): void {
    if (recipes.length === 1) {
      grid.appendChild(this.createCraftButton(recipes[0]))
      return
    }
    let remembered = selectedMaterials.get(this)
    if (!remembered) selectedMaterials.set(this, (remembered = new Map()))
    const key = recipes[0].id
    let index = Math.min(remembered.get(key) ?? 0, recipes.length - 1)
    let row: HTMLElement | undefined
    const render = (): void => {
      const next = this.createCraftButton(recipes[index])
      if (row) {
        row.replaceChildren(...Array.from(next.childNodes))
        row.title = next.title
        row.setAttribute('aria-label', next.getAttribute('aria-label') ?? '')
        Object.assign(row.dataset, next.dataset)
      } else {
        row = next
        row.id = `craft-${key}`
        grid.appendChild(row)
      }
      attachVariantRow(row, {
        index,
        count: recipes.length,
        onChange: nextIndex => {
          index = nextIndex
          remembered.set(key, index)
          render()
        },
      })
    }
    render()
  }
}
