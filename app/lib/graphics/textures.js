import { Texture } from 'pixi.js'

export function getTexture(name, assets) {
  const [index, id] = name.split('_')
  const spritesheet = assets.cache.get(id)

  if (!spritesheet || !spritesheet.textures) {
    throw new Error(`Spritesheet for ID "${id}" not found in assets.`)
  }

  const textureName = `${index}_${id}.png`
  const texture = spritesheet.textures[textureName]

  if (!texture) {
    throw new Error(`Texture "${textureName}" not found in spritesheet.`)
  }

  texture.hitArea = spritesheet.data.frames[textureName].hitArea
  return texture
}

export { Texture }
