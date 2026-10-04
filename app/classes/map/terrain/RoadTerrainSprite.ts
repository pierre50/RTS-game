import { Assets, Sprite } from 'pixi.js'
import { getTextureByFrame } from '../../../lib'
import { roadAtlasFrame } from '../../../lib/terrain/roadLayer'

/** The atlas retains seven pixels of padding around the source terrain mask. */
export function createRoadTerrainSprite(
  connections: number,
  terrainFrame: number,
  terrainTextureHeight: number
): Sprite {
  const sprite = new Sprite(getTextureByFrame('terrain/paths', roadAtlasFrame(terrainFrame, connections), Assets))
  sprite.anchor.set(39 / 80, (7 + Math.floor(terrainTextureHeight / 2)) / 64)
  sprite.zIndex = 11
  sprite.label = 'terrainRoad'
  sprite.roundPixels = true
  sprite.eventMode = 'none'
  return sprite
}
