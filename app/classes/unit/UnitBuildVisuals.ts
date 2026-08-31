import type { BuildingEntity } from '../../types/entities'

export function shouldSyncBuildHealthDisplay(building: BuildingEntity): boolean {
  return Boolean(building.selected || building.shouldKeepHealthBarVisible?.())
}
