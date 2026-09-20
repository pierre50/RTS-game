import { Assets, Sprite, type ContainerChild } from 'pixi.js'
import type { MapBlueprint } from '../../classes/map/MapGenerationTypes'
import { getInteriorWallGeometry } from '../terrain/interiorWallGeometry'
import { createInteriorWallOcclusionCheck } from '../terrain/interiorWallOcclusion'
import { getTextureByFrame } from './textures'

const LOW_WALL_HEIGHT = 24

export function addInteriorWalls(blueprint: MapBlueprint, layer: { addChild(child: ContainerChild): unknown }): void {
  const sheet = `terrain/interior-walls/${blueprint.interiorType === 'Cave' ? 'dirt' : 'wood'}`
  const occludesFloor = createInteriorWallOcclusionCheck(blueprint)
  for (const wall of blueprint.walls ?? []) {
    if (blueprint.floorMask?.[wall.i]?.[wall.j] !== 1) continue
    if (blueprint.exits?.some(exit => exit?.i === wall.i && exit.j === wall.j)) continue
    const geometry = getInteriorWallGeometry(blueprint, wall)
    if (!geometry) continue
    const low = wall.side >= 2 || occludesFloor(geometry)
    const removedHeight = low ? 100 - LOW_WALL_HEIGHT : 0
    const sprite = new Sprite(getTextureByFrame(sheet, geometry.frame + (low ? 5 : 0), Assets))
    sprite.label = 'interior-wall'
    sprite.eventMode = 'none'
    sprite.roundPixels = true
    sprite.tint = geometry.tint
    sprite.alpha = 1
    sprite.width = geometry.width
    sprite.height = geometry.height - removedHeight
    sprite.x = geometry.x
    sprite.y = geometry.y + removedHeight
    sprite.zIndex = geometry.zIndex
    if (geometry.flip) {
      sprite.scale.x *= -1
      sprite.x += geometry.width - 1
    }
    layer.addChild(sprite)
  }
}
