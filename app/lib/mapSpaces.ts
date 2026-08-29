import type { Container, ContainerChild } from 'pixi.js'
import { BUCKET_SIZE } from '../constants'
import { cartesianToIsometric, getGroundReliefLevel, getInstanceZIndex } from './maths'
import type { GameContextLike } from '../types/context'
import type { RuntimeEntity } from '../types/entities'
import type { GridPosition, Point } from '../types/grid'
import type { RuntimeCell, RuntimeMap, RuntimeMapSpace } from '../types/map'

export const OUTSIDE_SPACE_ID = 'outside'

type BucketGrid = Array<Array<Set<RuntimeEntity>>>
type DisplayEntity = RuntimeEntity &
  ContainerChild & {
    parent?: Container | null
    horseShadow?: (ContainerChild & { parent?: Container | null }) | null
    shadow?: (ContainerChild & { parent?: Container | null }) | null
  }

export type SpaceMapLike = Pick<RuntimeMap, 'grid' | 'mapType' | 'size'> & {
  context?: unknown
  instanceBuckets?: RuntimeMap['instanceBuckets']
}
export type SpaceDisplayObject = ContainerChild & {
  parent?: Container | null
  spaceId?: string | null
}

function normalizeSpaceId(spaceId: string | null | undefined): string {
  return spaceId && spaceId !== OUTSIDE_SPACE_ID ? spaceId : OUTSIDE_SPACE_ID
}

function sortMapSpaceContainer(space: RuntimeMapSpace): void {
  ;(space.container as Container & { sortChildren?: () => void }).sortChildren?.()
}

function sortContainer(container: Container | RuntimeMap | null | undefined): void {
  ;(container as (Container | RuntimeMap) & { sortChildren?: () => void }).sortChildren?.()
}

function removeDisplayFromParent(display: { parent?: Container | null }): void {
  display.parent?.removeChild?.(display as ContainerChild)
}

function addDisplayToContainer(display: SpaceDisplayObject, container: Container | RuntimeMap): void {
  if (display.parent === container) return
  if (typeof container.addChild !== 'function') return
  removeDisplayFromParent(display)
  container.addChild(display)
}

export function getEntitySpaceId(entity: { spaceId?: string | null } | null | undefined): string {
  return normalizeSpaceId(entity?.spaceId)
}

export function getCellSpaceId(cell: { spaceId?: string | null } | null | undefined): string {
  return normalizeSpaceId(cell?.spaceId)
}

export function ensureMapSpaces(map: RuntimeMap): Map<string, RuntimeMapSpace> {
  if (!map.spaces) map.spaces = new Map()
  ensureOutsideMapSpace(map)
  return map.spaces
}

export function ensureOutsideMapSpace(map: RuntimeMap): RuntimeMapSpace {
  if (!map.spaces) map.spaces = new Map()
  const existing = map.spaces.get(OUTSIDE_SPACE_ID)
  const outside: RuntimeMapSpace = existing ?? {
    id: OUTSIDE_SPACE_ID,
    kind: 'outside',
    grid: map.grid,
    size: map.size,
    container: map,
    shadowLayer: map.shadowLayer ?? null,
    shadowRenderContainer: map,
    origin: { x: 0, y: 0 },
    mapType: map.mapType,
    instanceBuckets: map.instanceBuckets ?? null,
  }
  outside.grid = map.grid
  outside.size = map.size
  outside.container = map
  outside.shadowLayer = map.shadowLayer ?? null
  outside.shadowRenderContainer = map
  outside.origin = { x: 0, y: 0 }
  outside.mapType = map.mapType
  outside.instanceBuckets = map.instanceBuckets ?? null
  map.spaces.set(OUTSIDE_SPACE_ID, outside)
  return outside
}

export function getMapSpace(map: RuntimeMap | null | undefined, spaceId?: string | null): RuntimeMapSpace | null {
  if (!map) return null
  const id = normalizeSpaceId(spaceId)
  const spaces = ensureMapSpaces(map)
  return spaces.get(id) ?? spaces.get(OUTSIDE_SPACE_ID) ?? null
}

export function getEntityMapSpace(
  entity: { context?: { map?: RuntimeMap | null }; spaceId?: string | null } | null | undefined,
  fallbackMap?: RuntimeMap | null
): RuntimeMapSpace | null {
  const map = fallbackMap ?? entity?.context?.map
  return getMapSpace(map, entity?.spaceId)
}

export function getActiveMapSpace(map: RuntimeMap | null | undefined): RuntimeMapSpace | null {
  if (!map) return null
  return getMapSpace(map, map.activeSpaceId)
}

export function getActiveInteractionSpace(context: Pick<GameContextLike, 'controls' | 'map'>): RuntimeMapSpace | null {
  const hero = context.controls?.heroUnit
  if (hero) return getEntityMapSpace(hero, context.map)
  return getActiveMapSpace(context.map)
}

function getMapSpaceCell(space: RuntimeMapSpace | null | undefined, i: number, j: number): RuntimeCell | null {
  return space?.grid?.[i]?.[j] ?? null
}

