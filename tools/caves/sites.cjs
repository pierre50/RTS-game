const MAP_PADDING = 18
const CLEARING_RADIUS = 6
const FOOTPRINT_RADIUS = 2
// Camps hug the front of the entrance (cave + 1, + 2).
const CAMP_OFFSETS = [
  [4, 4],
  [-2, 5],
  [5, 0],
  [1, 6],
]

function isClearing(cell, center) {
  return Math.abs(cell.i - center.i) <= CLEARING_RADIUS && Math.abs(cell.j - center.j) <= CLEARING_RADIUS
}

function connectingCells(cave, camp) {
  const cells = new Map()
  const start = { i: cave.i + 1, j: cave.j + 2 }
  const steps = Math.max(Math.abs(start.i - camp.i), Math.abs(start.j - camp.j)) * 2
  for (let step = 0; step <= steps; step++) {
    const t = steps ? step / steps : 0
    const i = Math.round(start.i + (camp.i - start.i) * t)
    const j = Math.round(start.j + (camp.j - start.j) * t)
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        cells.set(`${i + di}:${j + dj}`, { i: i + di, j: j + dj })
      }
  }
  return [...cells.values()]
}

function findCaveSite(blueprint, appearance, random) {
  const width = blueprint.size + 1
  const blocked = new Set(appearance.filter(cell => cell.water || cell.relief).map(cell => cell.i * width + cell.j))
  const free = (i, j, z) => {
    const type = blueprint.terrain[i]?.[j]
    return type && type !== 'Water' && blueprint.relief[i]?.[j] === z && !blocked.has(i * width + j)
  }
  const positions = []
  const lookup = new Map()
  for (let i = MAP_PADDING; i <= blueprint.size - MAP_PADDING; i++)
    for (let j = MAP_PADDING; j <= blueprint.size - MAP_PADDING; j++) {
      // Sparse local maps have slanted boundaries: checking only size would miss them.
      if (blueprint.localGridLayout) {
        const { columns, rows } = blueprint.localGridLayout
        const row = i + j - columns + 1
        const column = i - Math.ceil(row / 2) + (row % 2) / 2
        if (Math.min(column * 2, (columns - 1 - column) * 2, row / 2, (rows - 1 - row) / 2) < MAP_PADDING) continue
      }
      if ((blueprint.spawns ?? []).some(pos => pos && Math.hypot(i - pos.i, j - pos.j) < 28)) continue
      const z = blueprint.relief[i]?.[j]
      let valid = true
      for (let di = -FOOTPRINT_RADIUS; di <= FOOTPRINT_RADIUS && valid; di++)
        for (let dj = -FOOTPRINT_RADIUS; dj <= FOOTPRINT_RADIUS; dj++) {
          if (!free(i + di, j + dj, z)) {
            valid = false
            break
          }
        }
      if (!valid) continue
      const position = { i, j }
      positions.push(position)
      lookup.set(`${i}:${j}`, position)
    }
  const campCount = blueprint.banditCampPositions?.length ?? 0
  let selected,
    count = 0
  for (const cave of positions) {
    const camps = []
    for (const [di, dj] of CAMP_OFFSETS) {
      if (camps.length === campCount) break
      const camp = lookup.get(`${cave.i + di}:${cave.j + dj}`)
      if (!camp || camps.some(other => Math.max(Math.abs(other.i - camp.i), Math.abs(other.j - camp.j)) < 4)) continue
      const path = connectingCells(cave, camp)
      if (!path.every(cell => free(cell.i, cell.j, blueprint.relief[cave.i][cave.j]))) continue
      camps.push(camp)
    }
    if (camps.length !== campCount) continue
    if (random() < 1 / ++count) selected = { cave, camps }
  }
  if (!selected && campCount)
    throw Object.assign(
      new Error(`Cannot place ${campCount} bandit camp(s) beside a padded cave in ${blueprint.id ?? blueprint.seed}`),
      { code: 'CAVE_PLACEMENT_FAILED' }
    )
  return selected
}
module.exports = { findCaveSite, isClearing, connectingCells, MAP_PADDING, CLEARING_RADIUS }
