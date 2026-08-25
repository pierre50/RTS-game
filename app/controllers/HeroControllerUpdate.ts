import {
  HERO_ACTION_MOVE_SPEED_FACTOR,
  HERO_STEALTH_SPEED_FACTOR,
  SHEET_TYPES,
  STEP_TIME,
} from '../constants'
import {
  aimHeroDefenseAt,
  aimHeroPowerChargeAt,
  isHeroPowerChargeActiveForTool,
  updateHeroDefense,
  updateHeroPowerCharge,
  type HeroEquippedItem,
} from '../lib/heroTools'
import { updateHeroCursor } from '../lib/heroCursor'
import { resolveHoverTarget, updateNpcFollow } from '../lib/npcInteraction'
import type { ControlBindingAction } from '../lib/settings'
import { updateUnitEnergy } from '../lib/unitEnergy'
import { updateUnitHealthRegen } from '../lib/unitHealth'
import { composeMoveSpeedFactor, getUnitWalkSpeedFactor, isUnitWalkSpeedFactor } from '../lib/unitLocomotion'
import { applyUnitWalkingAnimationSpeed } from '../lib/unitWalkingAnimation'
import type { ControlsLike } from '../types/context'
import type { UnitEntity } from '../types/entities'
import {
  TARGET_FRAME_MS,
  debugHeroMove,
  getKeyboardMoveVector,
  getLockedMoveSpeedFactor,
  getVectorFromDegree,
  isHeroDirectionLockActive,
  type HeroAimPoint,
} from './HeroControllerSupport'

export type HeroControllerUpdateHost = {
  controls: ControlsLike
  commCharging: boolean
  equippedItem: HeroEquippedItem | null
  heroUnit: UnitEntity | null
  keysPressed: Set<ControlBindingAction>
  mouseHeld: boolean
  pendingGoToNpcs: UnitEntity[] | null
  primaryClickPoint: HeroAimPoint | null
  shiftMoveLockedDegree: number | null
  wasMoving: boolean
  attackTowardPoint(point: HeroAimPoint): boolean
  getShiftMoveLockedAimPoint(): HeroAimPoint | null
  updateCommIndicator(): void
  updateCriticalHealthEffects(elapsedMs: number, active?: boolean): void
  updateOcclusionFade(elapsedMs: number, active?: boolean): void
}

export function updateHeroControllerRuntime(controller: HeroControllerUpdateHost, frameScale: number): void {
  const unit = controller.heroUnit
  if (!unit) return
  updateUnitEnergy(unit, TARGET_FRAME_MS * frameScale)
  updateUnitHealthRegen(unit, TARGET_FRAME_MS * frameScale)
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
  const hoverTarget = resolveHoverTarget(
    unit,
    controller.controls.getWorldPointUnderCursor(),
    controller.controls.getCellUnderCursor()
  )
  updateHeroCursor(controller.equippedItem, hoverTarget, Boolean(controller.pendingGoToNpcs))
  const attacking = Boolean(unit.actionLocked)
  if (
    controller.mouseHeld &&
    controller.primaryClickPoint &&
    !attacking &&
    controller.equippedItem !== 'bow' &&
    controller.equippedItem !== 'lasso' &&
    controller.equippedItem !== 'sword'
  ) {
    const nextPoint = controller.getShiftMoveLockedAimPoint() ?? aimPoint
    controller.primaryClickPoint = nextPoint
    if (!controller.attackTowardPoint(nextPoint)) {
      controller.mouseHeld = false
      controller.primaryClickPoint = null
    }
  }

  const keyboardMove = getKeyboardMoveVector(controller.keysPressed)
  let { dx, dy } = keyboardMove
  const gamepadMove = controller.controls.getGamepadMoveVector()
  dx += gamepadMove.dx
  dy += gamepadMove.dy
  const isMoving = dx !== 0 || dy !== 0
  const walkSpeedFactor = getUnitWalkSpeedFactor(Boolean(controller.controls.shiftKeyActive))
  updateNpcFollow(unit, { matchHeroWalk: isMoving && isUnitWalkSpeedFactor(walkSpeedFactor) })
  const lockedMove = Boolean(isHeroDirectionLockActive(controller.controls) && isMoving && !unit.mountedOnHorse)
  if (lockedMove && controller.shiftMoveLockedDegree == null) {
    controller.shiftMoveLockedDegree = unit.degree ?? 0
  } else if (!lockedMove) {
    controller.shiftMoveLockedDegree = null
  }
  const lockedDegree = controller.shiftMoveLockedDegree
  if (unit.isDirectMoving !== isMoving) {
    unit.isDirectMoving = isMoving
    unit.syncMountedHorseSprite?.()
  }

  let moved = false
  let moveAnimationSpeedFactor = 1
  if (isMoving) {
    const len = Math.hypot(dx, dy)
    const lockedFacingVector =
      lockedMove && lockedDegree != null && !attacking ? getVectorFromDegree(lockedDegree) : null
    const speedFactor = attacking && !unit.mountedOnHorse ? HERO_ACTION_MOVE_SPEED_FACTOR : 1
    const stealthSpeedFactor = controller.controls.isHeroStealthMode?.() ? HERO_STEALTH_SPEED_FACTOR : 1
    const directionalMoveSpeedFactor = lockedFacingVector ? getLockedMoveSpeedFactor({ dx, dy }, lockedFacingVector) : 1
    const moveSpeedFactor = composeMoveSpeedFactor(walkSpeedFactor, directionalMoveSpeedFactor)
    moveAnimationSpeedFactor = moveSpeedFactor
    const distance =
      (unit.speed ?? 0) *
      speedFactor *
      stealthSpeedFactor *
      moveSpeedFactor *
      (TARGET_FRAME_MS / STEP_TIME) *
      frameScale
    const before = { x: unit.x, y: unit.y, i: unit.i, j: unit.j }
    const aimedDegree = powerChargeAiming || defenseAiming ? unit.degree : null
    const aimedFacingVector = aimedDegree != null ? getVectorFromDegree(aimedDegree) : null
    const moveFacingVector = aimedFacingVector ?? lockedFacingVector
    const moveOptions = moveFacingVector ? { facingDirX: moveFacingVector.dx, facingDirY: moveFacingVector.dy } : undefined
    moved = unit.moveDirect?.(dx / len, dy / len, distance, moveOptions) ?? false
    if (aimedDegree != null && unit.degree !== aimedDegree) {
      unit.degree = aimedDegree
      if (unit.mountedOnHorse) unit.syncMountedRiderPosition?.()
    }
    const delta = Math.hypot(unit.x - before.x, unit.y - before.y)
    if (!moved || delta < 0.01) {
      debugHeroMove(moved ? 'moveDirect-returned-true-without-position-change' : 'moveDirect-returned-false', unit, {
        keys: [...controller.keysPressed],
        input: { dx, dy, len },
        normalized: { dx: dx / len, dy: dy / len },
        distance,
        frameScale,
        speedFactor,
        stealthSpeedFactor,
        walkSpeedFactor,
        directionalMoveSpeedFactor,
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
    if (!attacking && unit.currentSheet !== SHEET_TYPES.walking) unit.setTextures?.(SHEET_TYPES.walking)
    if (!attacking) applyUnitWalkingAnimationSpeed(unit, moveAnimationSpeedFactor)
    if (!attacking && !unit.sprite?.playing) unit.sprite?.play?.()
    controller.wasMoving = true
  } else if (controller.wasMoving) {
    controller.wasMoving = false
    if (!attacking) {
      unit.setTextures?.(SHEET_TYPES.standing)
      unit.sprite?.stop?.()
    }
  }
}
