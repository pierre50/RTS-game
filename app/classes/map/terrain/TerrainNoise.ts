import type { TerrainContext } from './TerrainGenerationContext'

export function hash(this: TerrainContext, x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + this.resolvedSeed * 3.7) * 43758.5453
  return n - Math.floor(n)
}

export function noise(this: TerrainContext, x: number, y: number): number {
  const xi = Math.floor(x),
    yi = Math.floor(y)
  const xf = x - xi,
    yf = y - yi
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const u = smooth(xf),
    v = smooth(yf)
  const a = this.hash(xi, yi),
    b = this.hash(xi + 1, yi)
  const c = this.hash(xi, yi + 1),
    d = this.hash(xi + 1, yi + 1)
  return a + (b - a) * u + (c - a) * v + (d + a - b - c) * u * v
}

export function fbm(this: TerrainContext, x: number, y: number, octaves: number = 5): number {
  let val = 0,
    amp = 0.5,
    freq = 1,
    sum = 0
  for (let o = 0; o < octaves; o++) {
    val += this.noise(x * freq, y * freq) * amp
    sum += amp
    amp *= 0.5
    freq *= 2
  }
  return val / sum
}

export function radialFalloff(this: TerrainContext, i: number, j: number): number {
  const dx = (i - this.half) / this.half
  const dy = (j - this.half) / this.half
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist <= this.falloffPlateau) return 1
  const t = Math.min(1, (dist - this.falloffPlateau) / (1 - this.falloffPlateau))
  return 1 - t * t * (3 - 2 * t)
}

export function randomRange(this: TerrainContext, min: number, max: number, salt: number): number {
  return min + this.hash(salt * 12.9898 + 78.233, salt * 37.719 + 11.17) * (max - min)
}

export function randomInt(this: TerrainContext, min: number, max: number, salt: number): number {
  return Math.floor(this.randomRange(min, max + 1, salt))
}

export function featureCount(this: TerrainContext, baseCount: number): number {
  return Math.max(0, Math.round(baseCount * Math.max(1, this.gridSize / 144)))
}

export function normalizedShapeDistance(
  this: TerrainContext,
  di: number,
  dj: number,
  radius: number,
  shapeIndex: number
): number {
  const angle = Math.atan2(dj, di)
  const rx = radius * (shapeIndex === 1 ? 1.35 : shapeIndex === 2 ? 0.85 : 1.05)
  const ry = radius * (shapeIndex === 1 ? 0.85 : shapeIndex === 2 ? 1.25 : 0.95)
  const bend = shapeIndex === 3 ? Math.sin(angle * 2) * radius * 0.18 : 0
  const x = (di + bend) / rx
  const y = (dj - (shapeIndex === 2 ? Math.cos(angle) * radius * 0.12 : 0)) / ry
  return Math.sqrt(x * x + y * y)
}
