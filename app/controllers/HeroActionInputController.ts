import { SHEET_TYPES } from '../constants'
import {
  beginHeroDefense,
  cancelHeroActiveToolAction,
  cancelHeroLasso,
  canHeroDefendWithTool,
  isHeroPowerChargeActiveForTool,
  isMountedAttackAimBlocked,
  releaseHeroDefense,
  releaseHeroPowerCharge,
  triggerToolAttackAt,
  type HeroEquippedItem,
} from '../lib/hero/heroTools'
import type { ControlsLike } from '../types/context'
import type { UnitEntity } from '../types/entities'
import type { HeroAimPoint } from './HeroControllerSupport'

type HeroActionInputHost = {
  controls: ControlsLike
  equippedItem: HeroEquippedItem | null
  defenseHeld: boolean
  heroUnit: UnitEntity | null
  interactInputOwner: 'mouse' | 'movement' | null
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
    if (hero.actionLocked && !hero.heroDefenseActive) return false
    if (hero.heroDefenseActive) cancelHeroActiveToolAction(hero)
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
    if (this.host.equippedItem === 'interact') this.host.interactInputOwner = 'mouse'
    this.host.primaryClickPoint =
      this.host.getShiftMoveLockedAimPoint() ?? this.host.controls.getWorldPointUnderCursor()
    const triggered = this.attackTowardPoint(this.host.primaryClickPoint)
    this.host.mouseHeld = triggered
    if (!this.host.mouseHeld) this.host.primaryClickPoint = null
  }

  handleDefenseKeyDown(): void {
    const wasHeld = this.host.defenseHeld
    this.host.defenseHeld = true
    if (!canHeroDefendWithTool(this.host.equippedItem)) return
    const unit = this.host.heroUnit
    if (!unit) return
    if (!wasHeld) unit.heroDefenseEnergyExhausted = false
    if (unit.actionLocked && !unit.heroDefenseActive) {
      cancelHeroActiveToolAction(unit)
    }
    this.host.facePoint(this.host.getShiftMoveLockedAimPoint() ?? this.host.controls.getWorldPointUnderCursor())
    if (beginHeroDefense(unit, this.host.equippedItem)) {
      this.host.mouseHeld = true
    }
  }

  handleDefenseKeyUp(): void {
    this.host.defenseHeld = false
    if (this.host.heroUnit) this.host.heroUnit.heroDefenseEnergyExhausted = false
    this.releaseDefense()
  }

  handleSecondaryPointerDown(): void {
    this.host.defenseHeld = true
    this.handleDefenseKeyDown()
  }

  private releaseDefense(): void {
    const unit = this.host.heroUnit
    if (unit && releaseHeroDefense(unit)) {
      this.host.mouseHeld = false
    }
  }

  handlePointerUp(button = 0): void {
    const unit = this.host.heroUnit
    if (button === 2) {
      this.host.defenseHeld = false
      this.releaseDefense()
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
    this.host.interactInputOwner = null
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
