export type Point = {
  x: number
  y: number
}

export type GridPosition = {
  i: number
  j: number
}

export type IsoPosition = Point & {
  z: number
}

export type GridCell = GridPosition & {
  border?: boolean
  category?: string
  inclined?: boolean
  solid?: boolean
  visible?: boolean
  waterBorder?: boolean
  z?: number
  [key: string]: unknown
}

export type Grid<TCell extends GridCell = GridCell> = TCell[][]

export type GridZone = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export type InstanceLike = GridPosition &
  Point & {
    category?: string
    degree?: number
    isDestroyed?: boolean
    parent?: {
      grid: Grid
      size: number
      [key: string]: unknown
    }
    size?: number
    [key: string]: unknown
  }
