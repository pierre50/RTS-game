const fs = require('node:fs')
const path = require('node:path')

// Grid directions follow the four edges of a flat isometric tile.
const SIDES = [
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, 0],
]
function createInteriorWalls(floor, width, exits = []) {
  const walls = []
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < width; j++) {
      if (!floor[i * width + j] || exits.some(exit => exit.i === i && exit.j === j)) continue
      const exposed = SIDES.flatMap(([di, dj], side) => {
        const x = i + di,
          y = j + dj
        return x < 0 || y < 0 || x >= width || y >= width || !floor[x * width + y] ? [side] : []
      })
      for (const side of exposed) walls.push({ i, j, side })
    }
  }
  return walls
}

function writeInteriorWallAtlas() {
  const directory = path.resolve(__dirname, '../../public/assets/terrain/interior-walls')
  fs.mkdirSync(directory, { recursive: true })
  const frames = {}
  const bounds = [
    [1, 17, 33, 117],
    [44, 33, 65, 101],
    [119, 1, 33, 133],
    [162, 18, 31, 116],
    [203, 33, 33, 101],
  ]
  bounds.forEach(([x, y, w, h], index) => {
    frames[`${String(index).padStart(3, '0')}_interior_wall.png`] = {
      frame: { x, y, w, h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w, h },
      sourceSize: { w, h },
    }
  })
  fs.writeFileSync(
    path.join(directory, 'texture.json'),
    JSON.stringify(
      {
        frames,
        meta: { image: 'texture.png', format: 'RGBA8888', size: { w: 237, h: 135 }, scale: '1' },
      },
      null,
      2
    ) + '\n'
  )
  for (const variant of ['wood', 'dirt']) {
    const variantFrames = Object.fromEntries(
      Object.entries(frames).map(([name, frame]) => [name.replace('.png', `_${variant}.png`), frame])
    )
    // Low panels use exact pixel dimensions, including the north-east slope.
    const lowBounds = [
      [1, 33, 41],
      [44, 65, 25],
      [119, 33, 57],
      [162, 33, 41],
      [203, 33, 25],
    ]
    lowBounds.forEach(([x, w, h], index) => {
      variantFrames[`${String(index + 5).padStart(3, '0')}_interior_wall_${variant}.png`] = {
        frame: { x, y: 136, w, h },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w, h },
        sourceSize: { w, h },
      }
    })
    const target = path.join(directory, variant)
    fs.mkdirSync(target, { recursive: true })
    fs.writeFileSync(
      path.join(target, 'texture.json'),
      JSON.stringify(
        {
          frames: variantFrames,
          meta: { image: 'texture.png', format: 'RGBA8888', size: { w: 237, h: 194 }, scale: '1' },
        },
        null,
        2
      ) + '\n'
    )
  }
}
module.exports = { createInteriorWalls, writeInteriorWallAtlas }
