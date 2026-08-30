import { SHEET_TYPES } from '../constants'
import { onSpriteLoopAtFrame } from '../graphics'
import { logHeroSlashFrame, playReverseSlashRecovery } from '../entities/slashRecoveryAnimation'
import { resetUnitCrouchPose } from '../units/unitCrouchPose'
import type { UnitEntity } from '../../types/entities'

const HERO_SWORD_POWER_FLASH_MS = 180

export type FlashableLayer = {
  alpha?: number
  blendMode?: unknown
  tint?: number | string
  visible?: boolean
}

type HeroLayerFlashState = {
  alpha?: number
  blendMode?: unknown
  tint?: number | string
  token: number
}

export type HeroToolAnimationOptions = {
  recoveryAnimation?: 'reverseSlash'
  swordChargePower?: number
}

type SwordPowerFlashHost = UnitEntity & {
  appearance?: { layers?: Array<{ equipmentKey?: string }> }
  appearanceLayerSprites?: Map<number, FlashableLayer>
}

const heroLayerFlashStates = new WeakMap<FlashableLayer, HeroLayerFlashState>()

export function flashHeroLayers(
  hero: UnitEntity,
  targets: FlashableLayer[],
  {
    alpha,
    blendMode,
    durationMs,
    taskLabel,
    tint,
  }: { alpha: number; blendMode: unknown; durationMs: number; taskLabel: string; tint: number }
): void {
  if (!targets.length) return
  const states = targets.map(target => {
    const previous = heroLayerFlashStates.get(target)
    const state = {
      target,
      alpha: previous?.alpha ?? target.alpha,
      blendMode: previous?.blendMode ?? target.blendMode,
      tint: previous?.tint ?? target.tint,
      token: (previous?.token ?? 0) + 1,
    }
    heroLayerFlashStates.set(target, state)
    return state
  })
  for (const target of targets) {
    target.tint = tint
    target.alpha = alpha
    target.blendMode = blendMode
  }
  hero.context?.scheduler?.addOneShot(
    () => {
      for (const state of states) {
        if (heroLayerFlashStates.get(state.target)?.token !== state.token) continue
        state.target.tint = state.tint
        state.target.alpha = state.alpha
        state.target.blendMode = state.blendMode
        heroLayerFlashStates.delete(state.target)
      }
    },
    durationMs,
    taskLabel
  )
}

function getHeroSwordPowerFlashLayers(hero: UnitEntity): FlashableLayer[] {
  const host = hero as SwordPowerFlashHost
  const sprites = host.appearanceLayerSprites
  if (!sprites) return []
  return (host.appearance?.layers ?? [])
    .map((layer, index) => (layer.equipmentKey?.startsWith('sword_') ? sprites.get(index) : null))
    .filter((layer): layer is FlashableLayer => Boolean(layer && layer.visible !== false))
}

function showHeroSwordPowerFlash(hero: UnitEntity, power: number | undefined): void {
  const clampedPower = Math.max(0, Math.min(1, power ?? 0))
  if (clampedPower <= 0) return
  const targets = getHeroSwordPowerFlashLayers(hero)
  const tint = clampedPower >= 0.66 ? 0xfff06a : 0xffc857
  flashHeroLayers(hero, targets, {
    alpha: Math.min(1, 0.72 + clampedPower * 0.28),
    blendMode: 'add',
    durationMs: HERO_SWORD_POWER_FLASH_MS,
    taskLabel: 'hero.swordPowerFlash',
    tint,
  })
}

export function playHeroToolAnimation(
  hero: UnitEntity,
  onImpact?: () => void,
  impactFrame: number | null = null,
  options: HeroToolAnimationOptions = {}
): void {
  const sprite = hero.sprite
  if (!sprite || hero.actionLocked) return

  hero.actionLocked = true
  sprite.loop = false
  const finishAnimation = () => finishHeroToolAnimation(hero)
  hero.setTextures?.(SHEET_TYPES.action)
  resetUnitCrouchPose(hero)
  hero.syncMountedHorseSprite?.()
  showHeroSwordPowerFlash(hero, options.swordChargePower)
  logHeroSlashFrame(hero, 'tool:start', { impactFrame, recoveryAnimation: options.recoveryAnimation ?? null })
  sprite.gotoAndPlay(0)
  logHeroSlashFrame(hero, 'tool:gotoAndPlay:0')
  hero.syncShadow?.()

  sprite.onComplete = finishAnimation

  if (!onImpact) return
  if (impactFrame == null) {
    onImpact()
    return
  }
  onSpriteLoopAtFrame(sprite, impactFrame, () => {
    logHeroSlashFrame(hero, 'tool:impact', { impactFrame })
    onImpact()
    if (options.recoveryAnimation !== 'reverseSlash') return
    const handled = playReverseSlashRecovery(hero, {
      onComplete: finishAnimation,
      releaseFrame: impactFrame,
      stopFrame: impactFrame - 1,
    })
    if (!handled) return
    sprite.onComplete = undefined
    sprite.onFrameChange = undefined
  })
}

export function finishHeroToolAnimation(hero: UnitEntity): void {
  const sprite = hero.sprite
  logHeroSlashFrame(hero, 'tool:finish:start')
  if (hero.attackRecoveryAnimationTaskId != null) {
    hero.context?.scheduler?.remove?.(hero.attackRecoveryAnimationTaskId)
    hero.attackRecoveryAnimationTaskId = null
  }
  if (sprite) {
    sprite.onComplete = undefined
    sprite.onFrameChange = undefined
    sprite.loop = true
  }
  hero.actionLocked = false
  hero.contextAction = null
  const hadPendingOrder = hero.flushPendingOrder?.()
  if (!hadPendingOrder && !hero.isDead) hero.setTextures?.(SHEET_TYPES.standing)
  logHeroSlashFrame(hero, 'tool:finish:end', { hadPendingOrder: Boolean(hadPendingOrder) })
  hero.syncShadow?.()
}
