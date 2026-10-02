import type { SaveEntityState } from '../types/save'
type ResourceSaveSource = Pick<SaveEntityState, 'i' | 'j' | 'type'> &
  Partial<
    Pick<
      SaveEntityState,
      | 'label'
      | 'isDead'
      | 'quantity'
      | 'totalQuantity'
      | 'isDestroyed'
      | 'isNaturalResource'
      | 'size'
      | 'hitPoints'
      | 'textureName'
      | 'berrybushFullTextureName'
    >
  > & {
    deferredSpriteBounds?: unknown
    sprite?: object | null
  }
function pick<T extends object, K extends keyof T>(value: T, keys: K[]): Pick<T, K> {
  return Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]])) as Pick<T, K>
}
export function resourceData(resource: ResourceSaveSource): SaveEntityState {
  const data: SaveEntityState = {
    ...pick(resource, [
      'label',
      'i',
      'j',
      'type',
      'isDead',
      'quantity',
      'totalQuantity',
      'isDestroyed',
      'isNaturalResource',
      'size',
      'hitPoints',
    ]),
    textureName: (resource.textureName || '').split('.')[0] ?? '',
  }
  if (!resource.deferredSpriteBounds) {
    const sprite = resource.sprite
    const frame = sprite && 'currentFrame' in sprite ? sprite.currentFrame : undefined
    if (typeof frame === 'number') data.currentFrame = frame
  }
  if (resource.berrybushFullTextureName != null) data.berrybushFullTextureName = resource.berrybushFullTextureName
  return data
}

/** Saved wheat without a growth frame has always meant mature; explicit young frames win. */
export function restoredResourceState<T extends { type: string; currentFrame?: number; startsMature?: boolean }>(
  state: T
): T & { startsMature?: boolean } {
  return state.type === 'Wheat' && state.currentFrame == null && state.startsMature == null
    ? { ...state, startsMature: true }
    : state
}
