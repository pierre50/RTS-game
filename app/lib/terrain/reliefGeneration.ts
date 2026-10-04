export function createReliefHeightSampler(seed: number): (x: number, y: number) => number {
  function hash(x: number, y: number, offset: number = 0): number {
    const n = Math.sin(x * 83.7 + y * 214.3 + (seed + offset) * 5.1) * 43758.5453
    return n - Math.floor(n)
  }
  function noise(x: number, y: number, offset: number = 0): number {
    const xi = Math.floor(x),
      yi = Math.floor(y)
    const xf = x - xi,
      yf = y - yi
    const s = (t: number) => t * t * (3 - 2 * t)
    const u = s(xf),
      v = s(yf)
    const a = hash(xi, yi, offset),
      b = hash(xi + 1, yi, offset)
    const c = hash(xi, yi + 1, offset),
      d = hash(xi + 1, yi + 1, offset)
    return a + (b - a) * u + (c - a) * v + (d + a - b - c) * u * v
  }
  function fbm(x: number, y: number, offset: number = 0): number {
    let val = 0,
      amp = 0.5,
      freq = 1,
      sum = 0
    for (let o = 0; o < 5; o++) {
      val += noise(x * freq, y * freq, offset + o * 19.7) * amp
      sum += amp
      amp *= 0.52
      freq *= 1.95
    }
    return val / sum
  }

  return (x, y) => {
    const warpX = (fbm(x * 0.55, y * 0.55, 101) - 0.5) * 1.35
    const warpY = (fbm(x * 0.55, y * 0.55, 307) - 0.5) * 1.35
    const broadRelief = fbm(x + warpX, y + warpY, 503)
    const localRelief = fbm(x * 1.8 + warpX * 0.45, y * 1.8 + warpY * 0.45, 709)
    const height = broadRelief * 0.78 + localRelief * 0.22
    return height
  }
}

export const RELIEF_BANDS: [number, number][] = [
  [0.01, -4],
  [0.035, -3],
  [0.09, -2],
  [0.21, -1],
  [0.79, 0],
  [0.91, 1],
  [0.965, 2],
  [0.99, 3],
  [1, 4],
]
