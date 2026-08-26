import { getCellsAroundPoint, getPlainCellsAroundPoint } from '../../../lib'
import { CELL_DEPTH, RELIEF_WATER_BUFFER_RADIUS, getEnvironmentTerrainParams } from '../../../constants'
import {
  formatTerrainPatchBorders,
  formatTerrainRelief,
  formatTerrainWaterBorder,
  formatTerrainWaterBorderOverlays,
  rebuildTerrainAppearance,
  rebuildTerrainBackfill,
} from './MapTerrainAppearance'
import { enforceReliefStepContinuity as enforceTerrainReliefStepContinuity } from './MapTerrainReliefContinuity'
import { normalizeWaterTopology as normalizeTerrainWaterTopology } from './MapTerrainWaterTopology'
import type { GridPosition } from '../../../types/grid'
import type { ReliefLevelBounds, TerrainCell, TerrainMap } from './MapTerrainTypes'

export type { ReliefLevelBounds, TerrainCell, TerrainMap } from './MapTerrainTypes'

function isGridPosition(value: unknown): value is GridPosition {
  return (
    typeof value === 'object' &&
    value !== null &&
    Number.isFinite((value as GridPosition).i) &&
    Number.isFinite((value as GridPosition).j)
  )
}

export class MapTerrain {
  map: TerrainMap
  reliefCoastDistances: Int16Array | null
  reliefCoastDistancesSize: number

  constructor(map: TerrainMap) {
    this.map = map
    this.reliefCoastDistances = null
    this.reliefCoastDistancesSize = 0
  }

