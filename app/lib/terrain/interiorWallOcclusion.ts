import type { MapBlueprint } from '../../classes/map/MapGenerationTypes'
import { getInteriorFloorVertices, type getInteriorWallGeometry } from './interiorWallGeometry'

// Strict polygon overlap excludes cells merely sharing an edge with a wall.
function overlaps(a: number[][], b: number[][]): boolean {
  for (const polygon of [a, b]) {
    for (let index = 0; index < polygon.length; index++) {
      const [x, y] = polygon[index]
      const [nextX, nextY] = polygon[(index + 1) % polygon.length]
      const axisX = y - nextY
      const axisY = nextX - x
      if (axisX === 0 && axisY === 0) continue
      const project = ([px, py]: number[]) => px * axisX + py * axisY
      const first = a.map(project)
      const second = b.map(project)
      if (Math.max(...first) <= Math.min(...second) || Math.max(...second) <= Math.min(...first)) return false
    }
  }
  return true
}

export function createInteriorWallOcclusionCheck(blueprint: MapBlueprint) {
  const floors: { depth: number; polygon: number[][] }[] = []
  blueprint.floorMask?.forEach((row, i) => {
    row.forEach((value, j) => {
      if (value === 1) floors.push({ depth: i + j, polygon: getInteriorFloorVertices(blueprint, i, j) })
    })
  })
  return (geometry: NonNullable<ReturnType<typeof getInteriorWallGeometry>>): boolean =>
    floors.some(floor => floor.depth < geometry.zIndex && overlaps(geometry.polygon, floor.polygon))
}
