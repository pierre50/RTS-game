import { SHEET_TYPES } from '../../constants'
import { cancelFade } from '../../lib/entities/entityFade'
import { buildFrameRange, playSpriteAnimationFromStart, playSpriteFrameSequence } from '../../lib/entities/spriteAnimation'
import type { SchedulerTaskId } from '../../types/context'
import type { UnitEntity } from '../../types/entities'

const SLEEP_WAKE_FRAME_MS = 80
const wakeAnimationTaskIds = new WeakMap<UnitEntity, SchedulerTaskId>()

type UnitWithDetachedShadows = UnitEntity & {
  horseShadow?: { visible?: boolean; stop?: () => void } | null
  syncShadow?: (shadow?: UnitEntity['shadow'], source?: UnitEntity['sprite']) => void
}

type SleepAppearanceLayerSprite = {
  currentFrame?: number
  gotoAndPlay?: (frame: number) => void
  gotoAndStop?: (frame: number) => void
  loop?: boolean
  onComplete?: (() => void) | null
  onFrameChange?: ((frame: number) => void) | null
  onLoop?: (() => void) | null
  playing?: boolean
  stop?: () => void
  textures?: unknown[]
}

type UnitWithAppearanceLayers = UnitEntity & {
  appearanceLayerSprites?: Map<unknown, SleepAppearanceLayerSprite>
}

export function setDetachedShadowsVisible(unit: UnitEntity, visible: boolean): void {
  const shadowed = unit as UnitWithDetachedShadows
  if (shadowed.shadow) shadowed.shadow.visible = visible
  if (shadowed.horseShadow) shadowed.horseShadow.visible = visible
}

function getLastSpriteFrame(unit: UnitEntity): number {
  return Math.max((unit.sprite?.textures?.length ?? 1) - 1, 0)
}

function syncSleepingShadow(unit: UnitEntity): void {
  const shadowed = unit as UnitWithDetachedShadows
  shadowed.syncShadow?.()
  shadowed.shadow?.stop?.()
  shadowed.horseShadow?.stop?.()
}

function getLayerFrame(layer: SleepAppearanceLayerSprite, frame: number): number {
  return Math.max(0, Math.min(frame, Math.max((layer.textures?.length ?? 1) - 1, 0)))
}

function syncSleepingAppearanceLayers(unit: UnitEntity, frame: number, playing: boolean): void {
  const layers = (unit as UnitWithAppearanceLayers).appearanceLayerSprites
  if (!layers?.size) return
  for (const layer of layers.values()) {
    const layerFrame = getLayerFrame(layer, frame)
    layer.loop = false
    layer.onComplete = null
    layer.onFrameChange = null
    layer.onLoop = null
    if (playing) {
      layer.gotoAndPlay?.(layerFrame)
    } else {
      layer.gotoAndStop?.(layerFrame)
      layer.stop?.()
    }
  }
}

function syncHurtFrameShadow(unit: UnitEntity, frame: number): void {
  syncSleepingAppearanceLayers(unit, frame, false)
  syncSleepingShadow(unit)
  setDetachedShadowsVisible(unit, frame !== getLastSpriteFrame(unit))
}

export function cancelSleepingWakeVisual(unit: UnitEntity): void {
  const taskId = wakeAnimationTaskIds.get(unit)
  if (taskId == null) return
  unit.context?.scheduler?.remove(taskId)
  wakeAnimationTaskIds.delete(unit)
}

function freezeSleepingOutsideVisual(unit: UnitEntity): void {
  const lastFrame = getLastSpriteFrame(unit)
  unit.sprite?.gotoAndStop?.(lastFrame)
  unit.sprite?.stop?.()
  syncSleepingAppearanceLayers(unit, lastFrame, false)
  syncHurtFrameShadow(unit, lastFrame)
}

export function playSleepingOutsideVisual(unit: UnitEntity): void {
  cancelSleepingWakeVisual(unit)
  unit.setTextures?.(SHEET_TYPES.dying)
  if (!unit.sprite) return
  playSpriteAnimationFromStart(unit.sprite, {
    clearFrameChange: true,
    loop: false,
    onComplete: () => freezeSleepingOutsideVisual(unit),
  })
  syncSleepingAppearanceLayers(unit, 0, true)
  syncSleepingShadow(unit)
}

export function setSleepingOutsideFinalVisual(unit: UnitEntity): void {
  unit.setTextures?.(SHEET_TYPES.dying)
  freezeSleepingOutsideVisual(unit)
}

export function keepSleepingOutsideVisual(unit: UnitEntity): void {
  if (unit.shelterState?.status !== 'outside') return
  cancelSleepingWakeVisual(unit)
  cancelFade(unit)
  unit.alpha = 1
  unit.visible = true
  setDetachedShadowsVisible(unit, true)
  if (unit.currentSheet === SHEET_TYPES.dying) {
    if (unit.sprite?.playing) syncSleepingShadow(unit)
    else freezeSleepingOutsideVisual(unit)
    return
  }
  setSleepingOutsideFinalVisual(unit)
}

export function playSleepingWakeVisual(unit: UnitEntity, onComplete?: () => void): void {
  cancelSleepingWakeVisual(unit)
  cancelFade(unit)
  unit.alpha = 1
  unit.visible = true
  setDetachedShadowsVisible(unit, true)
  unit.setTextures?.(SHEET_TYPES.dying)
  const sprite = unit.sprite
  const scheduler = unit.context?.scheduler
  if (!sprite || !scheduler) {
    unit.setTextures?.(SHEET_TYPES.standing)
    unit.sprite?.stop?.()
    unit.syncShadow?.()
    onComplete?.()
    return
  }

  sprite.onLoop = undefined
  sprite.onFrameChange = undefined
  sprite.onComplete = undefined
  sprite.loop = false
  sprite.stop?.()
  syncSleepingAppearanceLayers(unit, getLastSpriteFrame(unit), false)

  const frames = buildFrameRange(getLastSpriteFrame(unit), 0)
  const taskId = playSpriteFrameSequence(sprite, scheduler, {
    frameMs: SLEEP_WAKE_FRAME_MS,
    frames,
    onFrame: frame => syncHurtFrameShadow(unit, frame),
    onComplete: () => {
      wakeAnimationTaskIds.delete(unit)
      unit.setTextures?.(SHEET_TYPES.standing)
      unit.sprite?.stop?.()
      unit.syncShadow?.()
      onComplete?.()
    },
    taskName: 'unit.sleepWake',
  })
  if (taskId != null) wakeAnimationTaskIds.set(unit, taskId)
}
