const { loadGenerationTs } = require('./load-generation-ts.cjs')
const { EIGHT_NEIGHBOR_OFFSETS, hasUnsupportedTransition } = loadGenerationTs('app/lib/terrain/topology.ts')

const WATER = 2
const VOID = 255
const names = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
const bitCount = mask => names.reduce((count, _name, bit) => count + Number(Boolean(mask & (1 << bit))), 0)
const unsupported = Array.from({ length: 256 }, (_, mask) =>
  hasUnsupportedTransition(Object.fromEntries(names.map((name, bit) => [name, Boolean(mask & (1 << bit))])))
)
// Keep as much water as possible, with a stable tie-break between equal costs.
const retainedMasks = unsupported.map((_value, mask) =>
  Array.from({ length: 256 }, (_, subset) => subset)
    .filter(subset => (subset & mask) === subset && !unsupported[subset])
    .sort((a, b) => bitCount(b) - bitCount(a) || a - b)
)

// Repair the final projected grid before placement and appearance generation.
// Only fill the minimum neighbouring water cells for each unsupported corner.
// Monotonic filling terminates without the coastline erosion caused by repeatedly
// removing land tips. The global frontier also crosses content patch boundaries.
function normalizeLargeCoast(terrain, size, biomeCodes) {
  const stride = size + 1
  if (terrain.length !== stride * stride || biomeCodes.length !== terrain.length)
    throw new Error('Invalid continent coast buffers')
  const isLand = index => terrain[index] !== WATER && terrain[index] !== VOID
  let added = 0,
    passes = 0
  const addedByBiome = {}
  const repair = (index, changed) => {
    if (!isLand(index)) return
    const i = Math.floor(index / stride),
      j = index % stride
    let mask = 0,
      voidMask = 0
    for (let bit = 0; bit < EIGHT_NEIGHBOR_OFFSETS.length; bit++) {
      const [di, dj] = EIGHT_NEIGHBOR_OFFSETS[bit]
      const ni = i + di,
        nj = j + dj
      if (ni < 0 || nj < 0 || ni > size || nj > size || terrain[ni * stride + nj] === VOID) {
        voidMask |= 1 << bit
        mask |= 1 << bit
      } else if (terrain[ni * stride + nj] === WATER) mask |= 1 << bit
    }
    if (!unsupported[mask]) return
    const retained = retainedMasks[mask].find(candidate => (candidate & voidMask) === voidMask)
    // Never extend the playable footprint to repair a malformed source mask.
    if (retained === undefined) throw new Error(`Unrenderable continent boundary at ${i},${j}`)
    for (let bit = 0; bit < EIGHT_NEIGHBOR_OFFSETS.length; bit++) {
      if (!(mask & ~retained & (1 << bit))) continue
      const [di, dj] = EIGHT_NEIGHBOR_OFFSETS[bit]
      const target = index + di * stride + dj
      terrain[target] = terrain[index]
      biomeCodes[target] = biomeCodes[index]
      const code = String.fromCharCode(biomeCodes[index])
      addedByBiome[code] = (addedByBiome[code] ?? 0) + 1
      added++
      changed.add(target)
    }
  }
  let pending = new Set()
  for (let index = 0; index < terrain.length; index++) repair(index, pending)
  while (pending.size) {
    passes++
    const next = new Set()
    for (const index of pending) {
      repair(index, next)
      const i = Math.floor(index / stride),
        j = index % stride
      for (const [di, dj] of EIGHT_NEIGHBOR_OFFSETS) {
        const ni = i + di,
          nj = j + dj
        if (ni >= 0 && nj >= 0 && ni <= size && nj <= size) repair(ni * stride + nj, next)
      }
    }
    pending = next
  }
  return { added, passes, addedByBiome }
}

module.exports = { normalizeLargeCoast }
