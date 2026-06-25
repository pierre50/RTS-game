export const EIGHT_NEIGHBOR_OFFSETS = Object.freeze([
  [-1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
])

export const EIGHT_NEIGHBOR_NAMES = Object.freeze(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'])

export function getNeighborRing(grid, i, j, predicate) {
  return EIGHT_NEIGHBOR_OFFSETS.map(([di, dj]) => predicate(grid[i + di]?.[j + dj], di, dj))
}

export function getNeighborFlags(grid, i, j, predicate) {
  return getNeighborFlagsFromRing(getNeighborRing(grid, i, j, predicate))
}

export function getNeighborFlagsFromRing(ring) {
  return Object.fromEntries(EIGHT_NEIGHBOR_NAMES.map((name, index) => [name, ring[index]]))
}

// A single flat tile cannot represent opposite edges, three-sided junctions,
// or diagonals that sit behind an otherwise single edge. Both the relief and
// water atlases use this same topological constraint.
export function hasUnsupportedTransition({ n, ne, e, se, s, sw, w, nw }) {
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

// BOR20000 contains one flat shoreline frame for each visible edge/corner.
// A concave shoreline has two cardinal water neighbours but no diagonal water
// neighbour; it still needs the matching corner frame, not an isolated
// diagonal frame.
export function getWaterBorderFrame({ n, s, w, e, nw, ne, sw, se }) {
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

export function getCyclicGroups(ring) {
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