export function getEntityCell(
  entity: { context?: { map?: RuntimeMap | null }; currentCell?: RuntimeCell | null; i: number; j: number; spaceId?: string | null },
  fallbackMap?: RuntimeMap | null
): RuntimeCell | null {
  const map = fallbackMap ?? entity.context?.map
  const space = getEntityMapSpace(entity, map)
  return entity.currentCell ?? getMapSpaceCell(space, entity.i, entity.j) ?? map?.grid?.[entity.i]?.[entity.j] ?? null
}

export function addDisplayObjectToMapSpaceContainer(map: RuntimeMap, display: SpaceDisplayObject): void {
  const space = getMapSpace(map, display.spaceId) ?? ensureOutsideMapSpace(map)
  addDisplayToContainer(display, space.container)
  sortMapSpaceContainer(space)
}

export function addEntityToMapSpaceContainer(map: RuntimeMap, entity: RuntimeEntity): void {
  addDisplayObjectToMapSpaceContainer(map, entity as DisplayEntity)
  attachEntityShadowsToMapSpace(map, entity)
}

export function isOutsideSpaceId(spaceId: string | null | undefined): boolean {
  return normalizeSpaceId(spaceId) === OUTSIDE_SPACE_ID
}

export function sameMapSpace(
  a: { spaceId?: string | null } | null | undefined,
  b: { spaceId?: string | null } | null | undefined
): boolean {
  return getEntitySpaceId(a) === getEntitySpaceId(b)
}

export function isEntityInActiveMapSpace(
  entity: { context?: { map?: RuntimeMap | null }; spaceId?: string | null } | null | undefined,
  fallbackMap?: RuntimeMap | null
): boolean {
  const map = fallbackMap ?? entity?.context?.map
  if (!map) return true
  const activeSpaceId = normalizeSpaceId(map.activeSpaceId)
  return getEntitySpaceId(entity) === activeSpaceId
}

export function sameCellMapSpace(
  entity: { spaceId?: string | null } | null | undefined,
  cell: { spaceId?: string | null } | null | undefined
): boolean {
  return getEntitySpaceId(entity) === getCellSpaceId(cell)
}

export function getSpaceLocalPointFromMapPoint(space: RuntimeMapSpace | null | undefined, point: Point): Point {
  const origin = space?.origin ?? { x: 0, y: 0 }
  return { x: point.x - origin.x, y: point.y - origin.y }
}

function getMapPointFromSpaceLocalPoint(space: RuntimeMapSpace | null | undefined, point: Point): Point {
  const origin = space?.origin ?? { x: 0, y: 0 }
  return { x: point.x + origin.x, y: point.y + origin.y }
}

export function getEntityMapPoint(
  entity: { context?: { map?: RuntimeMap | null }; spaceId?: string | null; x: number; y: number },
  fallbackMap?: RuntimeMap | null
): Point {
  return getMapPointFromSpaceLocalPoint(getEntityMapSpace(entity, fallbackMap), entity)
}

export function getMapSpaceShadowLayer(
  map: RuntimeMap | null | undefined,
  space: RuntimeMapSpace | null | undefined = getActiveMapSpace(map)
): Container | null {
  if (!map) return null
  const resolved = space ?? ensureOutsideMapSpace(map)
  return resolved.shadowLayer ?? (resolved.id === OUTSIDE_SPACE_ID ? (map.shadowLayer ?? null) : null)
}

export function getMapSpaceShadowRenderContainer(
  map: RuntimeMap | null | undefined,
  space: RuntimeMapSpace | null | undefined = getActiveMapSpace(map)
): Container | RuntimeMap | null {
  if (!map) return null
  const resolved = space ?? ensureOutsideMapSpace(map)
  return resolved.shadowRenderContainer ?? (resolved.id === OUTSIDE_SPACE_ID ? map : resolved.container)
}

function attachShadowToMapSpace(
  map: RuntimeMap | null | undefined,
  entity: { spaceId?: string | null },
  shadow: (ContainerChild & { parent?: Container | null }) | null | undefined
): void {
  if (!map || !shadow) return
  const space = getMapSpace(map, entity.spaceId) ?? ensureOutsideMapSpace(map)
  const shadowLayer = getMapSpaceShadowLayer(map, space)
  if (!shadowLayer) {
    shadow.parent?.removeChild(shadow)
    return
  }
  if (shadow.parent !== shadowLayer) {
    shadow.parent?.removeChild(shadow)
    shadowLayer.addChild(shadow)
  }
  sortContainer(shadowLayer)
}

export function attachEntityShadowsToMapSpace(map: RuntimeMap | null | undefined, entity: RuntimeEntity): void {
  const display = entity as DisplayEntity
  attachShadowToMapSpace(map, entity, display.shadow)
  attachShadowToMapSpace(map, entity, display.horseShadow)
}

