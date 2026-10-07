import { getSprintMoveFactor, recordSprintMovement, stopUnitSprint } from '../lib/units/movement/unitSprint'
import {
  HERO_ACTION_MOVE_SPEED_FACTOR,
  HERO_STEALTH_SPEED_FACTOR,
  HERO_MELEE_CHARGE_MOVE_SPEED_FACTOR,
  SHEET_TYPES,
  STEP_TIME,
} from '../constants'
import {
  aimHeroDefenseAt,
  aimHeroPowerChargeAt,
  beginHeroDefense,
  canHeroDefendWithTool,
  isHeroPowerChargeActiveForTool,
  updateHeroDefense,
  updateHeroPowerCharge,
  type HeroEquippedItem,
} from '../lib/hero/heroTools'
import { applyUnitCrouchPose } from '../lib/units/visuals/unitCrouchPose'
import { updateNpcFollow } from '../lib/npc/npcInteraction'
import type { ControlBindingAction } from '../lib/audio/settings'
import { getEnergyMoveSpeedMultiplier, updateUnitEnergy } from '../lib/units/unitEnergy'
import {
  composeMoveSpeedFactor,
  getUnitWalkSpeedFactor,
  isUnitWalkSpeedFactor,
} from '../lib/units/movement/unitLocomotion'
import { applyUnitWalkingAnimationSpeed } from '../lib/units/visuals/unitWalkingAnimation'
import type { ControlsLike } from '../types/context'
import type { UnitEntity } from '../types/entities'
import {
  TARGET_FRAME_MS,
  debugHeroMove,
  getKeyboardMoveVector,
  getVectorFromDegree,
  type HeroAimPoint,
} from './HeroControllerSupport'

export type HeroControllerUpdateHost = {
  controls: ControlsLike
  commCharging: boolean
  defenseHeld: boolean
  equippedItem: HeroEquippedItem | null
  heroUnit: UnitEntity | null
  interactInputOwner: 'mouse' | 'movement' | null
  keysPressed: Set<ControlBindingAction>
  mouseHeld: boolean
  pendingGoToNpcs: UnitEntity[] | null
  primaryClickPoint: HeroAimPoint | null
  wasMoving: boolean
  attackTowardPoint(point: HeroAimPoint): boolean
  facePoint(point: HeroAimPoint): void
  updateProximityInteractionPrompt(): void
  updateCommIndicator(): void
  updateCriticalHealthEffects(elapsedMs: number, active?: boolean): void
  updateOcclusionFade(elapsedMs: number, active?: boolean): void
}

function getHeroActionMoveSpeedFactor(unit: UnitEntity): number {
  if (isHeroMeleeChargeAiming(unit)) {
    return HERO_MELEE_CHARGE_MOVE_SPEED_FACTOR
  }
  return HERO_ACTION_MOVE_SPEED_FACTOR
}

function isHeroMeleeChargeAiming(unit: UnitEntity): boolean {
  return unit.heroPowerChargeStart != null && unit.heroPowerChargeTool === 'sword' && !unit.heroPowerReleaseQueued
}

function syncHeroLocomotionVisual(unit: UnitEntity, moving: boolean, animationSpeedFactor: number): void {
  if (moving) {
    if (unit.currentSheet !== SHEET_TYPES.walking) unit.setTextures?.(SHEET_TYPES.walking)
    if (unit.sprite) {
      unit.sprite.loop = true
    }
    applyUnitWalkingAnimationSpeed(unit, animationSpeedFactor)
    if (!unit.sprite?.playing) unit.sprite?.play?.()
    return
  }
  if (unit.currentSheet !== SHEET_TYPES.standing) unit.setTextures?.(SHEET_TYPES.standing)
  unit.sprite?.stop?.()
}

