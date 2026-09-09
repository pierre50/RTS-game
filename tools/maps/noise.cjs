function hashSeed(value) {
  let hash = 2166136261
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function randomFrom(seed) {
  let state = hashSeed(seed)
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function smoothstep(value) {
  return value * value * (3 - 2 * value)
}

function valueNoise(x, y, seed = 0) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = smoothstep(xf)
  const v = smoothstep(yf)
  const sample = (sx, sy) => {
    let hash = hashSeed(seed)
    hash ^= Math.imul(sx + 1, 374761393)
    hash = Math.imul(hash, 668265263)
    hash ^= Math.imul(sy + 1, 1274126177)
    hash = Math.imul(hash, 2246822519)
    return (hash >>> 0) / 4294967296
  }
  const a = sample(xi, yi)
  const b = sample(xi + 1, yi)
  const c = sample(xi, yi + 1)
  const d = sample(xi + 1, yi + 1)
  const top = a + (b - a) * u
  const bottom = c + (d - c) * u
  return top + (bottom - top) * v
}

function macroForestNoise(i, j, seed, scale, seedOffset) {
  const nx = i * scale
  const ny = j * scale
  return (
    valueNoise(nx, ny, seed + seedOffset) * 0.58 +
    valueNoise(nx * 2.1 + 19.7, ny * 2.1 - 13.3, seed + seedOffset + 37) * 0.28 +
    valueNoise(nx * 4.6 - 8.1, ny * 4.6 + 5.9, seed + seedOffset + 73) * 0.14
  )
}

function macroForestClearingNoise(i, j, seed, profile) {
  if (!profile.clearingScale) return 0
  const nx = i * profile.clearingScale
  const ny = j * profile.clearingScale
  return (
    valueNoise(nx + 31.7, ny - 17.9, seed + profile.seedOffset + 211) * 0.68 +
    valueNoise(nx * 2.35 - 9.4, ny * 2.35 + 22.1, seed + profile.seedOffset + 257) * 0.32
  )
}

function applyMacroClearingChance(chance, clearing, profile) {
  if (!profile.clearingThreshold || clearing < profile.clearingThreshold - (profile.clearingFeather ?? 0)) return chance
  if (clearing >= profile.clearingThreshold) return 0
  const feather = Math.max(0.001, profile.clearingFeather ?? 0)
  return chance * ((profile.clearingThreshold - clearing) / feather)
}

function getDeterministicCellVariantIndex(i, j, count, seed = 0) {
  if (!Number.isFinite(count) || count <= 0) return 0
  let hash = hashSeed(seed)
  hash ^= Math.imul(i + 1, 374761393)
  hash = Math.imul(hash, 668265263)
  hash ^= Math.imul(j + 1, 1274126177)
  hash = Math.imul(hash, 2246822519)
  hash ^= hash >>> 15
  return (hash >>> 0) % count
}

function getDeterministicCellVariant(items = [], i, j, seed = 0) {
  if (!Array.isArray(items) || !items.length) return null
  return items[getDeterministicCellVariantIndex(i, j, items.length, seed)]
}

module.exports = {
  getDeterministicCellVariant,
  macroForestNoise,
  macroForestClearingNoise,
  applyMacroClearingChance,
  randomFrom,
}
