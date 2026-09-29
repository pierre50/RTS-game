import { DAILY_CONSUMPTION_PER_VILLAGER } from '../../constants/consumption'
import type { CollectiveMember, CollectiveSite } from './collectiveTasks'
import { materialAmount, takeMaterial } from './constructionMaterials'

/** Meals consume only personal provisions, fetched ahead of time from a granary. */
export function consumeVillageFood(
  owner: {
    label?: string
    buildings?: CollectiveSite[]
    units?: CollectiveMember[]
  },
  daily = DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0
): { needed: number; consumed: number } {
  const members = (owner.units ?? []).filter(unit => unit.type === 'Villager' && !unit.isDead && !unit.isDestroyed)
  let consumed = 0
  for (const unit of members) {
    const sources = unit.inventory?.resources ? [unit.inventory.resources] : []
    let remaining = daily
    for (const source of sources) {
      const taken = takeMaterial(source, 'food', Math.min(remaining, materialAmount(source, 'food')))
      remaining -= taken
      consumed += taken
      if (!remaining) break
    }
  }
  return { needed: members.length * daily, consumed }
}