  generateMapRelief(): void {
    const seed =
      typeof this.map.seed === 'number' && Number.isFinite(this.map.seed) ? this.map.seed : Math.random() * 9999

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

    const n = this.map.size + 1
    const dist = this.map.getReliefCoastDistances()
    const reliefH = new Float32Array(n * n)
    const landHeights: number[] = []
    const scale = 4.5 / this.map.size

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const x = i * scale
        const y = j * scale
        const warpX = (fbm(x * 0.55, y * 0.55, 101) - 0.5) * 1.35
        const warpY = (fbm(x * 0.55, y * 0.55, 307) - 0.5) * 1.35
        const broadRelief = fbm(x + warpX, y + warpY, 503)
        const localRelief = fbm(x * 1.8 + warpX * 0.45, y * 1.8 + warpY * 0.45, 709)
        const height = broadRelief * 0.78 + localRelief * 0.22
        const index = i * n + j
        const cell = this.map.grid[i][j]

        reliefH[index] = height
        if (cell.category !== 'Water' && !cell.has && !cell.waterBorder) landHeights.push(height)
      }
    }

    landHeights.sort((a, b) => a - b)
    const getQuantile = (ratio: number): number =>
      landHeights[Math.min(landHeights.length - 1, Math.floor(landHeights.length * ratio))]
    const reliefBands: [number, number][] = [
      [0.01, -4],
      [0.035, -3],
      [0.09, -2],
      [0.21, -1],
      [0.79, 0],
      [0.91, 1],
      [0.965, 2],
      [0.99, 3],
      [1, 4],
    ].map(([ratio, level]) => [getQuantile(ratio), level])
    // Desert reads as "peu de relief": flatten band levels toward 0 instead of
    // changing the bands themselves, so coast-distance clamping still applies unchanged.
    const { reliefAmplitude } = getEnvironmentTerrainParams(this.map.environment)

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.category === 'Water' || cell.has || cell.waterBorder) continue

        const index = i * n + j
        const matchingBand = reliefBands.find(([threshold]) => reliefH[index] <= threshold)
        const level = Math.round((matchingBand?.[1] ?? 4) * reliefAmplitude)
        const minAllowed = this.map.getMinReliefLevelFromCoastDistance(dist[index])
        const maxAllowed = this.map.getMaxReliefLevelFromCoastDistance(dist[index])
        const targetLevel = Math.max(minAllowed, Math.min(maxAllowed, level))
        if (targetLevel !== cell.z) {
          this.map.setCellReliefLevelDirect(cell, targetLevel)
        }
      }
    }

    this.map.clampReliefAroundWater(dist)

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.z === 1) {
          let cpt = 0
          getCellsAroundPoint(i, j, this.map.grid, 1, c => {
            if (c.z > 0) cpt++
            return false
          })
          if (cpt < 3) this.map.setCellReliefLevelDirect(cell, 0)
        } else if (cell.z === -1) {
          let cpt = 0
          getCellsAroundPoint(i, j, this.map.grid, 1, c => {
            if (c.z < 0) cpt++
            return false
          })
          if (cpt < 3) this.map.setCellReliefLevelDirect(cell, 0)
        }
      }
    }

    this.map.flattenPlayerStartZones()
    this.map.clampReliefAroundWater(dist)
  }

  flattenPlayerStartZones(radius: number = 6): void {
    for (const pos of this.map.playersPos) {
      if (!isGridPosition(pos)) continue
      const cells = getPlainCellsAroundPoint(pos.i, pos.j, this.map.grid, radius).filter(
        (cell: TerrainCell) => cell.category !== 'Water' && !cell.waterBorder
      )
      const zCounts: Record<number, number> = {}
      for (const cell of cells) zCounts[cell.z] = (zCounts[cell.z] || 0) + 1
      const targetZ = Number(Object.entries(zCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0)
      for (const cell of cells) {
        if (cell.z !== targetZ) this.map.setCellReliefLevelDirect(cell, targetZ)
      }
    }
  }

  getReliefCoastDistances(): Int16Array {
    const n = this.map.size + 1
    if (this.reliefCoastDistances && this.reliefCoastDistancesSize === n) {
      return this.reliefCoastDistances
    }

    const dist = new Int16Array(n * n).fill(9999)
    const queue: number[] = []

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.category === 'Water' || cell.waterBorder) {
          dist[i * n + j] = 0
          queue.push(i * n + j)
        }
      }
    }

    for (let qi = 0; qi < queue.length; qi++) {
      const idx = queue[qi]
      const ci = Math.floor(idx / n),
        cj = idx % n
      const d = dist[idx]
      for (const [di, dj] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const ni = ci + di,
          nj = cj + dj
        if (ni < 0 || ni > this.map.size || nj < 0 || nj > this.map.size) continue
        const nidx = ni * n + nj
        if (dist[nidx] > d + 1) {
          dist[nidx] = d + 1
          queue.push(nidx)
        }
      }
    }

    this.reliefCoastDistances = dist
    this.reliefCoastDistancesSize = n
    return dist
  }

  invalidateReliefCoastDistances(): void {
    this.reliefCoastDistances = null
    this.reliefCoastDistancesSize = 0
  }

  getMaxReliefLevelFromCoastDistance(distance: number): number {
    return Math.max(0, distance - RELIEF_WATER_BUFFER_RADIUS)
  }

  getMinReliefLevelFromCoastDistance(distance: number): number {
    return -this.map.getMaxReliefLevelFromCoastDistance(distance)
  }

  setCellReliefLevelDirect(cell: TerrainCell, level: number): void {
    const delta = level - cell.z
    if (delta === 0) return
    cell.y -= delta * CELL_DEPTH
    cell.z = level
  }

  fillWaterGaps(level: number | null = null): Set<TerrainCell> {
    const filledCells = new Set<TerrainCell>()
    const queue: TerrainCell[] = []
    const queued = new Set()

    const enqueue = (cell: TerrainCell) => {
      if (!cell || queued.has(cell)) return
      queued.add(cell)
      queue.push(cell)
    }

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.category === 'Water') enqueue(cell)
      }
    }

    for (let index = 0; index < queue.length; index++) {
      const cell = queue[index]
      for (const [di, dj] of [
        [-2, 0],
        [2, 0],
        [0, -2],
        [0, 2],
      ]) {
        if (this.map.grid[cell.i + di]?.[cell.j + dj]?.category !== 'Water') continue
        const middle = this.map.grid[cell.i + di / 2]?.[cell.j + dj / 2]
        if (middle?.category === 'Water') continue
        if (!middle?.setWater) continue
        if (level != null) this.map.setCellReliefLevelDirect(middle, level)
        middle.setWater()
        filledCells.add(middle)
        enqueue(middle)
      }
    }

    if (filledCells.size) this.invalidateReliefCoastDistances()
    return filledCells
  }

  normalizeWaterTopology(
    level: number | null = null,
    seeds: Set<GridPosition> | null = null,
    protectedCells: Set<TerrainCell> = new Set(),
    pass: number = 0
  ): Set<TerrainCell> {
    return normalizeTerrainWaterTopology(
      this.map,
      () => this.invalidateReliefCoastDistances(),
      level,
      seeds,
      protectedCells,
      pass
    )
  }

  clampReliefAroundWaterLevels(): ReliefLevelBounds {
    const n = this.map.size + 1
    const dist = new Int16Array(n * n).fill(9999)
    const waterLevel = new Int16Array(n * n)
    const minLevels = new Int16Array(n * n).fill(-32768)
    const maxLevels = new Int16Array(n * n).fill(32767)
    const queue: number[] = []

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (cell.category !== 'Water') continue
        const index = i * n + j
        dist[index] = 0
        waterLevel[index] = cell.z
        queue.push(index)
      }
    }

    for (let qi = 0; qi < queue.length; qi++) {
      const index = queue[qi]
      const i = Math.floor(index / n)
      const j = index % n
      for (const [di, dj] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const ni = i + di
        const nj = j + dj
        if (ni < 0 || ni > this.map.size || nj < 0 || nj > this.map.size) continue
        const neighborIndex = ni * n + nj
        if (dist[neighborIndex] <= dist[index] + 1) continue
        dist[neighborIndex] = dist[index] + 1
        waterLevel[neighborIndex] = waterLevel[index]
        queue.push(neighborIndex)
      }
    }

    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const index = i * n + j
        if (dist[index] === 9999) continue
        const cell = this.map.grid[i][j]
        const range = this.map.getMaxReliefLevelFromCoastDistance(dist[index])
        const minAllowed = waterLevel[index] - range
        const maxAllowed = waterLevel[index] + range
        minLevels[index] = minAllowed
        maxLevels[index] = maxAllowed
        if (cell.z < minAllowed) this.map.setCellReliefLevelDirect(cell, minAllowed)
        if (cell.z > maxAllowed) this.map.setCellReliefLevelDirect(cell, maxAllowed)
      }
    }

    return { minLevels, maxLevels }
  }

  rebuildTerrainBackfill(): void {
    rebuildTerrainBackfill(this.map)
  }

  clampReliefAroundWater(dist: Int16Array = this.map.getReliefCoastDistances()): void {
    const n = this.map.size + 1
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        const maxAllowed = this.map.getMaxReliefLevelFromCoastDistance(dist[i * n + j])
        const minAllowed = this.map.getMinReliefLevelFromCoastDistance(dist[i * n + j])
        if (cell.z > maxAllowed) this.map.setCellReliefLevelDirect(cell, maxAllowed)
        if (cell.z < minAllowed) this.map.setCellReliefLevelDirect(cell, minAllowed)
      }
    }
  }

  enforceReliefStepContinuity(
    dist: Int16Array = this.map.getReliefCoastDistances(),
    protectedCells: Set<TerrainCell> = new Set(),
    levelBounds: ReliefLevelBounds | null = null
  ): void {
    enforceTerrainReliefStepContinuity(this.map, dist, protectedCells, levelBounds)
  }

  formatCellsRelief(): void {
    formatTerrainRelief(this.map)
  }

  formatCellsWaterBorder(): void {
    formatTerrainWaterBorder(this.map)
  }

  formatCellsWaterBorderOverlays(): void {
    formatTerrainWaterBorderOverlays(this.map)
  }

  rebuildTerrainAppearance(protectedReliefCells: Set<TerrainCell> = new Set()): void {
    rebuildTerrainAppearance(this.map, protectedReliefCells)
  }

  // Also covers Dirt/Snow (the water-patch ground for Temperate/BlackForest/Jungle, see
  // EnvironmentTerrainParams.patchwork) — passes the triggering cell's own type through so
  // Desert patches get the desert relief sheet and Dirt/Snow patches get their own relief sheet,
  // regardless of which environment/map they're on.
  formatCellsPatchBorders(): void {
    formatTerrainPatchBorders(this.map)
  }
}
