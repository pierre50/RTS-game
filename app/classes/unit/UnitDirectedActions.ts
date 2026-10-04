import { getContactAimDegree } from '../../lib/contact/contactGeometry'
import { isActionTouchingTarget } from '../../lib/actions/contactActions'
import { takeAnimalLootForDelivery } from '../../lib/equipment/animalCorpseLoot'
import { ACTION_TYPES, FAMILY_TYPES, SHEET_TYPES, SOUND_CUES } from '../../constants'
import {
  SLASH_IMPACT_FRAME,
  onSpriteLoopAtFrame,
  showHealingFeedback,
  syncMovedActionTarget,
  showResourceGainFeedback,
} from '../../lib'
import { syncEntityHealthDisplay } from '../../lib/entities/entityHealthDisplay'
import { getHealingXpBonus, grantUnitXp, XP_CATEGORIES } from '../../lib/units/unitExperience'
import { isHeroControlled } from '../../lib/units/unitControl'
import { isUnitVisualAnimationCurrent, setUnitVisualSheet } from '../../lib/units/visuals/unitVisualTransition'
import { spendOrWaitForEnergy } from '../../lib/units/unitEnergy'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { CommandSound } from '../../types/entities'
import { stopManualHeroAction } from './UnitManualHeroWork'
import { handleUnitHuntAction } from './work/UnitHuntAction'

function isRuntimeEntity(value: UnitEntity['dest'] | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

function isBuildingEntity(value: UnitEntity['dest'] | null | undefined): value is BuildingEntity {
  return isRuntimeEntity(value) && value.family === FAMILY_TYPES.building
}

export class UnitDirectedActions {
  unit: UnitEntity
  playSound: (soundId: CommandSound) => void

  constructor(unit: UnitEntity, playSound: (soundId: CommandSound) => void) {
    this.unit = unit
    this.playSound = playSound
  }

  handleTrainAction(): void {
    const unit = this.unit
    const dest = isBuildingEntity(unit.dest) ? unit.dest : null
    const trainingType = unit.trainingTargetType ?? ''
    if (!trainingType || !dest || !unit.getActionCondition?.(dest, ACTION_TYPES.train, { trainingType })) {
      unit.trainingTargetType = null
      unit.stop?.()
      return
    }
    if (unit.isUnitAtDest && !unit.isUnitAtDest(ACTION_TYPES.train, dest)) {
      unit.sendToEvt?.(dest, ACTION_TYPES.train, { forceRepath: true, allowPassageStop: true })
      return
    }
    if (dest?.startTrainingWithUnit?.(unit)) {
      unit.trainingRetryTaskId = null
      return
    }
    {
      const buildingBusy = Boolean(dest && (dest.loading != null || dest.queue?.length || dest.trainingUnit))
      if (buildingBusy) {
        unit.path = []
        unit.setTextures?.(SHEET_TYPES.standing)
        unit.sprite?.stop?.()
        return
      }
      unit.trainingTargetType = null
      unit.stop?.()
    }
  }

  handleHealAction(): void {
    const unit = this.unit
    const menu = unit.context?.menu
    const player = unit.owner
    const sprite = unit.sprite
    if (!sprite) return
    if (!unit.getActionCondition?.(unit.dest)) {
      unit.affectNewDest?.()
      return
    }
    unit.setTextures?.(SHEET_TYPES.action)
    let feedbackTarget: RuntimeEntity | null = null
    sprite.onLoop = () => {
      const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
      if (!unit.getActionCondition?.(dest)) {
        unit.affectNewDest?.()
        return
      }
      syncMovedActionTarget(unit, dest)
      if (!unit.isUnitAtDest?.(unit.action, dest)) {
        unit.sendToEvt?.(dest ?? null, ACTION_TYPES.heal, { forceRepath: true })
        return
      }
      if (dest && (dest.hitPoints ?? 0) < (dest.totalHitPoints ?? 0)) {
        if (this.healTarget(dest, feedbackTarget !== dest, { menu, player })) feedbackTarget = dest
      }
    }
  }

  private healTarget(
    dest: RuntimeEntity,
    allowFeedback: boolean,
    display: Parameters<typeof syncEntityHealthDisplay>[1]
  ): boolean {
    const unit = this.unit
    if (!spendOrWaitForEnergy(unit, unit.action, dest)) return false
    this.playSound(unit.sounds?.heal)
    const beforeHitPoints = dest.hitPoints ?? 0
    dest.hitPoints = Math.min(beforeHitPoints + (unit.healing ?? 0) + getHealingXpBonus(unit), dest.totalHitPoints ?? 0)
    const healedAmount = (dest.hitPoints ?? 0) - beforeHitPoints
    const showFeedback = healedAmount > 0 && allowFeedback
    if (showFeedback) showHealingFeedback(dest)
    grantUnitXp(unit, XP_CATEGORIES.healing, healedAmount)
    if (dest.selected || dest.shouldKeepHealthBarVisible?.()) {
      syncEntityHealthDisplay(dest, display)
    }
    return showFeedback
  }

  handleHuntAction(): void {
    handleUnitHuntAction(this.unit)
  }

  getWorkSound(key: string, fallback: CommandSound = null): CommandSound {
    return this.unit.sounds?.work?.[key] ?? fallback
  }

  takeAnimalLoot(): void {
    const unit = this.unit
    if (unit.isDead || unit.isDestroyed || unit.action !== ACTION_TYPES.takemeat) return
    const target = isRuntimeEntity(unit.dest) ? unit.dest : null
    if (isHeroControlled(unit)) {
      stopManualHeroAction(unit)
      return
    }
    if (!target || !unit.getActionCondition?.(target)) {
      unit.affectNewDest?.()
      return
    }
    unit.degree = getContactAimDegree(unit, target)
    if (
      !unit.isUnitAtDest?.(ACTION_TYPES.takemeat, target) ||
      !isActionTouchingTarget(unit, target, ACTION_TYPES.takemeat)
    ) {
      unit.sendToEvt?.(target, ACTION_TYPES.takemeat, { forceRepath: true, preserveAutonomy: true })
      return
    }
    this.animateAnimalLoot(target)
  }

  private animateAnimalLoot(target: RuntimeEntity): void {
    const unit = this.unit
    const sprite = unit.sprite
    if (!sprite) return
    const token = setUnitVisualSheet(unit, SHEET_TYPES.harvest, { frame: 0, loop: false, play: 'play' })
    const isCurrent = () =>
      isUnitVisualAnimationCurrent(unit, token) &&
      !unit.isDead &&
      !unit.isDestroyed &&
      unit.dest === target &&
      unit.action === ACTION_TYPES.takemeat
    let harvested = false
    onSpriteLoopAtFrame(sprite, SLASH_IMPACT_FRAME, () => {
      if (!isCurrent() || harvested) return
      harvested = true
      if (
        !unit.getActionCondition?.(target) ||
        !unit.isUnitAtDest?.(ACTION_TYPES.takemeat, target) ||
        !isActionTouchingTarget(unit, target, ACTION_TYPES.takemeat)
      )
        return
      const moved = takeAnimalLootForDelivery(target, unit)
      if (moved > 0) {
        this.playSound(this.getWorkSound('takeMeat', SOUND_CUES.villager.takeMeat))
        showResourceGainFeedback(unit, moved)
      }
    })
    sprite.onComplete = () => {
      if (!isCurrent()) return
      // Clear the finished swing before delivery or autonomy selects the next action.
      setUnitVisualSheet(unit, SHEET_TYPES.standing, { frame: 0, loop: true, play: 'stop' })
      if (!unit.sendToDelivery?.()) unit.stop?.()
    }
  }
}
