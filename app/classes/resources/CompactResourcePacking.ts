import type { SaveEntityState } from '../../types/save'

export type ResourceDefinition = {
  totalQuantity?: number
  totalHitPoints?: number
  quantity?: number
  hitPoints?: number
  isAnimated?: boolean
}

const supportedFields = new Set([
  'i',
  'j',
  'type',
  'textureName',
  'label',
  'isNaturalResource',
  'quantity',
  'totalQuantity',
  'hitPoints',
  'size',
  'isDead',
  'isDestroyed',
  'spaceId',
  'berrybushFullTextureName',
])

export function canPackResource(
  state: SaveEntityState,
  definition: (type: string) => ResourceDefinition | undefined
): boolean {
  return Boolean(
    state.textureName &&
      !state.isDead &&
      !state.isDestroyed &&
      (state.size == null || state.size === 1) &&
      (!state.spaceId || state.spaceId === 'outside') &&
      !definition(state.type)?.isAnimated &&
      Object.keys(state).every(key => supportedFields.has(key))
  )
}

export function packedResourceValues(state: SaveEntityState, definition: ResourceDefinition) {
  const total = state.totalQuantity ?? definition.totalQuantity ?? 0
  return {
    total,
    quantity: state.quantity ?? definition.quantity ?? total,
    hitPoints: state.hitPoints ?? definition.hitPoints ?? definition.totalHitPoints ?? 0,
    flags: 1 | (state.isNaturalResource ? 2 : 0),
  }
}

/** Cell position encoded by a default `${prefix}:${position}` label, if any. */
export function generatedLabelPosition(label: string, prefix: string, cells: number): number | undefined {
  if (!label.startsWith(`${prefix}:`)) return undefined
  const position = Number(label.slice(prefix.length + 1))
  return Number.isSafeInteger(position) && position >= 0 && position < cells ? position : undefined
}
