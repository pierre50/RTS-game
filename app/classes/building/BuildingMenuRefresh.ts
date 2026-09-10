import type { BuildingControllerHost } from './BuildingTypes'

export function refreshOpenBuildingMenu(building: BuildingControllerHost): void {
  const menu = building.context.menu
  if (menu.getHeroBuildingMenuTarget?.() === building) menu.refreshHeroBuildingMenu?.()
}
