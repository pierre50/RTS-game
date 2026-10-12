import { t } from '../lang'
import { getEquipmentDisplayName } from '../equipment/equipmentNames'
import type { HeroCraftRecipe } from './heroCrafting'

export function getHeroCraftRecipeLabel(recipe: Pick<HeroCraftRecipe, 'outputEquipment' | 'outputResource'>): string {
  return recipe.outputResource ? t(recipe.outputResource) : getEquipmentDisplayName(recipe.outputEquipment)
}
