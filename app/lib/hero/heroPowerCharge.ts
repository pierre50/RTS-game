import { HERO_POWER_CHARGE_MS } from './heroCombatRules'
import { isEquipmentBroken } from '../equipment/equipmentCondition'
import { takeSprintAttackMultiplier } from '../units/movement/unitSprint'
import { SHEET_TYPES } from '../constants'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { Point } from '../../types/grid'
import { onSpriteLoopAtFrame, SLASH_IMPACT_FRAME } from '../graphics'
import { angleDelta, degreeToDirection } from '../maths'
import { drainTimedHeroEnergy, hasEnergyToStartTimedHeroAction } from './heroEnergy'
import { finishHeroToolAnimation } from './heroToolAnimation'
import { MOUNTED_ATTACK_HALF_ANGLE, getHeroAimDegree } from './heroTargeting'
import { getHeroPowerChargeHoldFrame, getHeroShootReleaseFrame } from './heroProjectileTools'
import {
  continueHeroPowerChargeAnimation,
  findBowHuntTarget,
  freezeHeroPowerChargeFrame,
  launchHeroPowerChargeShot,
  playHeroPowerChargeShotRelease,
} from './heroPowerChargeEffects'
import {
  getHeroSwordChargeDamageMultiplier,
  playEmptyHandWhiff,
  triggerInteractMeleeAt,
  triggerSwordAttackAt,
} from './heroMeleeTools'
import { getHeroPowerChargeToolForEquippedItem, type HeroEquippedItem } from './heroToolEquipment'

import { getEquippedWorkTool } from '../equipment/workTools'

const sprintChargeMultipliers = new WeakMap<UnitEntity, number>()

type HeroPowerChargeTool = 'bow' | 'catchingPole' | 'sword' | 'tool'

const HERO_POWER_CHARGE_ENERGY_ACTION = 'heroPowerCharge'

function getHeroPowerChargeRatio(hero: UnitEntity, now = performance.now()): number {
  if (hero.heroPowerChargeStart == null) return 0
  return Math.max(0, Math.min(1, (now - hero.heroPowerChargeStart) / HERO_POWER_CHARGE_MS))
}

function hasEnergyToStartPowerCharge(hero: UnitEntity): boolean {
  return hasEnergyToStartTimedHeroAction(hero, HERO_POWER_CHARGE_ENERGY_ACTION)
}

function drainHeroPowerChargeEnergy(hero: UnitEntity, now = performance.now()): boolean {
  return drainTimedHeroEnergy(
    hero,
    HERO_POWER_CHARGE_ENERGY_ACTION,
    hero.heroPowerChargeStart,
    hero.heroPowerChargeLastEnergyAt,
    value => (hero.heroPowerChargeLastEnergyAt = value),
    HERO_POWER_CHARGE_MS,
    now
  )
}

export function aimHeroPowerChargeAt(hero: UnitEntity, destination: Point): boolean {
  if (hero.heroPowerChargeStart == null || hero.heroPowerReleaseQueued) return false
  const aimDegree = getHeroAimDegree(hero, destination)
  if (
    hero.mountedOnHorse &&
    hero.heroPowerChargeFacingDegree != null &&
    angleDelta(aimDegree, hero.heroPowerChargeFacingDegree) > MOUNTED_ATTACK_HALF_ANGLE
  ) {
    return true
  }
  const previousDirection = degreeToDirection(hero.degree ?? 0)
  hero.degree = aimDegree
  hero.heroPowerChargeDestination = destination
  hero.heroPowerChargeTarget = null
  if (hero.currentSheet === SHEET_TYPES.action && degreeToDirection(hero.degree ?? 0) !== previousDirection) {
    hero.setTextures?.(SHEET_TYPES.action)
    if (hero.heroPowerChargeVisualLocked) freezeHeroPowerChargeFrame(hero)
    updateHeroPowerCharge(hero)
  }
  return true
}

