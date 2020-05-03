import { Graphics } from 'pixi.js'
import { MultiColorReplaceFilter } from '@pixi/filter-multi-color-replace'

export function getIconPath(name) {
  const id = name.split('_')[1]
  const index = name.split('_')[0]
  return `interface/${id}/${index}_${id}.png`
}

export function getTexture(name, assets) {
  const id = name.split('_')[1]
  const index = name.split('_')[0]
  const spritesheet = assets.cache.get(id)
  const textureName = `${index}_${id}.png`
  spritesheet.textures[textureName].hitArea = spritesheet.data.frames[textureName].hitArea
  return spritesheet.textures[textureName]
}

export function changeSpriteColor(sprite, color) {
  if (color === 'blue') {
    return
  }
  //8 Hex
  const source = [0x93bbd7, 0x739bc7, 0x577bb3, 0x3f5f9f, 0x273f8f, 0x17277b, 0x070f67, 0x000057]
  const colors = {
    red: [0xff8f8f, 0xff5f5f, 0xff2f2f, 0xe30b00, 0xc71700, 0x8f1f00, 0x6f0b07, 0x530b00],
    yellow: [0xe3e300, 0xdfcf0f, 0xdfcf0f, 0xc3a31b, 0xa37317, 0x876727, 0x6b4b27, 0x4f3723],
    brown: [0xcfa343, 0xb78b2b, 0xa3734f, 0x8b5b37, 0x734727, 0x5f331b, 0x3f3723, 0x23231f],
    orange: [0xfb9f1f, 0xf78b17, 0xf3770f, 0xef6307, 0xcf4300, 0x9f3300, 0x872b00, 0x6f2300],
    green: [0x8b9f4f, 0x7f8b37, 0x637b2f, 0x4b6b2b, 0x375f27, 0x1b431b, 0x133313, 0x0b1b0b],
    grey: [0xdbdbdb, 0xc7c7c7, 0xb3b3b3, 0x8f8f8f, 0x6b6b6b, 0x474747, 0x373737, 0x232323],
    cyan: [0x5fd39f, 0x2bbf93, 0x00ab93, 0x00837b, 0x006f6b, 0x004f4f, 0x003f43, 0x002327],
  }
  if (!colors[color]) {
    return
  }
  let final = []
  for (let i = 0; i < source.length; i++) {
    final.push([source[i], colors[color][i]])
  }
  sprite.filters = [new MultiColorReplaceFilter(final, 0.1)]
}

/**
 * Drawing selection blinking on instance
 * @param {object} instance
 */
export function drawInstanceBlinkingSelection(instance) {
  const selection = new Graphics()
  selection.name = 'selection'
  selection.zIndex = 3
  selection.lineStyle(1, 0x00ff00)
  const path = [-32 * instance.size, 0, 0, -16 * instance.size, 32 * instance.size, 0, 0, 16 * instance.size]
  selection.drawPolygon(path)
  instance.addChildAt(selection, 0)
  setTimeout(() => {
    selection.alpha = 0
    setTimeout(() => {
      selection.alpha = 1
      setTimeout(() => {
        selection.alpha = 0
        setTimeout(() => {
          selection.alpha = 1
          setTimeout(() => {
            instance.removeChild(selection)
          }, 300)
        }, 300)
      }, 300)
    }, 500)
  }, 500)
}
