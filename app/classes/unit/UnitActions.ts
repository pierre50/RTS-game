import {
  ACTION_TYPES,
  FAMILY_TYPES,
  LOADING_TYPES,
  SHEET_TYPES,
  SOUND_CUES,
} from '../../constants'
import {
  onSpriteLoopAtFrame,
  playAudibleSoundCue,
  playerCanSeeInstance,
  BOW_SHOOT_RELEASE_FRAME,
  showHealingFeedback,
  HUNTING_PROJECTILE,
  syncMovedActionTarget,
} from '../../lib'
import { Projectile } from '../Projectile'
import {
  getHealingXpBonus,
  grantUnitXp,
  XP_CATEGORIES,
} from '../../lib/unitExperience'
import { refreshBakedLpcUnitAssets } from '../../lib/lpc'
import { t } from '../../lib/lang'
import { isHeroControlled } from '../../lib/unitControl'
import { spendOrWaitForEnergy } from '../../lib/unitEnergy'
import { syncEntityHealthDisplay } from '../../lib/entityHealthDisplay'
import { handleCaptureHorseAction } from './UnitCaptureHorseAction'
import { UnitResourceActions } from './UnitResourceActions'
import {
  setActionSpriteLoop,
  stopManualHeroAction,
} from './UnitManualHeroWork'
import { UnitConversionAction } from './UnitConversionAction'
import {
  clearInvalidPreviousTask as clearInvalidPreviousUnitTask,
  goBackToPrevious as goBackToPreviousUnitWork,
  restorePreviousWork as restoreUnitPreviousWork,
} from './UnitPreviousWork'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { CommandSound } from '../../types/entities'

