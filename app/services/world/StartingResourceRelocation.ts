import { NaturalResourcePlacement } from '../../lib/resources/NaturalResourcePlacement'
import type { SaveEntityState, SaveGridPoint } from '../../types/save'
import type { OfflineTerrainCell, OfflineWorldSpatial } from './OfflineWorldSpatial'

export class StartingResourceRelocation {
  private readonly placement: NaturalResourcePlacement

  constructor(resources: SaveEntityState[], terrain: (OfflineTerrainCell | null | undefined)[][],
    private readonly spatial: OfflineWorldSpatial) {
    this.placement = new NaturalResourcePlacement(resources, terrain, spatial)
  }

  move(resource: SaveEntityState, center: SaveGridPoint, excluded: (point: SaveGridPoint) => boolean): boolean {
    const destination = this.placement.find(resource, center, excluded)
    if (!destination) return false
    const previous = { i: resource.i, j: resource.j }
    this.spatial.move(resource, destination)
    this.placement.record(resource, previous)
    return true
  }
}
