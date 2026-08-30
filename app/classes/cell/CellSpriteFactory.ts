import { Assets, Sprite, Texture } from 'pixi.js'
import { getTexture, textureRefToString } from '../../lib'
import { LABEL_TYPES } from '../../constants'
import type { TextureRef } from '../../lib'
import type { CellMapLike } from './CellTypes'

export type TerrainSpriteHost = {
  assets: TextureRef[]
  category?: string
  terrainHidden: boolean
  terrainTextureName: string
}

export function createCellTerrainSprite(
  host: TerrainSpriteHost,
  map: CellMapLike,
  preferredTexture?: TextureRef | string | null
): Sprite {
  const textureRef = preferredTexture || (host.assets.length ? map.randomItem(host.assets) : null)
  host.terrainTextureName = textureRef ? textureRefToString(textureRef) : ''
  const texture = textureRef ? getTexture(textureRef, Assets) : Texture.EMPTY
  const sprite = new Sprite(texture)
  sprite.zIndex = 0
  sprite.label = LABEL_TYPES.sprite
  sprite.anchor.set(Math.floor(texture.width / 2) / texture.width, Math.floor(texture.height / 2) / texture.height)
  sprite.roundPixels = true
  sprite.eventMode = 'none'
  sprite.renderable = !host.terrainHidden && host.category !== 'Water'
  return sprite
}