function isRuntimeEntity(value: UnitEntity['dest'] | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

function isBuildingEntity(value: UnitEntity['dest'] | null | undefined): value is BuildingEntity {
  return isRuntimeEntity(value) && value.family === FAMILY_TYPES.building
}

export class UnitActions {
  unit: UnitEntity
  conversionAction: UnitConversionAction
  resourceActions: UnitResourceActions

  constructor(unit: UnitEntity) {
    this.unit = unit
    this.conversionAction = new UnitConversionAction(unit)
    this.resourceActions = new UnitResourceActions(unit)
  }

  restorePreviousWork() {
    restoreUnitPreviousWork(this.unit)
  }

  clearInvalidPreviousTask(): boolean {
    return clearInvalidPreviousUnitTask(this.unit)
  }

  playSound(soundId: CommandSound) {
    if (!soundId) return
    playAudibleSoundCue(this.unit, soundId, { profile: 'work' })
  }

  getWorkSound(key: string, fallback: CommandSound = null): CommandSound {
    return this.unit.sounds?.work?.[key] ?? fallback
  }

  startMiningResource(action: string | null | undefined): void {
    this.resourceActions.startMiningResource(action)
  }

  getConversionRules() {
    return this.conversionAction.getConversionRules()
  }

  convertTarget(target: RuntimeEntity, options: { grantXp?: boolean; stopConverter?: boolean } = {}): boolean {
    return this.conversionAction.convertTarget(target, options)
  }

  goBackToPrevious() {
    return goBackToPreviousUnitWork(this.unit)
  }

  startGathering(
    loadingType: string,
    soundId: CommandSound,
    options: {
      dieOnEmpty?: boolean
      checkOwner?: boolean
      updateTexture?: boolean
      releaseFrame?: number
      gatherEvery?: number
      onRelease?: () => void
      onDepleted?: (target: RuntimeEntity) => void
    } = {}
  ) {
    this.resourceActions.startGathering(loadingType, soundId, options)
  }

  upgrade(type: string) {
    const unit = this.unit
    const menu = unit.context?.menu
    const data = unit.owner?.config.units[type]
    if (!data) return
    unit.type = type
    unit.hitPoints = (data.totalHitPoints as number) - ((unit.totalHitPoints ?? 0) - (unit.hitPoints ?? 0))
    Object.assign(unit, data)
    refreshBakedLpcUnitAssets(unit)
    if (unit.action && !unit.path?.length) {
      unit.getAction?.(unit.action)
    } else {
      unit.setTextures?.(unit.currentSheet ?? SHEET_TYPES.standing)
    }
    if (unit.owner?.isPlayed && unit.owner.selectedUnit === unit) {
      menu?.setActionTarget(unit)
    }
  }

  prepareLoopingWorkAction(): boolean {
    return this.resourceActions.prepareLoopingWorkAction()
  }

  handleFarmAction() {
    this.resourceActions.handleFarmAction()
  }

  handleChopWoodAction() {
    this.resourceActions.handleChopWoodAction()
  }

  handleBuildAction() {
    this.resourceActions.handleBuildAction()
  }

  handleTrainAction() {
    const unit = this.unit
    const menu = unit.context?.menu
    const dest = isBuildingEntity(unit.dest) ? unit.dest : null
    const trainingType = unit.trainingTargetType ?? ''
    if (!trainingType || !dest || !unit.getActionCondition?.(dest, ACTION_TYPES.train, { trainingType })) {
      unit.trainingTargetType = null
      unit.stop?.()
      return
    }
    if (!dest?.startTrainingWithUnit?.(unit)) {
      const buildingBusy = Boolean(
        dest && (dest.loading !== null || dest.queue?.length || dest.technology || dest.trainingUnit)
      )
      if (buildingBusy) {
        unit.trainingTargetType = null
        if (unit.owner?.isPlayed) {
          menu?.showMessage(t('buildingAlreadyTraining', { building: t(dest?.type ?? '') }), 'warning')
        }
        unit.stop?.()
        return
      }
      unit.trainingTargetType = null
      unit.stop?.()
    }
  }

  handleHealAction() {
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
        if (!spendOrWaitForEnergy(unit, unit.action, dest)) return
        this.playSound(unit.sounds?.heal)
        const beforeHitPoints = dest.hitPoints ?? 0
        dest.hitPoints = Math.min(
          beforeHitPoints + (unit.healing ?? 0) + getHealingXpBonus(unit),
          dest.totalHitPoints ?? 0
        )
        const healedAmount = (dest.hitPoints ?? 0) - beforeHitPoints
        if (healedAmount > 0) showHealingFeedback(dest)
        grantUnitXp(unit, XP_CATEGORIES.healing, healedAmount)
        if (dest.selected || dest.shouldKeepHealthBarVisible?.()) {
          syncEntityHealthDisplay(dest, { menu, player })
        }
      }
    }
  }

  handleConvertAction() {
    this.conversionAction.handleConvertAction()
  }

  handleHuntAction() {
    const unit = this.unit
    const map = unit.context?.map
    const player = unit.owner
    const sprite = unit.sprite
    if (!sprite) return
    if (!unit.getActionCondition?.(unit.dest)) {
      unit.affectNewDest?.()
      return
    }
    const huntDest = isRuntimeEntity(unit.dest) ? unit.dest : null
    if (!huntDest) {
      unit.affectNewDest?.()
      return
    }
    if (huntDest.isDead) {
      if (isHeroControlled(unit)) {
        stopManualHeroAction(unit)
        return
      }
      unit.previousDest ? unit.goBackToPrevious?.() : unit.sendToTakeMeat?.(huntDest)
      return
    }
    unit.setTextures?.(SHEET_TYPES.action)
    sprite.onLoop = () => {
      const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
      if (!unit.getActionCondition?.(dest)) {
        if (dest && (dest.hitPoints ?? 0) <= 0) {
          dest.die?.()
          if (isHeroControlled(unit)) {
            stopManualHeroAction(unit)
            return
          }
          unit.previousDest ? unit.goBackToPrevious?.() : unit.sendToTakeMeat?.(dest)
          return
        }
        unit.affectNewDest?.()
        return
      }
      if (!unit.isUnitAtDest?.(unit.action, dest)) {
        if (unit.context?.map?.revealEverything || (dest && playerCanSeeInstance(dest, player))) {
          unit.sendToEvt?.(dest ?? null, ACTION_TYPES.hunt, { forceRepath: true })
        } else {
          unit.stop?.()
        }
        return
      }
      syncMovedActionTarget(unit, dest)
    }
    onSpriteLoopAtFrame(sprite, BOW_SHOOT_RELEASE_FRAME, () => {
      const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
      if (!dest || !unit.getActionCondition?.(dest) || !unit.realDest || !map) return
      if (!spendOrWaitForEnergy(unit, unit.action, dest)) return
      const projectile = new Projectile(
        {
          owner: unit,
          target: dest,
          type: HUNTING_PROJECTILE,
          destination: unit.realDest,
        },
        unit.context!
      )
      map.addChild(projectile)
    })
  }

  getAction(name: string) {
    const unit = this.unit
    const sprite = unit.sprite
    if (!sprite) return
    setActionSpriteLoop(unit, true)
    sprite.onLoop = undefined
    sprite.onFrameChange = undefined
    switch (name) {
      case ACTION_TYPES.farm:
        this.handleFarmAction()
        break
      case ACTION_TYPES.chopwood:
        this.handleChopWoodAction()
        break
      case ACTION_TYPES.forageberry:
        this.resourceActions.handleForageBerryAction()
        break
      case ACTION_TYPES.minestone:
      case ACTION_TYPES.minegold:
      case ACTION_TYPES.minecopper:
      case ACTION_TYPES.mineiron:
        this.startMiningResource(unit.action)
        break
      case ACTION_TYPES.build:
        this.handleBuildAction()
        break
      case ACTION_TYPES.attack:
        unit.unitCombat?.handleAttackAction()
        break
      case ACTION_TYPES.train:
        this.handleTrainAction()
        break
      case ACTION_TYPES.heal:
        this.handleHealAction()
        break
      case ACTION_TYPES.convert:
        this.handleConvertAction()
        break
      case ACTION_TYPES.takemeat:
        this.startGathering(LOADING_TYPES.meat, this.getWorkSound('takeMeat', SOUND_CUES.villager.takeMeat), {
          checkOwner: true,
          updateTexture: true,
        })
        break
      case ACTION_TYPES.hunt:
        this.handleHuntAction()
        break
      case ACTION_TYPES.captureHorse: {
        handleCaptureHorseAction(unit)
        break
      }
      default:
        unit.stop?.()
    }
  }
}
