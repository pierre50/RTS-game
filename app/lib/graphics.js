import { Graphics  } from 'pixi.js'
import { Texture } from 'pixi.js'
import { COLOR_FLASHY_GREEN } from '../constants'
import { MultiColorReplaceFilter } from 'pixi-filters'

export function getIconPath(name) {
  const id = name.split('_')[1]
  const index = name.split('_')[0]
  return `interface/${id}/${index}_${id}.png`
}

export function getBuildingTextureNameWithSize(size) {
  switch (size) {
    case 1:
      return '000_256'
    case 2:
      return '000_258'
    case 3:
      return '000_261'
  }
}

export function getBuildingRubbleTextureNameWithSize(size) {
  switch (size) {
    case 1:
      return '000_153'
    case 2:
      return '000_154'
    case 3:
      return '000_155'
  }
}

export function getBuildingAsset(type, owner, assets) {
  const path = assets.cache.get(owner.civ.toLowerCase()).buildings
  if (path[owner.age][type]) {
    return path[owner.age][type]
  } else if (path[owner.age - 1][type]) {
    return path[owner.age - 1][type]
  } else if (path[owner.age - 2][type]) {
    return path[owner.age - 2][type]
  } else if (path[0][type]) {
    return path[0][type]
  }
}

/**
 * Retrieve a texture from the assets cache based on its name.
 *
 * @param {string} name - The name of the texture, formatted as 'index_id'.
 * @param {object} assets - The assets object containing the cache of textures.
 * @returns {object} - The requested texture from the spritesheet.
 * @throws {Error} - If the texture cannot be found in the spritesheet.
 */
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

  // Set the hit area for the texture
  texture.hitArea = spritesheet.data.frames[textureName].hitArea

  return texture
}

export const colors = ['blue', 'red', 'yellow', 'brown', 'orange', 'green', 'grey', 'cyan']

/**
 * Get the hex color code for a given color name.
 * @param {string} name - The name of the color.
 * @returns {string} The hex color code, or '#ffffff' if the color is not found.
 */
export function getHexColor(name) {
  const colorMap = {
    blue: '#3f5f9f',
    red: '#e30b00',
    yellow: '#c3a31b',
    brown: '#8b5b37',
    orange: '#ef6307',
    green: '#4b6b2b',
    grey: '#8f8f8f',
    cyan: '#00837b',
  }
  return colorMap[name] || '#ffffff' // Default to white if not found
}

/**
 * Change the color of a sprite directly by manipulating its texture.
 * @param {object} sprite - The sprite to change the color of.
 * @param {string} color - The new color to apply to the sprite.
 */
