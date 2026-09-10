import { MENU_INFO_IDS, MINING_RESOURCE_CONFIG, SHEET_TYPES, SOUND_CUES } from '../../constants'
import { onSpriteLoopAtFrame, playAudibleSoundCue, showResourceGainFeedback, SLASH_IMPACT_FRAME } from '../../lib'
import { canReachActionTarget, getActionContactTool, isActionTouchingTarget } from '../../lib/actions/contactActions'
import { showContactDebug } from '../../lib/contact/contactDebug'
import { getContactAimDegree } from '../../lib/contact/contactGeometry'
import { spawnWorkImpactFragments } from '../../lib/entities/workImpactFragments'
import { canHeroStrikeLockedMine, showIronMiningBlockedMessage } from '../../lib/resources/ironMining'
import { isHeroControlled } from '../../lib/units/unitControl'
import { spendOrWaitForEnergy } from '../../lib/units/unitEnergy'
import { grantUnitXp, LOADING_XP_CATEGORY } from '../../lib/units/unitExperience'
import type { CommandSound, RuntimeEntity, UnitEntity } from '../../types/entities'
import { handleBuildAction as runBuildAction } from './work/UnitBuildingAction'
import { handleFarmAction as runFarmAction } from './work/UnitFarmingAction'
import { logGatherVisualState } from './UnitGatherVisualDebug'
import { lockManualHeroAction, restartManualHeroActionAnimation, stopManualHeroAction } from './UnitManualHeroWork'
import {
  addGatheredResource,
  getCarriedResourceAmountForLoadingType,
  getGatherAmount,
  isRuntimeEntity,
  sendVillagerToDeliveryIfFull,
  shouldReleaseGatheredResource,
  showDepletedBerrybushMessage,
  startForageResourceAction,
} from './UnitResourceGathering'
import { handleChopWoodAction as runChopWoodAction } from './work/UnitWoodcuttingAction'
import { finishWorkSwing, getWorkAnimationReleaseFrame } from './work/UnitWorkSwing'

export class UnitResourceActions {
  unit: UnitEntity
  private lastLockedMine: RuntimeEntity | null = null

  constructor(unit: UnitEntity) {
    this.unit = unit
  }

  playSound(soundId: CommandSound) {
    if (!soundId) return
    playAudibleSoundCue(this.unit, soundId, { profile: 'work' })
  }

  getWorkSound(key: string, fallback: CommandSound = null): CommandSound {
    return this.unit.sounds?.work?.[key] ?? fallback
  }

  ensureWorkContact(target: RuntimeEntity | null, preparing = false): boolean {
    const unit = this.unit
    if (target && !preparing) showContactDebug(unit, [target], getActionContactTool(unit, unit.action))
    if (
      target &&
      (preparing ? canReachActionTarget(unit, target, unit.action) : isActionTouchingTarget(unit, target, unit.action))
    ) {
      if (preparing) unit.degree = getContactAimDegree(unit, target)
      return true
    }
    // A missed tool stroke must never advance gathering progress or emit resources.
    if (unit.sprite) delete unit.sprite.onFrameChange
    unit.actionLocked = false
    if (isHeroControlled(unit)) stopManualHeroAction(unit)
    else if (target) unit.sendToEvt?.(target, unit.action ?? null, { forceRepath: true })
    else unit.affectNewDest?.()
    return false
  }

  bindWorkImpact(frame: number, impact: () => void): void {
    const unit = this.unit
    if (!unit.sprite) return
    const target = unit.dest
    const action = unit.action
    onSpriteLoopAtFrame(unit.sprite, frame, () => {
      if (unit.isDead || unit.isDestroyed || unit.dest !== target || unit.action !== action) return
      impact()
    })
  }

  prepareLoopingWorkAction(): boolean {
    const unit = this.unit
    if (
      !unit.getActionCondition?.(unit.dest) &&
      !canHeroStrikeLockedMine(unit, isRuntimeEntity(unit.dest) ? unit.dest : null)
    ) {
      unit.affectNewDest?.()
      return false
    }
    if (!this.ensureWorkContact(isRuntimeEntity(unit.dest) ? unit.dest : null, true)) return false
    unit.setTextures?.(SHEET_TYPES.action)
    if (!unit.sprite) return false
    restartManualHeroActionAnimation(unit)
    lockManualHeroAction(unit)
    return true
  }

  startMiningResource(action: string | null | undefined): void {
    const config = Object.values(MINING_RESOURCE_CONFIG ?? {}).find(entry => entry.action === action)
    if (!config) return
    const unit = this.unit
    const target = isRuntimeEntity(unit.dest) ? unit.dest : null
    if (target && canHeroStrikeLockedMine(unit, target, action)) {
      if (!this.prepareLoopingWorkAction()) return
      const frame = getWorkAnimationReleaseFrame(unit, SLASH_IMPACT_FRAME)
      this.bindWorkImpact(frame, () => {
        if (!canHeroStrikeLockedMine(unit, target, action)) {
          stopManualHeroAction(unit)
          return
        }
        if (!this.ensureWorkContact(target)) return
        if (!spendOrWaitForEnergy(unit, action, target)) {
          stopManualHeroAction(unit)
          return
        }
        if (this.lastLockedMine !== target) {
          showIronMiningBlockedMessage(unit, target)
          this.lastLockedMine = target
        }
        this.playSound(this.getWorkSound(config.sound, SOUND_CUES.villager.mineOre))
        finishWorkSwing(unit, frame, frame)
      })
      return
    }
    this.lastLockedMine = null
    this.startGathering(config.loadingType, this.getWorkSound(config.sound, SOUND_CUES.villager.mineOre), {
      dieOnEmpty: Boolean(config.dieOnEmpty),
      onImpact: target => spawnWorkImpactFragments(this.unit, target),
    })
  }

