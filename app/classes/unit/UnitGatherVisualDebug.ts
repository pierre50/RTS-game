import { SHEET_TYPES } from '../../constants'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'

const GATHER_VISUAL_DEBUG_STORAGE_KEY = 'rts.debug.gatherVisual'
const GATHER_VISUAL_ANOMALY_THROTTLE_MS = 750
const lastGatherVisualAnomalyLogAt = new Map<string, number>()

function isGatherVisualDebugEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return window.localStorage?.getItem(GATHER_VISUAL_DEBUG_STORAGE_KEY) === '1'
  }
  return Boolean((globalThis as { RTS_DEBUG_GATHER_VISUAL?: boolean }).RTS_DEBUG_GATHER_VISUAL)
}

function getSheetTextureCount(sheet: unknown): number | null {
  const textures = (sheet as { textures?: unknown } | null | undefined)?.textures
  if (!textures || typeof textures !== 'object') return null
  return Array.isArray(textures) ? textures.length : Object.keys(textures).length
}

export function logGatherVisualState(unit: UnitEntity, dest: RuntimeEntity, loadingType: string, gain: number): void {
  const currentSheet = unit.currentSheet ?? null
  const expectedSheet = SHEET_TYPES.action
  const mismatch = Boolean(currentSheet) && currentSheet !== expectedSheet
  if (!mismatch && !isGatherVisualDebugEnabled()) return

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const key = unit.label ?? `${unit.type ?? 'unit'}:${unit.i},${unit.j}`
  if (mismatch) {
    const last = lastGatherVisualAnomalyLogAt.get(key) ?? 0
    if (now - last < GATHER_VISUAL_ANOMALY_THROTTLE_MS) return
    lastGatherVisualAnomalyLogAt.set(key, now)
  }

  const payload = {
    gain,
    loadingType,
    unit: {
      label: unit.label,
      type: unit.type,
      owner: unit.owner?.label,
      ownerName: unit.owner?.name,
      work: unit.work,
      action: unit.action,
      currentSheet,
      expectedSheet,
      pathLength: unit.path?.length ?? 0,
      spritePlaying: unit.sprite?.playing,
      spriteFrame: unit.sprite?.currentFrame,
      hasActionSheet: Boolean(unit.actionSheet),
      actionSheetTextureCount: getSheetTextureCount(unit.actionSheet),
      hasWalkingSheet: Boolean(unit.walkingSheet),
      walkingSheetTextureCount: getSheetTextureCount(unit.walkingSheet),
      i: unit.i,
      j: unit.j,
    },
    target: {
      label: dest.label,
      type: dest.type,
      family: dest.family,
      quantity: dest.quantity,
      i: dest.i,
      j: dest.j,
    },
  }

  const message = mismatch ? '[gather-visual-mismatch]' : '[gather-visual]'
  if (mismatch) console.warn(message, payload)
  else console.debug(message, payload)
}
