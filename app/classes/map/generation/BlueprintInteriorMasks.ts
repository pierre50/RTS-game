import type { MapBlueprint } from '../MapGenerationTypes'
import type { MapBlueprintGeneration } from './MapBlueprintGeneration'
type Host = Pick<MapBlueprintGeneration, 'map'>
export function applyInteriorMasks(this: Host, blueprint: MapBlueprint): void {
  if (!isInteriorBlueprint(blueprint) || !blueprint.floorMask) return

  for (let i = 0; i <= this.map.size; i++) {
    for (let j = 0; j <= this.map.size; j++) {
      const cell = this.map.grid[i]?.[j]
      if (!cell) continue
      const isFloor = maskValue(blueprint.floorMask, i, j)
      const isBorder = maskValue(blueprint.borderMask, i, j)
      const isExit = isBlueprintExitCell(blueprint, i, j)
      cell.terrainHidden = !isFloor
      cell.border = isBorder && !isExit
      cell.waterBorder = false
      if (!cell.has) cell.solid = !isFloor
      const sprite = 'sprite' in cell ? (cell.sprite as { renderable?: boolean } | null | undefined) : null
      if (sprite) sprite.renderable = isFloor && cell.category !== 'Water'
    }
  }
}

export function isInteriorBlueprint(blueprint: MapBlueprint): boolean {
  return blueprint.kind === 'interior' || blueprint.mapType === 'interior'
}

function maskValue(mask: MapBlueprint['floorMask'], i: number, j: number): boolean {
  return mask?.[i]?.[j] === 1
}

function isBlueprintExitCell(blueprint: MapBlueprint, i: number, j: number): boolean {
  return Boolean(blueprint.exits?.some(exit => exit?.i === i && exit?.j === j))
}
