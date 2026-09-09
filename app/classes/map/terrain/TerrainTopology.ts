import type { TerrainGrid } from '../MapGenerationTypes'
import type { TerrainContext } from './TerrainGenerationContext'

export function removeDisconnectedLand(this: TerrainContext): void {
  const visited = new Uint8Array(this.gridSize * this.gridSize)
  let bestComponent: number[] | null = null
  for (let i = 0; i < this.gridSize; i++) {
    for (let j = 0; j < this.gridSize; j++) {
      const start = i * this.gridSize + j
      if (this.terrainRow(i)[j] === 2 || visited[start]) continue
      const component = this.collectLandComponent(start, visited)
      if (!bestComponent || component.length > bestComponent.length) bestComponent = component
    }
  }
  if (!bestComponent) return
  const mainland = new Uint8Array(this.gridSize * this.gridSize)
  bestComponent.forEach(index => {
    mainland[index] = 1
  })
  for (let i = 0; i < this.gridSize; i++) {
    for (let j = 0; j < this.gridSize; j++) {
      if (this.terrainRow(i)[j] !== 2 && !mainland[i * this.gridSize + j]) this.terrainRow(i)[j] = 2
    }
  }
}

export function forceOuterWater(this: TerrainContext): void {
  for (let i = 0; i < this.gridSize; i++) {
    for (let j = 0; j < this.gridSize; j++) {
      if (
        i < this.borderWaterWidth ||
        j < this.borderWaterWidth ||
        i >= this.gridSize - this.borderWaterWidth ||
        j >= this.gridSize - this.borderWaterWidth
      ) {
        this.terrainRow(i)[j] = 2
      }
    }
  }
}

export function isInteriorNonWaterTerrainCell(this: TerrainContext, i: number, j: number, margin = 2): boolean {
  return (
    i >= this.borderWaterWidth + margin &&
    j >= this.borderWaterWidth + margin &&
    i < this.gridSize - this.borderWaterWidth - margin &&
    j < this.gridSize - this.borderWaterWidth - margin &&
    this.terrainMap[i]?.[j] !== 2
  )
}

export function hasWaterWithin(this: TerrainContext, centerI: number, centerJ: number, distance: number): boolean {
  const r = Math.ceil(distance)
  const distanceSq = distance * distance
  for (let di = -r; di <= r; di++) {
    for (let dj = -r; dj <= r; dj++) {
      if (di * di + dj * dj > distanceSq) continue
      if (this.terrainMap[centerI + di]?.[centerJ + dj] === 2) return true
    }
  }
  return false
}

export function collectLandComponent(this: TerrainContext, start: number, visited: Uint8Array): number[] {
  visited[start] = 1
  const component = [start]
  const stack = [start]
  while (stack.length) {
    const idx = stack.pop()
    if (idx == null) break
    const ci = Math.floor(idx / this.gridSize)
    const cj = idx % this.gridSize
    // Plain index access, not array destructuring: this function is extracted
    // via .toString() and run inside a Web Worker in total isolation.
    const neighbors: [number, number][] = [
      [ci - 1, cj],
      [ci + 1, cj],
      [ci, cj - 1],
      [ci, cj + 1],
    ]
    neighbors.forEach(neighbor => {
      const ni = neighbor[0]
      const nj = neighbor[1]
      if (ni < 0 || nj < 0 || ni >= this.gridSize || nj >= this.gridSize) return
      const nIdx = ni * this.gridSize + nj
      if (visited[nIdx] || this.terrainRow(ni)[nj] === 2) return
      visited[nIdx] = 1
      component.push(nIdx)
      stack.push(nIdx)
    })
  }

  return component
}

export function terrainRow(this: TerrainContext, i: number): TerrainGrid[number] {
  const row = this.terrainMap[i]
  if (!row) throw new Error('Missing generated terrain row: ' + i)
  return row
}
