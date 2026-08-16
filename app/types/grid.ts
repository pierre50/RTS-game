export type Point = {
  x: number
  y: number
}

export type GridPosition = {
  i: number
  j: number
}

export type GridCell = GridPosition & {
  border?: boolean
  category?: string
  inclined?: boolean
  solid?: boolean
  visible?: boolean
  waterBorder?: boolean
  z?: number
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
    parent?: object | null
    size?: number
  }

export type GridInstanceLike = GridPosition &
  Partial<Point> & {
    category?: string
    isDestroyed?: boolean
    parent?: object | null
    size?: number
  }
