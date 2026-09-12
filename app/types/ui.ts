export interface MenuDetails {
  title: string
  description?: string
  meta?: (string | null | undefined)[]
}

export type MenuDetailsSource = MenuDetails | (() => MenuDetails)

type MenuSelectionLike = {
  label?: string
  family?: string
  type?: string
  owner?: unknown
}

type MenuSelectionHandler<TArgs extends unknown[] = []> = {
  bivarianceHack(selection: MenuSelectionLike, ...args: TArgs): void
}['bivarianceHack']

export interface MenuButtonSpec {
  id?: string
  icon?: string | (() => string)
  details?: MenuDetailsSource
  acquired?: () => boolean
  hide?: () => boolean
  disabled?: (selection?: MenuSelectionLike) => boolean
  onClick?: MenuSelectionHandler<[evt?: Event | null]>
  onCreate?: MenuSelectionHandler<[element: HTMLElement]>
  children?: MenuButtonSpec[]
}

export interface MinimapPlayerCanvas {
  id: string
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
}
