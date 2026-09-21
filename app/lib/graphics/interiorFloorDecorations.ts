import { Assets, Sprite, type ContainerChild } from 'pixi.js'
import { getInteriorFloorDecorations } from '../buildings/interiorFloorDecorations'
import { getInteriorRoomCenter } from '../buildings/interiorFurniturePlacement'
import { CELL_HEIGHT, CELL_WIDTH } from '../../constants'
import { getTextureByFrame } from './textures'
import type { RuntimeCell } from '../../types/map'

export function addInteriorFloorDecorations(
  space: {
    building: { type: string; placementMirrored?: boolean }
    grid: RuntimeCell[][]
    walkableCells: RuntimeCell[]
    sleepCells: RuntimeCell[]
    size: number
  },
  layer: { addChild(child: ContainerChild): unknown }
): void {
  const decorations = getInteriorFloorDecorations(space.building.type)
  if (!decorations.length) return
  const center = getInteriorRoomCenter(space)
  for (const decoration of decorations) {
    const offsetX = decoration.offsetX * (space.building.placementMirrored ? -1 : 1)
    const i = center.i + (offsetX / (CELL_WIDTH / 2) + decoration.offsetY / (CELL_HEIGHT / 2)) / 2
    const j = center.j + (decoration.offsetY / (CELL_HEIGHT / 2) - offsetX / (CELL_WIDTH / 2)) / 2
    const cell = space.grid[Math.round(i)]?.[Math.round(j)]
    if (!cell || cell.terrainHidden || (cell.border && !decoration.allowBorderPlacement) || cell.category === 'Water')
      continue
    const texture = getTextureByFrame('buildings/deco', decoration.frame, Assets)
    const sprite = new Sprite(texture)
    sprite.scale.x = space.building.placementMirrored ? -1 : 1
    if (texture.defaultAnchor) sprite.anchor.set(texture.defaultAnchor.x, texture.defaultAnchor.y)
    sprite.x = ((center.i - center.j) * CELL_WIDTH) / 2 + offsetX
    sprite.y = ((center.i + center.j) * CELL_HEIGHT) / 2 + decoration.offsetY
    sprite.label = 'interior-floor-decoration'
    sprite.eventMode = 'none'
    sprite.roundPixels = true
    // This layer is below entities; rugs must remain above every terrain cell.
    sprite.zIndex = space.size * 2 + 1
    layer.addChild(sprite)
  }
}
