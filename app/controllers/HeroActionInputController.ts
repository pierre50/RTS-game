import { SHEET_TYPES } from '../constants'
import {
  beginHeroDefense,
  cancelHeroLasso,
  isHeroPowerChargeActiveForTool,
  isMountedAttackAimBlocked,
  releaseHeroDefense,
  releaseHeroPowerCharge,
  triggerToolAttackAt,
  type HeroEquippedItem,
} from '../lib/heroTools'
import type { ControlsLike } from '../types/context'
import type { UnitEntity } from '../types/entities'
import type { HeroAimPoint } from './HeroControllerSupport'

type HeroActionInputHost = {
  controls: ControlsLike
  equippedItem: HeroEquippedItem | null
  heroUnit: UnitEntity | null
  mouseHeld: boolean
  pendingGoToNpcs: UnitEntity[] | null
  primaryClickPoint: HeroAimPoint | null
  facePoint(point: HeroAimPoint): void
  getShiftMoveLockedAimPoint(): HeroAimPoint | null
  resolveGoTo(): void
}

export class HeroActionInputController {
  host: HeroActionInputHost

  constructor(host: HeroActionInputHost) {
    this.host = host
  }

  attackTowardPoint(point: HeroAimPoint): boolean {
    const hero = this.host.heroUnit
    if (!hero) return false
    if (hero.actionLocked) return false
    if (isMountedAttackAimBlocked(hero, point)) return false
    this.host.facePoint(point)
    hero.stop?.()
    return triggerToolAttackAt(hero, this.host.equippedItem, point)
  }

  handlePrimaryPointerDown(): void {
    if (this.host.pendingGoToNpcs) {
      this.host.resolveGoTo()
      return
    }
    if (this.host.equippedItem === 'lasso' && this.host.heroUnit?.heroLasso) {
      cancelHeroLasso(this.host.heroUnit)
      this.host.mouseHeld = false
      this.host.primaryClickPoint = null
      return
    }
    this.host.primaryClickPoint = this.host.getShiftMoveLockedAimPoint() ?? this.host.controls.getWorldPointUnderCursor()
    const triggered = this.attackTowardPoint(this.host.primaryClickPoint)
    this.host.mouseHeld = triggered
    if (!this.host.mouseHeld) this.host.primaryClickPoint = null
  }

  handleDefenseKeyDown(): void {
    const unit = this.host.heroUnit
    if (!unit) return
    this.host.facePoint(this.host.getShiftMoveLockedAimPoint() ?? this.host.controls.getWorldPointUnderCursor())
    if (beginHeroDefense(unit, this.host.equippedItem)) {
      this.host.mouseHeld = true
    }
  }

  handleSecondaryPointerDown(): void {
    this.handleDefenseKeyDown()
  }

  handlePointerUp(button = 0): void {
    const unit = this.host.heroUnit
    if (button === 2) {
      if (unit && releaseHeroDefense(unit)) {
        this.host.mouseHeld = false
      }
      return
    }
    if (button !== 0) return
    if (unit && isHeroPowerChargeActiveForTool(unit, this.host.equippedItem) && releaseHeroPowerCharge(unit)) {
      this.host.mouseHeld = false
      this.host.primaryClickPoint = null
      return
    }
    this.host.mouseHeld = false
    this.host.primaryClickPoint = null
    if (!unit || unit.actionLocked || unit.currentSheet !== SHEET_TYPES.action) return
    const sprite = unit.sprite
    if (!sprite) {
      unit.previousDest = null
      unit.stop?.()
      return
    }
    sprite.onLoop = () => {
      sprite.onLoop = undefined
      unit.previousDest = null
      unit.stop?.()
    }
  }
}
