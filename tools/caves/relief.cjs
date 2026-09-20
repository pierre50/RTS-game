// Broad terraces keep every rise to one level and leave room for the existing
// terrain atlas ramps. The height field continues through rock at the boundary,
// so exposed floor edges use the same slopes as the rest of the chamber.
function addCaveRelief(blueprint) {
  const width = blueprint.size + 1
  const floor = Buffer.from(blueprint.floorMask, 'base64')
  const exit = blueprint.exits[0]
  const axis = Number(blueprint.seed) % 2 === 0 ? 'i' : 'j'
  const coordinates = []
  for (let index = 0; index < floor.length; index++) {
    if (floor[index]) coordinates.push(axis === 'i' ? Math.floor(index / width) : index % width)
  }
  const low = Math.min(...coordinates)
  const high = Math.max(...coordinates)
  const descending = exit[axis] >= (low + high) / 2
  const reach = descending ? exit[axis] - low : high - exit[axis]
  const levels = blueprint.tier === 'large' ? 3 : blueprint.tier === 'medium' ? 2 : 1
  const spacing = Math.max(4, Math.floor(reach / (levels * 2 + 1)))
  const relief = new Int8Array(floor.length)
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < width; j++) {
      const coordinate = axis === 'i' ? i : j
      const distance = descending ? exit[axis] - coordinate : coordinate - exit[axis]
      relief[i * width + j] = Math.max(
        0,
        Math.min(levels, Math.floor(distance / spacing), Math.floor((reach - distance + spacing) / spacing))
      )
    }
  }
  blueprint.relief = Buffer.from(relief.buffer).toString('base64')
  return blueprint
}
module.exports = { addCaveRelief }