export function getCellMapPoint(cell: RuntimeCell, map?: RuntimeMap | null): Point {
  return getMapPointFromSpaceLocalPoint(getMapSpace(map ?? null, cell.spaceId), cell)
}

export function getEntitySpaceMapLike(
  entity: { context?: { map?: RuntimeMap | null }; spaceId?: string | null } | null | undefined,
  fallbackMap?: RuntimeMap | null
): SpaceMapLike | null {
  const map = fallbackMap ?? entity?.context?.map
  if (!map) return null
  const space = getEntityMapSpace(entity, map)
  if (!space) return null
  return {
    context: (map as RuntimeMap & { context?: unknown }).context,
    grid: space.grid,
    instanceBuckets: space.instanceBuckets ?? null,
    mapType: space.mapType ?? (space.kind === 'interior' ? 'interior' : map.mapType),
    size: space.size,
  }
}

export function getEntitySpaceGrid(
  entity: { context?: { map?: RuntimeMap | null }; spaceId?: string | null } | null | undefined,
  fallbackMap?: RuntimeMap | null
): RuntimeMap['grid'] | null {
  return getEntitySpaceMapLike(entity, fallbackMap)?.grid ?? null
}

function ensureRuntimeMapSpaceBuckets(space: RuntimeMapSpace): BucketGrid {
  if (space.instanceBuckets) return space.instanceBuckets
  const width = Math.max(1, Math.ceil((space.size + 1) / BUCKET_SIZE))
  const height = Math.max(1, Math.ceil((space.size + 1) / BUCKET_SIZE))
  space.instanceBuckets = Array.from({ length: width }, () => Array.from({ length: height }, () => new Set()))
  return space.instanceBuckets
}

export function addEntityToRuntimeMapSpaceBucket(space: RuntimeMapSpace, entity: RuntimeEntity): void {
  const buckets = ensureRuntimeMapSpaceBuckets(space)
  const bi = Math.floor(entity.i / BUCKET_SIZE)
  const bj = Math.floor(entity.j / BUCKET_SIZE)
  buckets[bi]?.[bj]?.add(entity)
}

export function removeEntityFromRuntimeMapSpaceBucket(space: RuntimeMapSpace, entity: RuntimeEntity): void {
  const buckets = space.instanceBuckets
  if (!buckets) return
  const bi = Math.floor(entity.i / BUCKET_SIZE)
  const bj = Math.floor(entity.j / BUCKET_SIZE)
  buckets[bi]?.[bj]?.delete(entity)
}

export function updateEntityRuntimeMapSpaceBucket(
  space: RuntimeMapSpace,
  entity: RuntimeEntity,
  oldPosition: GridPosition
): void {
  const buckets = space.instanceBuckets
  if (!buckets) return
  const oldBi = Math.floor(oldPosition.i / BUCKET_SIZE)
  const oldBj = Math.floor(oldPosition.j / BUCKET_SIZE)
  const newBi = Math.floor(entity.i / BUCKET_SIZE)
  const newBj = Math.floor(entity.j / BUCKET_SIZE)
  if (oldBi === newBi && oldBj === newBj) return
  buckets[oldBi]?.[oldBj]?.delete(entity)
  buckets[newBi]?.[newBj]?.add(entity)
}

export function moveEntityToMapSpace(
  map: RuntimeMap,
  entity: RuntimeEntity,
  space: RuntimeMapSpace,
  cell: RuntimeCell
): void {
  const display = entity as DisplayEntity
  const previousSpace = getEntityMapSpace(entity, map)
  const previousCell = entity.currentCell ?? previousSpace?.grid[entity.i]?.[entity.j] ?? map.grid[entity.i]?.[entity.j]
  const oldI = entity.i
  const oldJ = entity.j

  if (previousCell?.has === entity || previousCell?.has?.label === entity.label) {
    previousCell.has = null
    previousCell.solid = false
  }
  if (previousSpace) removeEntityFromRuntimeMapSpaceBucket(previousSpace, entity)

  addDisplayToContainer(display, space.container)

  if (space.id === OUTSIDE_SPACE_ID) delete entity.spaceId
  else entity.spaceId = space.id

  const [x, y] = cartesianToIsometric(cell.i, cell.j)
  entity.i = cell.i
  entity.j = cell.j
  entity.x = x
  entity.y = y
  entity.z = cell.z
  entity.zIndex = getInstanceZIndex(entity)
  entity.currentCell = cell
  cell.place(entity)
  cell.solid = true
  addEntityToRuntimeMapSpaceBucket(space, entity)
  if (space.id === OUTSIDE_SPACE_ID) map.updateInstanceBucket?.(entity, oldI, oldJ)
  attachEntityShadowsToMapSpace(map, entity)
  ;(entity as RuntimeEntity & { applyReliefLift?: (level: number, immediate?: boolean) => void }).applyReliefLift?.(
    getGroundReliefLevel(cell),
    true
  )
  ;(entity as RuntimeEntity & { syncShadow?: () => void }).syncShadow?.()
  sortMapSpaceContainer(space)
}
