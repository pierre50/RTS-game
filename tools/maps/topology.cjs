const EIGHT_NEIGHBOR_NAMES = Object.freeze(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'])

const EIGHT_NEIGHBOR_OFFSETS = Object.freeze([
  [-1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
])

function getNeighborRing(grid, i, j, predicate) {
  return EIGHT_NEIGHBOR_OFFSETS.map(([di, dj]) => predicate(grid[i + di]?.[j + dj], di, dj))
}

function getNeighborFlagsFromRing(ring) {
  return Object.fromEntries(EIGHT_NEIGHBOR_NAMES.map((name, index) => [name, ring[index]]))
}

function getNeighborFlags(grid, i, j, predicate) {
  return getNeighborFlagsFromRing(getNeighborRing(grid, i, j, predicate))
}

function getCyclicGroups(ring) {
  const groups = []
  for (let index = 0; index < ring.length; index++) {
    const previous = (index + ring.length - 1) % ring.length
    if (!ring[index] || ring[previous]) continue
    const indices = []
    for (let cursor = index; ring[cursor]; cursor = (cursor + 1) % ring.length) indices.push(cursor)
    groups.push(indices)
  }
  return groups
}

function hasUnsupportedTransition({ n, ne, e, se, s, sw, w, nw }) {
  const cardinalCount = Number(n) + Number(e) + Number(s) + Number(w)
  const diagonalCount = Number(ne) + Number(se) + Number(sw) + Number(nw)
  if ((n && s) || (e && w) || cardinalCount >= 3) return true
  if (cardinalCount === 0) return diagonalCount > 1
  if (cardinalCount !== 1) return false
  if (n) return sw || se
  if (e) return nw || sw
  if (s) return nw || ne
  return ne || se
}

function getWaterBorderFrame({ n, s, w, e, nw, ne, sw, se }) {
  if (w && n) return '001'
  if (e && s) return '002'
  if (w && s) return '003'
  if (e && n) return '000'
  if (n) return '008'
  if (s) return '009'
  if (w) return '011'
  if (e) return '010'
  if (nw) return '005'
  if (sw) return '007'
  if (ne) return '004'
  if (se) return '006'
  return null
}

module.exports = {
  EIGHT_NEIGHBOR_OFFSETS,
  getCyclicGroups,
  getNeighborFlags,
  getNeighborFlagsFromRing,
  getNeighborRing,
  getWaterBorderFrame,
  hasUnsupportedTransition,
}
