/** Data the game exposes to a resource renderer. No rendering-engine objects belong here. */
export type ResourceVisualState = {
  id: string
  type: string
  spaceId: string
  cell: { i: number; j: number }
  position: { x: number; y: number; elevation: number }
  textureName: string
  visible: boolean
  alpha: number
  sortOrder: number
}

type ResourceVisualSource = {
  label: string
  type: string
  spaceId?: string | null
  i: number
  j: number
  x: number
  y: number
  z?: number | null
  textureName: string
  visible: boolean
  alpha?: number
  zIndex?: number
}

export function resourceVisualState(source: ResourceVisualSource): ResourceVisualState {
  return {
    id: source.label,
    type: source.type,
    spaceId: source.spaceId ?? 'outside',
    cell: { i: source.i, j: source.j },
    position: { x: source.x, y: source.y, elevation: source.z ?? 0 },
    textureName: source.textureName,
    visible: source.visible,
    alpha: source.alpha ?? 1,
    sortOrder: source.zIndex ?? 0,
  }
}

export type ResourceVisualBounds = {
  width: number
  height: number
  anchor: { x: number; y: number }
}

/** A view may be a Pixi container today or a Babylon node later. */
export interface ResourceViewAdapter<TView> {
  bounds(state: ResourceVisualState): ResourceVisualBounds
  mount(state: ResourceVisualState): TView
  update(view: TView, state: ResourceVisualState): void
  unmount(view: TView): void
}
