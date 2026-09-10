const { randomFrom } = require('../maps/noise.cjs')
const { buildingInterior } = require('../generate-interior-maps.cjs')

const VARIANTS = ['branches', 'loop', 'chamber']
const encode = bytes => Buffer.from(bytes).toString('base64')

function createCave(tier, variant, seed) {
  const id = `cave-${tier}-${variant}`
  if (tier === 'small') {
    return { ...buildingInterior({ buildingSize: 3, id, seed, size: 13 }), interiorType: 'Cave', tier, variant }
  }
  const width = tier === 'medium' ? 32 : 64
  const random = randomFrom(`${seed}:${id}`)
  const floor = new Uint8Array(width * width)
  const room = (x, y, radius) => ({ i: Math.round(x * (width - 1)), j: Math.round(y * (width - 1)), radius })
  const r = width / 10
  let rooms = [room(0.77, 0.77, r), room(0.53, 0.55, r), room(0.26, 0.3, r), room(0.26, 0.73, r), room(0.74, 0.27, r)]
  let edges = [
    [0, 1],
    [1, 2],
    [1, 3],
    [1, 4],
  ]
  if (variant === 'loop')
    edges = [
      [0, 3],
      [3, 2],
      [2, 4],
      [4, 0],
    ]
  if (variant === 'chamber') rooms[1].radius = width / 6
  if (tier === 'large') {
    rooms = [...rooms, room(0.15, 0.5, r * 0.65), room(0.5, 0.15, r * 0.7), room(0.53, 0.84, r * 0.7)]
    edges.push([2, 5], [4, 6], [3, 7])
    if (variant === 'loop') edges.push([5, 3], [6, 2], [7, 0])
  }
  // The loop's center is rock; all other rooms participate in the graph.
  const activeRooms = variant === 'loop' ? rooms.filter((_, index) => index !== 1) : rooms
  function dig(i, j, radius) {
    for (let x = Math.max(2, Math.floor(i - radius - 1)); x <= Math.min(width - 3, Math.ceil(i + radius + 1)); x++) {
      for (let y = Math.max(2, Math.floor(j - radius - 1)); y <= Math.min(width - 3, Math.ceil(j + radius + 1)); y++) {
        if ((x - i) ** 2 + (y - j) ** 2 <= radius ** 2) floor[x * width + y] = 1
      }
    }
  }
  for (const area of activeRooms) {
    dig(area.i, area.j, area.radius)
    for (let k = 0; k < 8; k++) {
      const angle = (k * Math.PI) / 4
      dig(
        area.i + Math.cos(angle) * area.radius * 0.55,
        area.j + Math.sin(angle) * area.radius * 0.55,
        area.radius * (0.48 + random() * 0.2)
      )
    }
  }
  for (const [a, b] of edges) {
    const from = rooms[a],
      to = rooms[b]
    const steps = Math.ceil(Math.hypot(to.i - from.i, to.j - from.j) * 3)
    const bend = (random() - 0.5) * width * 0.12
    for (let step = 0; step <= steps; step++) {
      const t = step / steps
      const wave = Math.sin(t * Math.PI) * bend
      dig(from.i + (to.i - from.i) * t + wave, from.j + (to.j - from.j) * t - wave, tier === 'medium' ? 2.2 : 2.8)
    }
  }
  const exit = { id: 'main', i: rooms[0].i + Math.floor(r), j: rooms[0].j + Math.floor(r), direction: 'south' }
  dig(exit.i, exit.j, 2.2)
  dig((exit.i + rooms[0].i) / 2, (exit.j + rooms[0].j) / 2, 2.2)
  const border = new Uint8Array(floor.length)
  // Rock outside the floor is solid. Keep the full corridor width walkable.
  const terrain = Uint8Array.from(floor, value => (value ? 5 : 2))
  const blueprint = {
    format: 'map-blueprint',
    version: 1,
    id,
    kind: 'interior',
    interiorType: 'Cave',
    buildingSize: 3,
    tier,
    variant,
    size: width - 1,
    preserveLegacyGrid: true,
    seed,
    encoding: 'base64',
    cellCount: floor.length,
    terrain: encode(terrain),
    relief: encode(new Uint8Array(floor.length)),
    floorMask: encode(floor),
    borderMask: encode(border),
    spawns: [{ i: exit.i, j: exit.j }],
    exits: [exit],
    resources: [],
    rooms: activeRooms,
  }
  validateCave(blueprint)
  return blueprint
}

function validateCave(blueprint) {
  const width = blueprint.size + 1
  const floor = Buffer.from(blueprint.floorMask, 'base64')
  const border = Buffer.from(blueprint.borderMask, 'base64')
  const walkable = index => floor[index] && !border[index]
  const exit = blueprint.exits[0]
  const start = exit.i * width + exit.j
  if (!walkable(start)) throw new Error(`${blueprint.id}: blocked entrance`)
  const visited = new Set([start]),
    queue = [start]
  for (let n = 0; n < queue.length; n++) {
    const index = queue[n],
      i = Math.floor(index / width),
      j = index % width
    for (const [di, dj] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      ...(blueprint.tier === 'small'
        ? [
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
          ]
        : []),
    ]) {
      const x = i + di,
        y = j + dj,
        next = x * width + y
      if (x < 0 || y < 0 || x >= width || y >= width || !walkable(next) || visited.has(next)) continue
      visited.add(next)
      queue.push(next)
    }
  }
  const count = floor.reduce((sum, _, index) => sum + Number(Boolean(walkable(index))), 0)
  if (visited.size !== count) throw new Error(`${blueprint.id}: disconnected floor`)
  return count
}
module.exports = { createCave, validateCave, VARIANTS }
