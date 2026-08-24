import { getNeighborFlags, getWaterBorderFrame } from '../../lib/terrain/topology'
import { formatTerrainRelief, rebuildTerrainBackfill } from './MapTerrainReliefAppearance'
import type { PatchBorderGroundType, TerrainCell, TerrainMap } from './MapTerrainTypes'

const BORDER_SHEETS = {
  waterDesertSand: 'desert-sand-water-border',
} as const

export { formatTerrainRelief, rebuildTerrainBackfill }

export function formatTerrainWaterBorder(map: TerrainMap): void {
  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      const cell = map.grid[i][j]
      if (cell.category === 'Water') continue
      const flags = getNeighborFlags(map.grid, i, j, (neighbor: TerrainCell | undefined) => neighbor?.category === 'Water')
      const frame = getWaterBorderFrame(flags)
      if (frame) cell.setWaterBorder?.(BORDER_SHEETS.waterDesertSand, frame)
    }
  }
}

export function formatTerrainWaterBorderOverlays(map: TerrainMap): void {
  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      const cell = map.grid[i][j]
      if (!cell.waterBorder) continue

      const overlay = (neighbor: TerrainCell | undefined, direction: string) => {
        if (
          neighbor &&
          !neighbor.waterBorder &&
          neighbor.category !== 'Water' &&
          neighbor.type !== 'Desert' &&
          neighbor.type !== 'Dirt' &&
          neighbor.type !== 'Snow'
        ) {
          neighbor.setPatchBorder?.(direction)
        }
      }

      overlay(map.grid[i - 1]?.[j], 'east')
      overlay(map.grid[i + 1]?.[j], 'west')
      overlay(map.grid[i]?.[j - 1], 'south')
      overlay(map.grid[i]?.[j + 1], 'north')
    }
  }
}

export function rebuildTerrainAppearance(map: TerrainMap, protectedReliefCells: Set<TerrainCell> = new Set()): void {
  const timings = map.generationTimings
  const measure = <T>(name: string, callback: () => T): T => {
    if (!timings) return callback()
    const startedAt = performance.now()
    const result = callback()
    timings[name] = performance.now() - startedAt
    return result
  }

  measure('terrainResetAppearance', () => {
    const preserveWaterBorder = Boolean(map.blueprintWaterBorderReady)
    for (let i = 0; i <= map.size; i++) {
      for (let j = 0; j <= map.size; j++) {
        map.grid[i][j].resetTerrainAppearance?.({ preserveWaterBorder })
      }
    }
  })

  if (map.blueprintWaterBorderReady) {
    if (timings) timings.terrainWaterBorder = 0
  } else {
    measure('terrainWaterBorder', () => map.formatCellsWaterBorder())
  }
  if (map.pregeneratedBlueprintId) {
    if (timings) {
      timings.terrainClampWaterLevels = 0
      timings.terrainReliefContinuity = 0
    }
  } else {
    const waterLevelBounds = measure('terrainClampWaterLevels', () => map.clampReliefAroundWaterLevels())
    const unrestrictedReliefDistances = new Int16Array((map.size + 1) ** 2).fill(map.size + 4)
    measure('terrainReliefContinuity', () =>
      map.enforceReliefStepContinuity(unrestrictedReliefDistances, protectedReliefCells, waterLevelBounds)
    )
  }
  measure('terrainReliefBorders', () => map.formatCellsRelief())
  measure('terrainPatchBorders', () => map.formatCellsPatchBorders())
  measure('terrainWaterBorderOverlays', () => map.formatCellsWaterBorderOverlays())
}

export function formatTerrainPatchBorders(map: TerrainMap): void {
  const typeToFormat = ['Grass', 'Jungle', 'DarkForest']

  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      const cell = map.grid[i][j]
      if (cell.type !== 'Desert' && cell.type !== 'Dirt' && cell.type !== 'Snow') continue

      const groundType = cell.type as PatchBorderGroundType
      const n = map.grid[i - 1]?.[j]
      const s = map.grid[i + 1]?.[j]
      const w = map.grid[i]?.[j - 1]
      const e = map.grid[i]?.[j + 1]
      if (n && typeToFormat.includes(n.type) && !n.waterBorder) n.setPatchBorder?.('east', groundType)
      if (s && typeToFormat.includes(s.type) && !s.waterBorder) s.setPatchBorder?.('west', groundType)
      if (w && typeToFormat.includes(w.type) && !w.waterBorder) w.setPatchBorder?.('south', groundType)
      if (e && typeToFormat.includes(e.type) && !e.waterBorder) e.setPatchBorder?.('north', groundType)
    }
  }
}
