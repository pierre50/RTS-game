export interface TooltipContent {
  title: string
  description?: string
  meta?: (string | null | undefined)[]
}

export type TooltipSource = TooltipContent | (() => TooltipContent)

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
  tooltip?: TooltipSource
  acquired?: () => boolean
  hide?: () => boolean
  disabled?: () => boolean
  onClick?: MenuSelectionHandler<[evt?: Event | null]>
  onCreate?: MenuSelectionHandler<[element: HTMLElement]>
  children?: MenuButtonSpec[]
}

export interface MinimapPlayerCanvas {
  id: string
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
}