export function changeSpriteColorDirectly(sprite, color) {
  if (color === 'blue') {
    return // Skip processing if color is blue
  }

  const sourceColors = [0x93bbd7, 0x739bc7, 0x577bb3, 0x3f5f9f, 0x273f8f, 0x17277b, 0x070f67, 0x000057]

  const colors = {
    red: [0xff8f8f, 0xff5f5f, 0xff2f2f, 0xe30b00, 0xc71700, 0x8f1f00, 0x6f0b07, 0x530b00],
    yellow: [0xe3e300, 0xdfcf0f, 0xdfcf0f, 0xc3a31b, 0xa37317, 0x876727, 0x6b4b27, 0x4f3723],
    brown: [0xcfa343, 0xb78b2b, 0xa3734f, 0x8b5b37, 0x734727, 0x5f331b, 0x3f3723, 0x23231f],
    orange: [0xfb9f1f, 0xf78b17, 0xf3770f, 0xef6307, 0xcf4300, 0x9f3300, 0x872b00, 0x6f2300],
    green: [0x8b9f4f, 0x7f8b37, 0x637b2f, 0x4b6b2b, 0x375f27, 0x1b431b, 0x133313, 0x0b1b0b],
    grey: [0xdbdbdb, 0xc7c7c7, 0xb3b3b3, 0x8f8f8f, 0x6b6b6b, 0x474747, 0x373737, 0x232323],
    cyan: [0x5fd39f, 0x2bbf93, 0x00ab93, 0x00837b, 0x006f6b, 0x004f4f, 0x003f43, 0x002327],
  }

  const targetColors = colors[color]

  if (!targetColors) {
    throw new Error('Invalid color selected.') // Throw error for invalid color
  }

  const baseTexture = sprite.texture.baseTexture.resource

  const canvas = document.createElement('canvas')
  canvas.width = sprite.texture.width
  canvas.height = sprite.texture.height

  const ctx = canvas.getContext('2d')
  ctx.drawImage(
    baseTexture,
    sprite.texture.frame.x,
    sprite.texture.frame.y,
    sprite.texture.frame.width,
    sprite.texture.frame.height,
    0,
    0,
    sprite.texture.frame.width,
    sprite.texture.frame.height
  )

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  const sourceColorMap = new Map(sourceColors.map((color, index) => [color, targetColors[index]]))

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const rgb = (r << 16) | (g << 8) | b

    if (sourceColorMap.has(rgb)) {
      const targetColor = sourceColorMap.get(rgb)
      data[i] = (targetColor >> 16) & 0xff // Red
      data[i + 1] = (targetColor >> 8) & 0xff // Green
      data[i + 2] = targetColor & 0xff // Blue
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const newTexture = Texture.from(canvas)
  sprite.texture = newTexture
}

/**
 * Change the color of a sprite based on the specified color.
 *
 * @param {object} sprite - The sprite object whose color will be changed.
 * @param {string} color - The target color. Supported colors: 'red', 'yellow', 'brown', 'orange', 'green', 'grey', 'cyan'.
 * @returns {void}
 */
export function changeSpriteColor(sprite, color) {
  // Skip color change if the specified color is blue
  if (color === 'blue') {
    return
  }

  // Source colors (Hex)
  const source = [0x93bbd7, 0x739bc7, 0x577bb3, 0x3f5f9f, 0x273f8f, 0x17277b, 0x070f67, 0x000057]

  // Define color mappings
  const colors = {
    red: [0xff8f8f, 0xff5f5f, 0xff2f2f, 0xe30b00, 0xc71700, 0x8f1f00, 0x6f0b07, 0x530b00],
    yellow: [0xe3e300, 0xdfcf0f, 0xdfcf0f, 0xc3a31b, 0xa37317, 0x876727, 0x6b4b27, 0x4f3723],
    brown: [0xcfa343, 0xb78b2b, 0xa3734f, 0x8b5b37, 0x734727, 0x5f331b, 0x3f3723, 0x23231f],
    orange: [0xfb9f1f, 0xf78b17, 0xf3770f, 0xef6307, 0xcf4300, 0x9f3300, 0x872b00, 0x6f2300],
    green: [0x8b9f4f, 0x7f8b37, 0x637b2f, 0x4b6b2b, 0x375f27, 0x1b431b, 0x133313, 0x0b1b0b],
    grey: [0xdbdbdb, 0xc7c7c7, 0xb3b3b3, 0x8f8f8f, 0x6b6b6b, 0x474747, 0x373737, 0x232323],
    cyan: [0x5fd39f, 0x2bbf93, 0x00ab93, 0x00837b, 0x006f6b, 0x004f4f, 0x003f43, 0x002327],
  }

  // Check if the color is supported
  if (!colors[color]) {
    return
  }

  // Create final color mapping
  const replacements = []
  for (let i = 0; i < source.length; i++) {
    replacements.push([source[i], colors[color][i]])
  }

  const filter = new MultiColorReplaceFilter({replacements,tolerance:  0.1 })
  
  sprite.filters = [filter]
}

/**
 * Draws a blinking selection around the given instance.
 * @param {object} instance - The instance to draw the selection around.
 */
export function drawInstanceBlinkingSelection(instance) {
  const selection = new Graphics()
  selection.name = 'selection'
  selection.zIndex = 3

  // Define the path for the selection
  const path = [-32 * instance.size, 0, 0, -16 * instance.size, 32 * instance.size, 0, 0, 16 * instance.size]
  selection.poly(path);
  selection.stroke(COLOR_FLASHY_GREEN);
  instance.addChildAt(selection, 0)

  // Helper function for blinking effect
  const blink = (alpha, duration) => {
    return new Promise(resolve => {
      selection.alpha = alpha
      setTimeout(resolve, duration)
    })
  }

  const blinkSequence = async () => {
    await blink(1, 500) // Show
    await blink(0, 300) // Hide
    await blink(1, 300) // Show
    await blink(0, 300) // Hide
    await blink(1, 300) // Show
    instance.removeChild(selection) // Clean up
  }

  blinkSequence()
}
/**
 * Draw a filled rectangle on the canvas.
 * @param {CanvasRenderingContext2D} context
 * @param {number} x - The x-coordinate of the rectangle's top-left corner.
 * @param {number} y - The y-coordinate of the rectangle's top-left corner.
 * @param {number} width - The width of the rectangle.
 * @param {number} height - The height of the rectangle.
 * @param {string} color - The fill color for the rectangle.
 */
export function canvasDrawRectangle(context, x, y, width, height, color) {
  context.fillStyle = color
  context.fillRect(x, y, width, height)
}

/**
 * Draw a stroked rectangle on the canvas.
 * @param {CanvasRenderingContext2D} context
 * @param {number} x - The x-coordinate of the rectangle's top-left corner.
 * @param {number} y - The y-coordinate of the rectangle's top-left corner.
 * @param {number} width - The width of the rectangle.
 * @param {number} height - The height of the rectangle.
 * @param {string} color - The stroke color for the rectangle.
 */
export function canvasDrawStrokeRectangle(context, x, y, width, height, color) {
  context.strokeStyle = color
  context.strokeRect(x, y, width, height)
}

/**
 * Draw a diamond shape on the canvas.
 * @param {CanvasRenderingContext2D} context
 * @param {number} x - The x-coordinate of the diamond's center.
 * @param {number} y - The y-coordinate of the diamond's center.
 * @param {number} width - The width of the diamond.
 * @param {number} height - The height of the diamond.
 * @param {string} color - The fill color for the diamond.
 */
export function canvasDrawDiamond(context, x, y, width, height, color) {
  context.save()
  context.beginPath()
  context.moveTo(x, y)
  context.lineTo(x - width / 2, y + height / 2)
  context.lineTo(x, y + height)
  context.lineTo(x + width / 2, y + height / 2)
  context.closePath()

  context.fillStyle = color
  context.fill()
  context.restore() // Restore the context state
}

/**
 * Execute a callback when a sprite reaches a specific frame.
 * @param {object} sprite - The sprite to monitor.
 * @param {number} frame - The target frame to trigger the callback.
 * @param {function} cb - The callback to execute.
 */
export function onSpriteLoopAtFrame(sprite, frame, cb) {
  sprite.onFrameChange = currentFrame => {
    if (currentFrame === frame) {
      cb()
    }
  }
}
