import { getAvailableHeroCraftRecipes } from '../../lib/hero/heroCrafting'
import { t } from '../../lib/lang'
import { HeroCraftingBody } from './HeroCraftingBody'

export class HeroCampfireBody extends HeroCraftingBody {
  renderCraft(): void {
    this.craftPanel.textContent = ''
    const recipes = getAvailableHeroCraftRecipes(this.menu.context.player, 'campfire')
    for (const [category, title] of [
      ['cooking', 'campfireCooking'],
      ['potions', 'campfirePotions'],
    ] as const) {
      this.appendSection(t(title), grid => {
        recipes
          .filter(recipe => recipe.category === category)
          .forEach(recipe => {
            grid.appendChild(this.createCraftButton(recipe))
          })
      })
    }
  }
}