export function updateHeroControllerRuntime(controller: HeroControllerUpdateHost, frameScale: number): void {
  const unit = controller.heroUnit
  if (!unit) return
  if (unit.isDead || unit.isDestroyed) {
    stopUnitSprint(unit)
    if (unit.isDirectMoving) {
      unit.isDirectMoving = false
      unit.syncMountedHorseSprite?.()
    }
    controller.wasMoving = false
    controller.mouseHeld = false
    controller.defenseHeld = false
    controller.primaryClickPoint = null
    controller.interactInputOwner = null
    return
  }
  updateUnitEnergy(unit, TARGET_FRAME_MS * frameScale)
  controller.updateCriticalHealthEffects(TARGET_FRAME_MS * frameScale, !controller.controls.context.paused)
  controller.updateOcclusionFade(TARGET_FRAME_MS * frameScale, !controller.controls.context.paused)
  controller.controls.context.menu?.updateHeroStatus?.(unit)
  if (controller.commCharging) controller.updateCommIndicator()
  const aimPoint = controller.controls.getWorldPointUnderCursor()
  const powerChargeAiming = isHeroPowerChargeActiveForTool(unit, controller.equippedItem)
    ? aimHeroPowerChargeAt(unit, aimPoint)
    : false
  const defenseAiming = aimHeroDefenseAt(unit, aimPoint)
  updateHeroPowerCharge(unit)
  updateHeroDefense(unit)
  controller.updateProximityInteractionPrompt()
  let attacking = Boolean(unit.actionLocked)
  if (
    controller.defenseHeld &&
    canHeroDefendWithTool(controller.equippedItem) &&
    !attacking &&
    !unit.heroDefenseActive &&
    !unit.heroDefenseEnergyExhausted
  ) {
    controller.facePoint?.(aimPoint)
    if (beginHeroDefense(unit, controller.equippedItem)) {
      controller.mouseHeld = true
      attacking = Boolean(unit.actionLocked)
    }
  }
  if (
    controller.mouseHeld &&
    controller.primaryClickPoint &&
    !(controller.equippedItem === 'interact' && controller.interactInputOwner === 'movement') &&
    !attacking &&
    controller.equippedItem !== 'bow' &&
    controller.equippedItem !== 'sword'
  ) {
    controller.primaryClickPoint = aimPoint
    if (controller.attackTowardPoint(aimPoint)) {
      attacking = Boolean(unit.actionLocked)
    } else {
      controller.mouseHeld = false
      controller.primaryClickPoint = null
    }
  }

  const keyboardMove = getKeyboardMoveVector(controller.keysPressed)
  const stealthMode = Boolean(controller.controls.isHeroStealthMode?.())
  let { dx, dy } = keyboardMove
  const gamepadMove = controller.controls.getGamepadMoveVector()
  dx += gamepadMove.dx
  dy += gamepadMove.dy
  if (controller.equippedItem === 'interact' && controller.interactInputOwner === 'mouse') {
    dx = 0
    dy = 0
  }
  const isMoving = dx !== 0 || dy !== 0
  const walkSpeedFactor = getUnitWalkSpeedFactor(
    Boolean((stealthMode || controller.controls.shiftKeyActive) && !unit.mountedOnHorse)
  )
  unit.isCrouching = stealthMode
  updateNpcFollow(unit, { matchHeroWalk: isMoving && isUnitWalkSpeedFactor(walkSpeedFactor) })
  if (unit.isDirectMoving !== isMoving) {
    unit.isDirectMoving = isMoving
    unit.syncMountedHorseSprite?.()
  }

  const sprintFactor = getSprintMoveFactor(unit, isMoving && walkSpeedFactor === 1)
  let moved = false
  let moveAnimationSpeedFactor = 1
  if (isMoving) {
    const len = Math.hypot(dx, dy)
    const speedFactor = attacking && !unit.mountedOnHorse ? getHeroActionMoveSpeedFactor(unit) : 1
    const stealthSpeedFactor = stealthMode ? HERO_STEALTH_SPEED_FACTOR : 1
    const moveSpeedFactor = composeMoveSpeedFactor(walkSpeedFactor)
    moveAnimationSpeedFactor = moveSpeedFactor * stealthSpeedFactor * getEnergyMoveSpeedMultiplier(unit) * sprintFactor
    const distance =
      (unit.speed ?? 0) *
      speedFactor *
      sprintFactor *
      stealthSpeedFactor *
      moveSpeedFactor *
      (TARGET_FRAME_MS / STEP_TIME) *
      frameScale
    const before = { x: unit.x, y: unit.y, i: unit.i, j: unit.j }
    const aimedDegree = powerChargeAiming || defenseAiming ? unit.degree : null
    const aimedFacingVector = aimedDegree != null ? getVectorFromDegree(aimedDegree) : null
    const moveOptions = aimedFacingVector
      ? { facingDirX: aimedFacingVector.dx, facingDirY: aimedFacingVector.dy }
      : undefined
    moved = distance > 0 ? (unit.moveDirect?.(dx / len, dy / len, distance, moveOptions) ?? false) : false
    if (aimedDegree != null && unit.degree !== aimedDegree) {
      unit.degree = aimedDegree
      if (unit.mountedOnHorse) unit.syncMountedRiderPosition?.()
    }
    const delta = Math.hypot(unit.x - before.x, unit.y - before.y)
    recordSprintMovement(unit, delta, TARGET_FRAME_MS * frameScale, sprintFactor)
    if (distance > 0 && (!moved || delta < 0.01)) {
      debugHeroMove(moved ? 'moveDirect-returned-true-without-position-change' : 'moveDirect-returned-false', unit, {
        keys: [...controller.keysPressed],
        input: { dx, dy, len },
        normalized: { dx: dx / len, dy: dy / len },
        distance,
        frameScale,
        speedFactor,
        stealthSpeedFactor,
        walkSpeedFactor,
        moveSpeedFactor,
        attacking,
        hasMoveDirect: Boolean(unit.moveDirect),
        before,
        after: { x: unit.x, y: unit.y, i: unit.i, j: unit.j },
        delta,
      })
    }
  }
  if (moved) {
    controller.wasMoving = true
  } else {
    controller.wasMoving = false
  }
  if (!attacking || isHeroMeleeChargeAiming(unit)) {
    syncHeroLocomotionVisual(unit, moved, moved ? moveAnimationSpeedFactor : 1)
  }
  applyUnitCrouchPose(unit, stealthMode)
}
