import definitions from '../../public/assets/data/gameplay/buildings.json'
import { TWO_LEVEL_BUILDINGS, TWO_LEVEL_BUILDING_MAX } from '../config/buildingLevels'
import type { SaveEntityState } from '../types/save'
import type { ResourceAmount } from '../types/common'

/** Collapse obsolete levels without losing stored goods, trainees or structural damage. */
export function migrateTwoLevelBuilding(building: SaveEntityState): void {
  if (!TWO_LEVEL_BUILDINGS.some(type => type === building.type)) return
  const level = building.buildingLevel
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 0) return
  building.buildingLevel = Math.min(level, TWO_LEVEL_BUILDING_MAX)
  if (typeof building.assetLevel === 'number') building.assetLevel = building.buildingLevel
  if (building.buildingLevel === TWO_LEVEL_BUILDING_MAX) {
    const type = building.type as (typeof TWO_LEVEL_BUILDINGS)[number]
    const maximum = definitions[type].levelStats[1].totalHitPoints
    const oldMaximum = building.totalHitPoints ?? maximum
    if (building.hitPoints != null && building.hitPoints > 0)
      building.hitPoints = Math.min(maximum, Math.max(1, building.hitPoints + maximum - oldMaximum))
    building.totalHitPoints = maximum
  }
  const upgrade = building.buildingUpgrade
  if (!upgrade || upgrade.targetLevel <= TWO_LEVEL_BUILDING_MAX) return
  if (building.buildingLevel < TWO_LEVEL_BUILDING_MAX) {
    upgrade.targetLevel = TWO_LEVEL_BUILDING_MAX
    return
  }
  // The merged final tier is already reached. Return unconsumed delivered materials.
  for (const [key, amount] of Object.entries(building.constructionMaterials?.delivered ?? {})) {
    if (!Number.isFinite(amount) || amount <= 0) continue
    building.inventory ??= {}
    building.inventory.resources ??= {}
    const resource = key as keyof ResourceAmount
    building.inventory.resources[resource] = (building.inventory.resources[resource] ?? 0) + amount
  }
  delete building.buildingUpgrade
  delete building.constructionMaterials
}
