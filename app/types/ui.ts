import type { RuntimeEntity } from './entities'

export interface TooltipContent {
  title: string
  description?: string
  meta?: (string | null | undefined)[]
}

export type TooltipSource = TooltipContent | (() => TooltipContent)

export interface MenuButtonSpec {
  id?: string
  icon?: string | (() => string)
  tooltip?: TooltipSource
  hide?: () => boolean
  onClick?: (selection: RuntimeEntity, evt?: Event | null) => void
  onCreate?: (selection: RuntimeEntity, element: HTMLElement) => void
  children?: MenuButtonSpec[]
}

export interface MinimapPlayerCanvas {
  id: string
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
}
