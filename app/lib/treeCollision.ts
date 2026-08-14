import { BUCKET_SIZE, FAMILY_TYPES, RESOURCE_TYPES } from '../constants'
import { isometricToCartesian, pointIsBetweenTwoPoint, pointsDistance } from './maths'
import type { ResourceEntity } from '../types/entities'
import type { Point } from '../types/grid'
import type { RuntimeMap } from '../types/map'

const DEFAULT_TREE_TRUNK_RADIUS = 10
const DEFAULT_TREE_SEARCH_RADIUS = 1.5
const DEFAULT_TREE_CANOPY_BLOCK_HEIGHT = 90

type TreeSegmentCollisionOptions = {
  currentAltitude?: number
  canopyBlockHeight?: number
  trunkRadius?: number
  searchRadius?: number
}

function findNearbyTrees(map: RuntimeMap, i: number, j: number, searchRadius: number): ResourceEntity[] {
  const buckets = map.instanceBuckets
  if (!buckets || !buckets.length) return []

  const minBi = Math.max(Math.floor((i - searchRadius) / BUCKET_SIZE), 0)
  const maxBi = Math.min(Math.floor((i + searchRadius) / BUCKET_SIZE), buckets.length - 1)
  const minBj = Math.max(Math.floor((j - searchRadius) / BUCKET_SIZE), 0)
  const maxBj = Math.min(Math.floor((j + searchRadius) / BUCKET_SIZE), (buckets[0]?.length ?? 1) - 1)

  const trees: ResourceEntity[] = []
  for (let bi = minBi; bi <= maxBi; bi++) {
    for (let bj = minBj; bj <= maxBj; bj++) {
      for (const instance of buckets[bi]?.[bj] ?? []) {
        if (instance.family === FAMILY_TYPES.resource && (instance as ResourceEntity).type === RESOURCE_TYPES.tree) {
          trees.push(instance as ResourceEntity)
        }
      }
    }
  }
  return trees
}

export function findTreeSegmentCollision(
  map: RuntimeMap,
  previous: Point,
  current: Point,
  {
    currentAltitude,
    canopyBlockHeight = DEFAULT_TREE_CANOPY_BLOCK_HEIGHT,
    trunkRadius = DEFAULT_TREE_TRUNK_RADIUS,
    searchRadius = DEFAULT_TREE_SEARCH_RADIUS,
  }: TreeSegmentCollisionOptions = {}
): ResourceEntity | null {
  if (typeof currentAltitude === 'number' && currentAltitude > canopyBlockHeight) return null

  const [i, j] = isometricToCartesian(current.x, current.y)
  let closest: ResourceEntity | null = null
  let closestDistance = Infinity
  for (const tree of findNearbyTrees(map, i, j, searchRadius)) {
    if (tree.isDead || tree.isDestroyed) continue
    if (!pointIsBetweenTwoPoint(previous, current, { x: tree.x, y: tree.y }, trunkRadius)) continue
    const distance = pointsDistance(current.x, current.y, tree.x, tree.y)
    if (distance >= closestDistance) continue
    closest = tree
    closestDistance = distance
  }
  return closest
}
