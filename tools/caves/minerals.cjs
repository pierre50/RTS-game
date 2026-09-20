const { randomFrom } = require('../maps/noise.cjs')

function addCaveMinerals(blueprint) {
  const width = blueprint.size + 1
  const floor = Buffer.from(blueprint.floorMask, 'base64')
  const border = Buffer.from(blueprint.borderMask, 'base64')
  const relief = Buffer.from(blueprint.relief, 'base64')
  const random = randomFrom(`${blueprint.seed}:${blueprint.id}:minerals`)
  const candidates = []
  for (let i = 1; i < width - 1; i++) {
    for (let j = 1; j < width - 1; j++) {
      if (blueprint.exits.some(exit => Math.hypot(exit.i - i, exit.j - j) < 4)) continue
      // A full, flat 3x3 patch leaves room to approach and walk around the node.
      let usable = true
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++) {
          const index = (i + di) * width + j + dj
          if (!floor[index] || border[index] || relief[index] !== relief[i * width + j]) usable = false
        }
      if (usable) candidates.push({ i, j, order: random() })
    }
  }
  candidates.sort((a, b) => a.order - b.order)
  const count = { small: 2, medium: 4, large: 6 }[blueprint.tier]
  const resources = []
  const types = ['Gold', 'Copper', 'Iron']
  for (const cell of candidates) {
    if (resources.some(node => Math.hypot(node.i - cell.i, node.j - cell.j) < 4)) continue
    const type = types[resources.length % types.length]
    const quantity = (type === 'Copper' ? 6 : 3) + Math.floor(random() * 4)
    resources.push({ i: cell.i, j: cell.j, type, quantity })
    if (resources.length >= count) break
  }
  blueprint.resources = resources
  return blueprint
}
module.exports = { addCaveMinerals }