  startGathering(
    loadingType: string,
    soundId: CommandSound,
    {
      dieOnEmpty = false,
      checkOwner = false,
      updateTexture = false,
      releaseFrame = SLASH_IMPACT_FRAME,
      gatherEvery,
      onImpact,
      onRelease,
      onGathered,
      onDepleted,
    }: {
      dieOnEmpty?: boolean
      checkOwner?: boolean
      updateTexture?: boolean
      releaseFrame?: number
      gatherEvery?: number
      onImpact?: (target: RuntimeEntity) => void
      onRelease?: () => void
      onGathered?: (target: RuntimeEntity, gain: number) => void
      onDepleted?: (target: RuntimeEntity) => void
    } = {}
  ) {
    const unit = this.unit
    const menu = unit.context?.menu
    if (!unit.getActionCondition?.(unit.dest)) {
      showIronMiningBlockedMessage(unit, isRuntimeEntity(unit.dest) ? unit.dest : null)
      showDepletedBerrybushMessage(unit, isRuntimeEntity(unit.dest) ? unit.dest : null)
      unit.affectNewDest?.()
      return
    }
    if (!this.prepareLoopingWorkAction() || !unit.sprite) return
    const workTickFrame = getWorkAnimationReleaseFrame(unit, releaseFrame)
    const releaseGatheredResources = (dest: RuntimeEntity, requestedGain: number) => {
      onRelease?.()
      onImpact?.(dest)
      if (!shouldReleaseGatheredResource(unit, dest, loadingType, gatherEvery)) {
        this.playSound(soundId)
        finishWorkSwing(unit, workTickFrame, workTickFrame)
        return
      }
      const previousAmount = getCarriedResourceAmountForLoadingType(unit, loadingType)
      const gain = addGatheredResource(unit, loadingType, requestedGain)
      if (gain <= 0) {
        unit.gatherProgressState = null
        if (!isHeroControlled(unit)) unit.sendToDelivery?.()
        else stopManualHeroAction(unit)
        return
      }
      grantUnitXp(unit, LOADING_XP_CATEGORY[loadingType], gain)
      onGathered?.(dest, gain)
      this.playSound(soundId)
      if (updateTexture) dest.updateTexture?.()
      dest.quantity = Math.max((dest.quantity ?? 0) - gain, 0)
      logGatherVisualState(unit, dest, loadingType, gain)
      showResourceGainFeedback(unit, gain)
      if (dest.selected && (!checkOwner || unit.owner?.isPlayed)) {
        menu?.updateInfo?.(MENU_INFO_IDS.quantityText, dest.quantity)
      }
      if ((dest.quantity ?? 0) <= 0) {
        if (dieOnEmpty) dest.die?.()
        onDepleted?.(dest)
        unit.affectNewDest?.()
      } else if (sendVillagerToDeliveryIfFull(unit, loadingType, previousAmount)) {
        unit.gatherProgressState = null
      }
      finishWorkSwing(unit, workTickFrame, workTickFrame)
    }
    this.bindWorkImpact(workTickFrame, () => {
      this.gatherImpact(dieOnEmpty, releaseGatheredResources)
    })
  }

  private gatherImpact(dieOnEmpty: boolean, release: (dest: RuntimeEntity, gain: number) => void): void {
    const unit = this.unit
    const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
    if (!unit.getActionCondition?.(dest)) {
      unit.gatherProgressState = null
      showIronMiningBlockedMessage(unit, dest)
      if (dieOnEmpty && dest && (dest.quantity ?? 0) <= 0) {
        dest.die?.()
      }
      showDepletedBerrybushMessage(unit, dest)
      unit.affectNewDest?.()
      return
    }
    const requestedGain = getGatherAmount(unit)
    if (!dest || requestedGain <= 0) {
      unit.gatherProgressState = null
      if (isHeroControlled(unit)) stopManualHeroAction(unit)
      return
    }
    if (!this.ensureWorkContact(dest)) return
    if (!spendOrWaitForEnergy(unit, unit.action, dest)) {
      if (isHeroControlled(unit)) stopManualHeroAction(unit)
      return
    }
    release(dest, requestedGain)
  }

  handleForageBerryAction() {
    startForageResourceAction(this)
  }

  handleFarmAction() {
    return runFarmAction(this)
  }

  handleChopWoodAction() {
    return runChopWoodAction(this)
  }

  handleBuildAction() {
    return runBuildAction(this)
  }

  handleDeliveryAction() {
    if (!this.unit.context) return
    const unit = this.unit
    void import('../../screens/game/GameResourceDelivery').then(({ handleResourceDeliveryAction }) => {
      if (!unit.context) return
      handleResourceDeliveryAction(unit.context, unit)
    })
  }
}
