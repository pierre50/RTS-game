import type { BlueprintResourceDelta, SaveEntityState } from '../../types/save'
import type { ResourceDefinition } from './CompactResourcePacking'

export type BlueprintBaseline = { count: number; signature: string; legacySignature?: string; flags: Uint8Array }
type PackedColumn = Uint32Array | Uint16Array | Float64Array | Uint8Array
type Definitions = (type: string) => ResourceDefinition

/** FNV-1a over the packed columns and the interned metadata of the first `used` records. */
export function blueprintSignature(columns: PackedColumn[], used: number, metadata: unknown): string {
  let hash = 2166136261
  const consume = (bytes: Uint8Array) => {
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0
  }
  for (const array of columns) consume(new Uint8Array(array.buffer, array.byteOffset, used * array.BYTES_PER_ELEMENT))
  consume(new TextEncoder().encode(JSON.stringify(metadata)))
  return hash.toString(16)
}

export function validateBlueprintDelta(
  baseline: BlueprintBaseline | undefined,
  delta: BlueprintResourceDelta
): BlueprintBaseline {
  if (
    !baseline ||
    delta.version !== 1 ||
    delta.count !== baseline.count ||
    (delta.signature !== baseline.signature && delta.signature !== baseline.legacySignature)
  )
    throw new Error('SAVE_RESOURCE_BLUEPRINT_MISMATCH')
  const seen = new Set<number>()
  for (const index of [...delta.removed, ...delta.updated.map(entry => entry.index)]) {
    if (!Number.isInteger(index) || index < 0 || index >= delta.count || seen.has(index))
      throw new Error('SAVE_RESOURCE_DELTA_CORRUPT')
    seen.add(index)
  }
  return baseline
}

export function sameResourceState(a: SaveEntityState, b: SaveEntityState, definition: Definitions): boolean {
  const normalize = (state: SaveEntityState) => {
    const value = { size: 1, isDead: false, isDestroyed: false, isNaturalResource: false, ...state }
    if (!definition(state.type)?.isAnimated && value.currentFrame === 0) delete value.currentFrame
    return JSON.stringify(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
    )
  }
  return normalize(a) === normalize(b)
}

/** Match each saved state to the blueprint record at its cell; unmatched states are additions. */
export function fullSaveDelta(
  baseline: BlueprintBaseline,
  resources: SaveEntityState[],
  slotAt: (i: number, j: number) => number,
  original: (index: number) => SaveEntityState,
  definition: Definitions
): { resourceDelta: BlueprintResourceDelta; resources: SaveEntityState[] } {
  const seen = new Set<number>()
  const updated: BlueprintResourceDelta['updated'] = []
  const added: SaveEntityState[] = []
  for (const state of resources) {
    const index = slotAt(state.i, state.j)
    if (index < 0 || index >= baseline.count || seen.has(index)) {
      added.push(state)
      continue
    }
    const source = original(index)
    if ((state.label != null && state.label !== source.label) || state.type !== source.type) {
      added.push(state)
      continue
    }
    seen.add(index)
    // Authored blueprint resources omit runtime identity/defaults. Keep the original
    // identity at the same cell, while retaining every explicitly authored change.
    const normalized = state.label == null ? { ...source, ...state, label: source.label } : state
    if (!sameResourceState(normalized, source, definition)) updated.push({ index, state: normalized })
  }
  const removed: number[] = []
  for (let index = 0; index < baseline.count; index++) if (!seen.has(index)) removed.push(index)
  return {
    resources: added,
    resourceDelta: { version: 1, count: baseline.count, signature: baseline.signature, removed, updated },
  }
}
