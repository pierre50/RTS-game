import {
  canRepairEquipment,
  getEquipmentRepairTargets,
  getEquipmentRepairCost,
  repairEquipment,
} from '../../lib/equipment/equipmentRepair'
import { createInventoryEquipmentRow } from '../inventory/InventoryItemRows'
import { getAvailableHeroCraftRecipes } from '../../lib/hero/heroCrafting'
import { t } from '../../lib/lang'
import { HeroCraftingBody } from './HeroCraftingBody'
export class HeroForgeBody extends HeroCraftingBody {
  renderCraft(): void {
    this.craftPanel.textContent = ''
    this.renderRepairs()
    const recipes = getAvailableHeroCraftRecipes(this.menu.context.player, 'forge')
    for (const [title, items] of [
      ['forgeCategoryIngots', recipes.filter(recipe => recipe.category === 'ingots')],
      ['forgeCategoryWeapons', recipes.filter(recipe => recipe.forgeGroup === 'weapons')],
      ['forgeCategoryArmor', recipes.filter(recipe => recipe.forgeGroup === 'armor')],
      ['forgeCategoryShields', recipes.filter(recipe => recipe.forgeGroup === 'shields')],
      ['forgeCategoryEquipment', recipes.filter(recipe => recipe.category === 'equipment' && !recipe.forgeGroup)],
      ['forgeCategoryArrows', recipes.filter(recipe => recipe.category === 'arrows')],
    ] as const) {
      if (!items.length) continue
      this.appendSection(t(title), grid => items.forEach(recipe => grid.appendChild(this.createCraftButton(recipe))))
    }
  }

  private renderRepairs(): void {
    const { player, controls } = this.menu.context
    const hero = controls.heroUnit
    if (!hero) return
    const targets = getEquipmentRepairTargets(hero)
    this.appendSection(
      t('forgeRepairTitle'),
      grid => {
        if (!targets.length) {
          const empty = document.createElement('p')
          empty.textContent = t('forgeRepairNothing')
          grid.appendChild(empty)
        }
        for (const target of targets) {
          const cost = getEquipmentRepairCost(target.item)
          const disabled = !canRepairEquipment(player, hero, this.building, target)
          const { element } = createInventoryEquipmentRow(this.menu.context, this.menu, {
            id: `repair-${target.location}-${target.key}`,
            equipment: target.item,
            count: 1,
            metaParts: this.getCraftCostMetaParts(cost, hero),
            trailingAction: {
              label: t('forgeRepairAction'),
              disabled,
              onClick: () => {
                if (repairEquipment(player, hero, this.building, target)) {
                  this.menu.updateTopbar?.()
                  this.menu.showMessage(t('forgeRepairSuccess'), 'success')
                }
                this.renderCraft()
              },
            },
          })
          grid.appendChild(element)
        }
      },
      t('forgeRepairDescription')
    )
  }
}
