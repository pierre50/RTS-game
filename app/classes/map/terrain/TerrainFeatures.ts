import type { TerrainGrid } from '../MapGenerationTypes'
import type { TerrainContext } from './TerrainGenerationContext'

export function applyGroundPatch(
  this: TerrainContext,
  centerI: number,
  centerJ: number,
  radius: number,
  terrainValue: TerrainGrid[number][number],
  salt: number
): void {
  const shapeIndex = this.randomInt(0, 3, salt + 17)
  const lobeCount = this.randomInt(1, 3, salt + 23)
  const lobes = [
    {
      angle: this.randomRange(0, Math.PI * 2, salt + 31),
      offset: this.randomRange(radius * 0.18, radius * 0.42, salt + 41),
      radius: this.randomRange(radius * 0.42, radius * 0.72, salt + 47),
    },
    {
      angle: this.randomRange(0, Math.PI * 2, salt + 37),
      offset: this.randomRange(radius * 0.16, radius * 0.36, salt + 43),
      radius: this.randomRange(radius * 0.34, radius * 0.58, salt + 53),
    },
  ].slice(0, lobeCount - 1)
  const maxRadius = Math.ceil(radius * 2)
  const patchCells: Array<[number, number]> = []
  for (let di = -maxRadius; di <= maxRadius; di++) {
    for (let dj = -maxRadius; dj <= maxRadius; dj++) {
      const ni = centerI + di
      const nj = centerJ + dj
      if (!this.isInteriorNonWaterTerrainCell(ni, nj)) continue
      let edge = this.normalizedShapeDistance(di, dj, radius, shapeIndex)
      lobes.forEach(lobe => {
        const li = Math.cos(lobe.angle) * lobe.offset
        const lj = Math.sin(lobe.angle) * lobe.offset
        edge = Math.min(edge, this.normalizedShapeDistance(di - li, dj - lj, lobe.radius, shapeIndex))
      })
      const angle = Math.atan2(dj, di)
      const contour =
        Math.sin(angle * 2 + this.randomRange(-Math.PI, Math.PI, salt + 59)) * 0.1 +
        Math.sin(angle * 5 + this.randomRange(-Math.PI, Math.PI, salt + 61)) * 0.06
      const coarseNoise = (this.hash(ni * 0.37 + salt, nj * 0.37 - salt) - 0.5) * 0.28
      const fineNoise = (this.hash(ni * 1.17 - salt, nj * 1.17 + salt) - 0.5) * 0.16
      const porousEdge = edge > 0.72 && this.hash(ni * 2.19 + salt, nj * 2.19 - salt) < (edge - 0.72) * 0.45
      if (edge + contour + coarseNoise + fineNoise <= 1 && !porousEdge) {
        patchCells.push([ni, nj])
      }
    }
  }
  const shouldKeep = (i: number, j: number): boolean => {
    let neighbours = 0
    for (let ai = -1; ai <= 1; ai++) {
      for (let aj = -1; aj <= 1; aj++) {
        if (ai === 0 && aj === 0) continue
        if (this.terrainMap[i + ai]?.[j + aj] === terrainValue) neighbours++
      }
    }
    return neighbours >= 2
  }
  patchCells.forEach(cell => {
    this.terrainRow(cell[0])[cell[1]] = terrainValue
  })
  patchCells.forEach(cell => {
    if (!shouldKeep(cell[0], cell[1])) this.terrainRow(cell[0])[cell[1]] = this.groundTypeValue
  })
}

export function applyLake(
  this: TerrainContext,
  centerI: number,
  centerJ: number,
  radius: number,
  shoreRadius: number,
  shoreValue: TerrainGrid[number][number] | null,
  salt: number
): void {
  const shapeIndex = this.randomInt(0, 3, salt + 29)
  const maxRadius = Math.ceil(radius + shoreRadius + 2)
  const lakeCells: Array<[number, number]> = []
  for (let di = -maxRadius; di <= maxRadius; di++) {
    for (let dj = -maxRadius; dj <= maxRadius; dj++) {
      const ni = centerI + di
      const nj = centerJ + dj
      if (
        ni < this.borderWaterWidth + maxRadius ||
        nj < this.borderWaterWidth + maxRadius ||
        ni >= this.gridSize - this.borderWaterWidth - maxRadius ||
        nj >= this.gridSize - this.borderWaterWidth - maxRadius
      ) {
        continue
      }
      const edge = this.normalizedShapeDistance(di, dj, radius, shapeIndex)
      const roughness = (this.hash(ni * 0.51 + salt, nj * 0.51 - salt) - 0.5) * 0.28
      if (edge + roughness <= 1) {
        lakeCells.push([ni, nj])
        this.terrainRow(ni)[nj] = 2
      }
    }
  }
  if (!lakeCells.length || shoreValue == null || shoreRadius <= 0) return
  this.applyLakeShore(centerI, centerJ, radius, shoreRadius, shoreValue, salt, shapeIndex, maxRadius)
}

export function applyLakeShore(
  this: TerrainContext,
  centerI: number,
  centerJ: number,
  radius: number,
  shoreRadius: number,
  shoreValue: TerrainGrid[number][number],
  salt: number,
  shapeIndex: number,
  maxRadius: number
): void {
  for (let di = -maxRadius; di <= maxRadius; di++) {
    for (let dj = -maxRadius; dj <= maxRadius; dj++) {
      const ni = centerI + di
      const nj = centerJ + dj
      if (!this.isInteriorNonWaterTerrainCell(ni, nj)) continue
      const edge = this.normalizedShapeDistance(di, dj, radius, shapeIndex)
      const roughness = (this.hash(ni * 0.61 + salt, nj * 0.61 - salt) - 0.5) * 0.35
      if (edge > 1 && edge <= 1 + shoreRadius / Math.max(radius, 1) + roughness) this.terrainRow(ni)[nj] = shoreValue
    }
  }
}
