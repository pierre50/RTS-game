import { GROUND_RESOURCE_PLACEMENT as RULES } from '../../config/groundResources'
import type { SaveEntityState, SaveGridPoint } from '../../types/save'

export function isGroundResourceType(type: string): boolean {
  return type === 'GroundWood' || type === 'GroundStone'
}

/** Same candidates live and offline; reloading cannot reroll a blocked renewal. */
export function groundRespawnCandidates(slot: SaveEntityState): SaveGridPoint[] {
  let seed = 17
  for (const char of `${slot.type}:${slot.i}:${slot.j}:${slot.depletedDay ?? 1}`)
    seed = (Math.imul(seed, 31) + char.charCodeAt(0)) | 0
  const points: SaveGridPoint[] = []
  for (let attempt = 0; attempt < 32; attempt++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0
    const i = slot.i + ((seed >>> 0) % 9) - 4
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0
    points.push({ i, j: slot.j + ((seed >>> 0) % 9) - 4 })
  }
  points.push({ i: slot.i, j: slot.j })
  return points
}

/** Ground collection retains the material job even though it uses the foraging animation. */
export function groundResourceJob(type: string): 'wood' | 'stone' | null {
  return type === 'GroundWood' ? 'wood' : type === 'GroundStone' ? 'stone' : null
}

/** Fixed-size neighbourhood check shared by visible and offline renewal. */
export function groundResourceSurroundings(
  type: string,
  point: SaveGridPoint,
  at: (i: number, j: number) => { tree: boolean; building: boolean; ground: boolean }
): boolean {
  const radius = Math.max(RULES.treeRadius, RULES.buildingClearance, RULES.minDistance)
  let tree = false
  for (let di = -radius; di <= radius; di++)
    for (let dj = -radius; dj <= radius; dj++) {
      const nearby = at(point.i + di, point.j + dj)
      const distance = di * di + dj * dj
      if (nearby.building && Math.max(Math.abs(di), Math.abs(dj)) <= RULES.buildingClearance) return false
      if (nearby.ground && distance < RULES.minDistance ** 2) return false
      if (nearby.tree && distance <= RULES.treeRadius ** 2) tree = true
    }
  return type !== 'GroundWood' || tree
}