export function isHeroPowerChargeActiveForTool(hero: UnitEntity, tool: HeroEquippedItem | null | undefined): boolean {
  return (
    hero.heroPowerChargeStart != null &&
    (hero.heroPowerChargeTool === 'tool'
      ? tool === 'interact'
      : hero.heroPowerChargeTool === getHeroPowerChargeToolForEquippedItem(hero, tool)) &&
    !hero.heroPowerReleaseQueued
  )
}

export function updateHeroPowerCharge(hero: UnitEntity, now = performance.now()): void {
  if (hero.heroPowerChargeStart == null) return
  if (hero.heroPowerReleaseQueued) return
  if (!drainHeroPowerChargeEnergy(hero, now)) {
    releaseHeroPowerCharge(hero, now)
    return
  }
  const ratio = getHeroPowerChargeRatio(hero, now)
  hero.heroPowerChargeRatio = ratio
  hero.drawHeroPowerBar?.(ratio)
  const sprite = hero.sprite
  if (hero.heroPowerChargeVisualLocked) {
    freezeHeroPowerChargeFrame(hero)
    return
  }
  if (sprite && hero.currentSheet === SHEET_TYPES.action) {
    continueHeroPowerChargeAnimation(hero)
  }
}

function clearHeroPowerCharge(hero: UnitEntity): void {
  sprintChargeMultipliers.delete(hero)
  hero.heroPowerChargeStart = null
  hero.heroPowerChargeRatio = undefined
  hero.heroPowerChargeDestination = null
  hero.heroPowerChargeTarget = null
  hero.heroPowerReleaseQueued = false
  hero.heroPowerReleasePower = undefined
  hero.heroPowerChargeFacingDegree = null
  hero.heroPowerChargeVisualLocked = false
  hero.heroPowerChargeLastEnergyAt = undefined
  delete hero.heroPendingToolStrike
  delete hero.heroPowerChargeTool
  hero.removeHeroPowerBar?.()
}

export function cancelHeroPowerCharge(hero: UnitEntity): void {
  if (hero.heroPowerChargeStart == null) return
  clearHeroPowerCharge(hero)
  finishHeroToolAnimation(hero)
}

export function cancelHeroCatchingPole(hero: UnitEntity): void {
  hero.heroCatchingPoleThrow?.clearCatchingPoleThrow({ releaseHorse: true })
}

function finishHeroMeleeChargeAttack(hero: UnitEntity, destination: Point, power: number): boolean {
  const isTool = hero.heroPowerChargeTool === 'tool'
  if (isTool && getEquippedWorkTool(hero) !== hero.heroPendingToolStrike) {
    cancelHeroPowerCharge(hero)
    return false
  }
  const sprintMultiplier = sprintChargeMultipliers.get(hero) ?? 1
  const sprite = hero.sprite
  clearHeroPowerCharge(hero)
  if (sprite) {
    sprite.onComplete = undefined
    sprite.onFrameChange = undefined
    sprite.loop = true
  }
  hero.actionLocked = false
  const options = {
    damageMultiplier: getHeroSwordChargeDamageMultiplier(power) * sprintMultiplier,
    impactFrame: SLASH_IMPACT_FRAME,
    swordChargePower: power,
  }
  hero.degree = getHeroAimDegree(hero, destination)
  const result = isTool ? triggerInteractMeleeAt(hero, options) : null
  const triggered = isTool
    ? result === 'triggered' || (result === 'miss' && playEmptyHandWhiff(hero, options))
    : triggerSwordAttackAt(hero, destination, options)
  if (!triggered) finishHeroToolAnimation(hero)
  return triggered
}

