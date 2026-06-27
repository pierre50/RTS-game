function hashSeed(value) {
  const text = String(value)
  let hash = 2166136261

  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function hashCoordinates(seed, i, j) {
  let hash = hashSeed(seed)
  hash ^= Math.imul(i + 1, 374761393)
  hash = Math.imul(hash, 668265263)
  hash ^= Math.imul(j + 1, 1274126177)
  hash = Math.imul(hash, 2246822519)
  hash ^= hash >>> 15
  return hash >>> 0
}

export function createSeededRandom(seed) {
  let state = hashSeed(seed)

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function getDeterministicCellVariantIndex(i, j, count, seed = 0) {
  if (!Number.isFinite(count) || count <= 0) return 0
  return hashCoordinates(seed, i, j) % count
}

export function getDeterministicCellVariant(items = [], i, j, seed = 0) {
  if (!Array.isArray(items) || !items.length) return null
  return items[getDeterministicCellVariantIndex(i, j, items.length, seed)]
}
