import { cartesianToIsometric, getGroundReliefLevel, getInstanceZIndex } from './maths'

type TeleportableCell<TUnit extends TeleportableUnit = TeleportableUnit> = {
  has?: unknown
  i: number
  j: number
  place(unit: TUnit): void
  solid?: boolean
  z?: number | null
}

type TeleportableUnit = {
  action?: string | null
  applyReliefLift?: (level: number, immediate?: boolean) => void
  currentCell?: TeleportableCell | null
  i: number
  j: number
  path?: unknown[]
  x: number
  y: number
  z?: number | null
  zIndex?: number
}

type TeleportMap<TUnit extends TeleportableUnit> = {
  addToInstanceBucket?: unknown
  grid: Array<Array<TeleportableCell<TUnit> | undefined> | undefined>
  removeFromInstanceBucket?: unknown
}

export function teleportRuntimeUnitToCell<TUnit extends TeleportableUnit>(
  map: TeleportMap<TUnit>,
  unit: TUnit,
  cell: TeleportableCell<TUnit>
): void {
  const currentCell = unit.currentCell || map.grid[unit.i]?.[unit.j]
  if (currentCell?.has === unit) {
    currentCell.has = null
    currentCell.solid = false
  }
  if (typeof map.removeFromInstanceBucket === 'function') {
    ;(map.removeFromInstanceBucket as (unit: TUnit) => void)(unit)
  }

  const [x, y] = cartesianToIsometric(cell.i, cell.j)
  unit.i = cell.i
  unit.j = cell.j
  unit.x = x
  unit.y = y
  unit.z = cell.z
  unit.zIndex = getInstanceZIndex(unit)
  unit.currentCell = cell
  unit.path = []
  unit.action = null
  cell.place(unit)
  cell.solid = true
  if (typeof map.addToInstanceBucket === 'function') {
    ;(map.addToInstanceBucket as (unit: TUnit) => void)(unit)
  }
  unit.applyReliefLift?.(getGroundReliefLevel(cell), true)
}