function finishHeroPowerChargeShot(hero: UnitEntity): void {
  const destination = hero.heroPowerChargeDestination
  if (!destination) {
    cancelHeroPowerCharge(hero)
    return
  }
  const power = hero.heroPowerReleasePower ?? getHeroPowerChargeRatio(hero)
  const tool = hero.heroPowerChargeTool ?? 'bow'
  if (tool === 'bow' && isEquipmentBroken(hero.inventory?.activeWeapons?.ranged)) {
    cancelHeroPowerCharge(hero)
    return
  }
  const target = hero.heroPowerChargeTarget ?? (tool === 'bow' ? (findBowHuntTarget(hero) ?? undefined) : undefined)
  clearHeroPowerCharge(hero)
  const sprite = hero.sprite
  if (!launchHeroPowerChargeShot(hero, tool, destination, target, power)) return
  playHeroPowerChargeShotRelease(hero, sprite, tool)
}

export function beginHeroPowerChargeAt(
  hero: UnitEntity,
  destination: Point,
  target?: RuntimeEntity | null,
  tool: HeroPowerChargeTool = 'bow'
): boolean {
  const sprite = hero.sprite
  if (!sprite || hero.actionLocked || hero.isDead || hero.isDestroyed) return false
  if (!hasEnergyToStartPowerCharge(hero)) return false
  sprintChargeMultipliers.set(hero, tool === 'sword' || tool === 'tool' ? takeSprintAttackMultiplier(hero) : 1)
  hero.actionLocked = true
  const now = performance.now()
  hero.heroPowerChargeStart = now
  hero.heroPowerChargeRatio = 0
  hero.heroPowerChargeLastEnergyAt = now
  hero.heroPowerChargeDestination = destination
  hero.heroPowerChargeTarget = target ?? null
  hero.heroPowerChargeTool = tool
  if (tool === 'tool') hero.heroPendingToolStrike = getEquippedWorkTool(hero) ?? undefined
  hero.heroPowerReleaseQueued = false
  hero.heroPowerReleasePower = undefined
  hero.heroPowerChargeFacingDegree = hero.mountedOnHorse ? (hero.degree ?? null) : null
  hero.heroPowerChargeVisualLocked = false
  sprite.onComplete = undefined
  sprite.onFrameChange = undefined
  hero.syncShadow?.()
  hero.drawHeroPowerBar?.(0)
  if (tool === 'sword' || tool === 'tool') {
    sprite.loop = true
    return true
  }
  hero.setTextures?.(SHEET_TYPES.action)
  sprite.loop = false
  hero.syncAppearanceLayers?.(SHEET_TYPES.action)
  const holdFrame = getHeroPowerChargeHoldFrame(tool)
  onSpriteLoopAtFrame(sprite, holdFrame, () => freezeHeroPowerChargeFrame(hero))
  return true
}

export function releaseHeroPowerCharge(hero: UnitEntity, now = performance.now()): boolean {
  if (hero.isDead || hero.isDestroyed) {
    cancelHeroPowerCharge(hero)
    return false
  }
  if (hero.heroPowerChargeStart == null || hero.heroPowerReleaseQueued) return false
  drainHeroPowerChargeEnergy(hero, now)
  hero.heroPowerReleasePower = getHeroPowerChargeRatio(hero, now)
  hero.heroPowerChargeRatio = hero.heroPowerReleasePower
  hero.drawHeroPowerBar?.(hero.heroPowerReleasePower)
  if (hero.heroPowerChargeTool === 'sword' || hero.heroPowerChargeTool === 'tool') {
    const destination = hero.heroPowerChargeDestination
    if (!destination) {
      cancelHeroPowerCharge(hero)
      return false
    }
    return finishHeroMeleeChargeAttack(hero, destination, hero.heroPowerReleasePower)
  }
  const sprite = hero.sprite
  const releaseFrame = getHeroShootReleaseFrame(hero.heroPowerChargeTool)
  hero.heroPowerReleaseQueued = true
  if (sprite && hero.currentSheet === SHEET_TYPES.action && sprite.currentFrame < releaseFrame) {
    sprite.loop = false
    sprite.onComplete = undefined
    onSpriteLoopAtFrame(sprite, releaseFrame, () => finishHeroPowerChargeShot(hero))
    if (!sprite.playing) sprite.play()
    return true
  }
  finishHeroPowerChargeShot(hero)
  return true
}
