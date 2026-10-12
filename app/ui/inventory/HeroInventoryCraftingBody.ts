import { getAvailableHeroCraftRecipes } from '../../lib/hero/heroCrafting'
import { t } from '../../lib/lang'
import { HeroCraftingBody } from '../hero-building/HeroCraftingBody'

export class HeroInventoryCraftingBody extends HeroCraftingBody<undefined> {
  renderCraft(): void {
    this.craftPanel.replaceChildren()
    const recipes = getAvailableHeroCraftRecipes(this.menu.context.player, 'inventory')
    for (const [category, title] of [
      ['equipment', 'inventoryCraftEquipment'],
      ['arrows', 'forgeCategoryArrows'],
      ['potions', 'inventoryCraftRemedies'],
    ] as const) {
      const items = recipes.filter(recipe => recipe.category === category)
      if (!items.length) continue
      this.appendSection(t(title), grid => {
        for (const recipe of items) grid.appendChild(this.createCraftButton(recipe))
      })
    }
  }
}
