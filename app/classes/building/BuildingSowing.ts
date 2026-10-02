import { Resource } from '../Resource'
import { addEntityToMapSpaceContainer, getEntityMapSpace } from '../../lib/mapSpaces'
import { sownWheatOptions } from '../../lib/resources/wheatSowing'
import type { BuildingControllerHost } from './BuildingTypes'

/** Replace just this completed sowing tile, leaving the remaining parcel pending. */
export function finishSowingTile(building: BuildingControllerHost): void {
  const { context, owner } = building
  const { map, menu } = context
  const space = getEntityMapSpace(building, map)
  const cell = (space?.grid ?? map.grid)[building.i]?.[building.j]
  if (!cell || building.isDead || building.isDestroyed) return
  building.isBuilt = true
  building.isDead = true
  if (building.selected) owner.unselectAll()
  map.removeFromInstanceBucket(building)
  const index = owner.buildings.indexOf(building)
  if (index >= 0) owner.buildings.splice(index, 1)
  if (cell.has === building) {
    cell.has = null
    cell.solid = false
  }
  building.shadow?.destroy({ children: true, texture: false })
  building.shadow = null
  building.clear()
  const wheat = new Resource(sownWheatOptions(building), context)
  addEntityToMapSpaceContainer(map, wheat)
  map.resources.add(wheat)
  owner.foundedWheats?.add(wheat)
  owner.foundedResources?.Wheat?.add(wheat)
  cell.updateVisible()
  if (menu.isMiniMapActive?.() !== false) menu.updateResourcesMiniMap?.()
}
