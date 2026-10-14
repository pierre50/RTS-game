import { wearEquippedWeapon } from '../equipment/equipmentWear'
import { ACTION_TYPES, FAMILY_TYPES, SHEET_TYPES } from '../constants'
import { Projectile } from '../../classes/Projectile'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { Point } from '../../types/grid'
import { attachProjectileToMapSpace } from '../projectiles'
import { onSpriteLoopAtFrame } from '../graphics'
import { finishHeroToolAnimation } from './heroToolAnimation'
import { findFacingEntity } from './heroTargeting'
import {
  consumeHeroRangedAmmunition,
  getHeroArrowSpawnPoint,
  getHeroMaxArrowDistance,
  hasHeroRangedAmmunition,
  hideReleasedBowArrowLayer,
  finishHeroCatchingPoleThrowAnimation,
  getHeroPowerChargeHoldFrame,
  holdHeroCatchingPoleThrowFrame,
  throwCatchingPoleAt,
  warnHeroNoRangedAmmunition,
} from './heroProjectileTools'
import { getHeroWeaponDamage } from './heroMeleeTools'

type HeroShotTool = NonNullable<UnitEntity['heroPowerChargeTool']>

export function freezeHeroPowerChargeFrame(hero: UnitEntity, frame?: number): void {
  const sprite = hero.sprite
  if (!sprite || hero.currentSheet !== SHEET_TYPES.action) return
  const lastFrame = Math.max(0, sprite.textures.length - 1)
  const holdFrame = getHeroPowerChargeHoldFrame(hero.heroPowerChargeTool)
  hero.heroPowerChargeVisualLocked = true
  sprite.loop = false
  sprite.gotoAndStop(Math.max(0, Math.min(frame ?? holdFrame, lastFrame)))
  hero.syncShadow?.()
  hero.syncAppearanceLayers?.(SHEET_TYPES.action)
}

export function continueHeroPowerChargeAnimation(hero: UnitEntity): void {
  const sprite = hero.sprite
  if (!sprite || hero.currentSheet !== SHEET_TYPES.action || hero.heroPowerReleaseQueued) return
  if (hero.heroPowerChargeVisualLocked) {
    freezeHeroPowerChargeFrame(hero)
    return
  }
  const holdFrame = getHeroPowerChargeHoldFrame(hero.heroPowerChargeTool)
  sprite.loop = false
  sprite.onComplete = undefined
  onSpriteLoopAtFrame(sprite, holdFrame, () => freezeHeroPowerChargeFrame(hero))
  if (!sprite.playing && sprite.currentFrame < holdFrame) sprite.play()
  if (sprite.currentFrame >= holdFrame) freezeHeroPowerChargeFrame(hero)
  hero.syncShadow?.()
  hero.syncAppearanceLayers?.(SHEET_TYPES.action)
}

export function findBowHuntTarget(hero: UnitEntity): RuntimeEntity | null {
  return findFacingEntity(
    hero,
    target =>
      target.family === FAMILY_TYPES.animal &&
      target.type !== 'Horse' &&
      !target.isDead &&
      !target.isDestroyed &&
      (target.hitPoints ?? 1) > 0
  )
}

/** Fires one bow arrow; returns false when the ammunition vanished and the gesture must end now. */
function launchHeroArrow(
  hero: UnitEntity,
  tool: HeroShotTool,
  destination: Point,
  target: RuntimeEntity | undefined,
  power: number
): boolean {
  const map = hero.context?.map
  if (!map) return true
  if (!hasHeroRangedAmmunition(hero)) {
    warnHeroNoRangedAmmunition(hero)
    return true
  }
  const weaponPower = getHeroWeaponDamage(hero, 'bow')
  const projectileType = consumeHeroRangedAmmunition(hero)
  if (!projectileType) return false
  const projectile = new Projectile(
    {
      owner: hero,
      type: projectileType,
      target,
      destination,
      spawnPoint: getHeroArrowSpawnPoint(hero),
      weaponPower,
      maxDistance: getHeroMaxArrowDistance(hero, power),
    },
    hero.context!
  )
  attachProjectileToMapSpace(projectile, map)
  hero.followAssistIntent =
    tool === 'bow' && target ? { action: ACTION_TYPES.hunt, target, targetLabel: target.label } : null
  wearEquippedWeapon(hero, 'ranged')
  return true
}

/** Throws the pole or fires the arrow; returns false when the tool animation was already finished. */
export function launchHeroPowerChargeShot(
  hero: UnitEntity,
  tool: HeroShotTool,
  destination: Point,
  target: RuntimeEntity | undefined,
  power: number
): boolean {
  if (tool !== 'catchingPole') {
    if (launchHeroArrow(hero, tool, destination, target, power)) return true
    finishHeroToolAnimation(hero)
    return false
  }
  const catchingPole = throwCatchingPoleAt(hero, destination, power, {
    onThrowResolved: () => finishHeroCatchingPoleThrowAnimation(hero),
  })
  if (catchingPole) return true
  finishHeroToolAnimation(hero)
  return false
}

export function playHeroPowerChargeShotRelease(hero: UnitEntity, sprite: UnitEntity['sprite'], tool: HeroShotTool) {
  if (!sprite) {
    finishHeroToolAnimation(hero)
    return
  }
  if (tool === 'bow') {
    hideReleasedBowArrowLayer(hero, sprite)
  } else if (tool === 'catchingPole') {
    holdHeroCatchingPoleThrowFrame(hero)
    return
  } else {
    hero.syncAppearanceLayers?.(SHEET_TYPES.action)
  }
  sprite.onFrameChange = undefined
  sprite.onComplete = () => finishHeroToolAnimation(hero)
  sprite.loop = false
  if (sprite.currentFrame >= sprite.textures.length - 1) finishHeroToolAnimation(hero)
  else sprite.play()
}
