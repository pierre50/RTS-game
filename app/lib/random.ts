type SeedValue = string | number

export function pickRandomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export function chance(probability: number): boolean {
  return Math.random() < probability
}

function hashSeed(value: SeedValue): number {
  const text = String(value)
  let hash = 2166136261

  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

function hashCoordinates(seed: SeedValue, i: number, j: number): number {
  return hashCoordinatesFromSeedHash(hashSeed(seed), i, j)
}

function hashCoordinatesFromSeedHash(seedHash: number, i: number, j: number): number {
  let hash = seedHash
  hash ^= Math.imul(i + 1, 374761393)
  hash = Math.imul(hash, 668265263)
  hash ^= Math.imul(j + 1, 1274126177)
  hash = Math.imul(hash, 2246822519)
  hash ^= hash >>> 15
  return hash >>> 0
}

export function createSeededRandom(seed: SeedValue): () => number {
  let state = hashSeed(seed)

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function getDeterministicCellVariantIndex(i: number, j: number, count: number, seed: SeedValue = 0): number {
  if (!Number.isFinite(count) || count <= 0) return 0
  return hashCoordinates(seed, i, j) % count
}

export function getDeterministicCellVariant<T>(items: T[] = [], i: number, j: number, seed: SeedValue = 0): T | null {
  if (!Array.isArray(items) || !items.length) return null
  return items[getDeterministicCellVariantIndex(i, j, items.length, seed)]
}

export function createDeterministicCellVariantPicker(seed: SeedValue = 0): <T>(items: T[] | undefined, i: number, j: number) => T | null {
  const seedHash = hashSeed(seed)
  return <T>(items: T[] = [], i: number, j: number): T | null => {
    if (!Array.isArray(items) || !items.length) return null
    const index = hashCoordinatesFromSeedHash(seedHash, i, j) % items.length
    return items[index]
  }
}
