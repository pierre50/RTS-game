import { isPreparedPathValid, type PathfindingOptions } from '../../services/Pathfinding'
import type { GridCell, GridInstanceLike } from '../../types/grid'

type Instance = GridInstanceLike & { label?: string; spaceId?: string | null }
type MapLike<TCell extends GridCell> = { grid: TCell[][] }
type PreparedContact = {
  instance: Instance
  target: GridInstanceLike
  start: GridCell
  targetI: number
  targetJ: number
  targetSize: number | undefined
  spaceId: string | null | undefined
  path: GridCell[]
}
let active: PreparedContact | undefined

/** A route belongs to one synchronous order, never to a later queued order. */
export function prepareContactPath<TCell extends GridCell>(
  instance: Instance,
  target: GridInstanceLike,
  map: MapLike<TCell>,
  path: TCell[]
): <T>(commit: () => T) => T {
  const prepared: PreparedContact = {
    instance,
    target,
    start: map.grid[instance.i]?.[instance.j],
    targetI: target.i,
    targetJ: target.j,
    targetSize: target.size,
    spaceId: instance.spaceId,
    path,
  }
  return commit => {
    const previous = active
    active = prepared
    try {
      return commit()
    } finally {
      active = previous
    }
  }
}

export function takePreparedContactPath<TCell extends GridCell>(
  instance: Instance,
  target: GridInstanceLike,
  map: MapLike<TCell>,
  isCellAllowed: ((cell: TCell) => boolean) | undefined,
  options: PathfindingOptions<TCell> = {}
): TCell[] | null {
  const prepared = active
  if (!prepared || prepared.instance !== instance || prepared.target !== target) return null
  active = undefined
  const end = prepared.path[0] as TCell | undefined
  if (
    !end ||
    (end.solid && (!instance.label || (end as TCell & { has?: { label?: string } }).has?.label !== instance.label)) ||
    (end.border && (!end.waterBorder || end.solid)) ||
    prepared.spaceId !== instance.spaceId ||
    prepared.start !== map.grid[instance.i]?.[instance.j] ||
    prepared.targetI !== target.i ||
    prepared.targetJ !== target.j ||
    prepared.targetSize !== target.size ||
    (isCellAllowed && !isCellAllowed(end)) ||
    !isPreparedPathValid(instance, prepared, map, options)
  )
    return null
  return [...prepared.path] as TCell[]
}
