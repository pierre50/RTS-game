import { ACTION_TYPES } from '../../constants'
import { playAudibleSoundCue } from '../../lib'
import { handleCaptureHorseAction } from './UnitCaptureHorseAction'
import { UnitDirectedActions } from './UnitDirectedActions'
import { UnitResourceActions } from './UnitResourceActions'
import { setActionSpriteLoop } from './UnitManualHeroWork'
import { UnitConversionAction } from './UnitConversionAction'
import {
  clearInvalidPreviousTask as clearInvalidPreviousUnitTask,
  goBackToPrevious as goBackToPreviousUnitWork,
  restorePreviousWork as restoreUnitPreviousWork,
} from './UnitPreviousWork'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { CommandSound } from '../../types/entities'

export class UnitActions {
  unit: UnitEntity
  conversionAction: UnitConversionAction
  directedActions: UnitDirectedActions
  resourceActions: UnitResourceActions

  constructor(unit: UnitEntity) {
    this.unit = unit
    this.conversionAction = new UnitConversionAction(unit)
    this.directedActions = new UnitDirectedActions(unit, soundId => this.playSound(soundId))
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
    this.directedActions.upgrade(type)
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

  handleDeliveryAction() {
    this.resourceActions.handleDeliveryAction()
  }

  handleTrainAction() {
    this.directedActions.handleTrainAction()
  }

  handleHealAction() {
    this.directedActions.handleHealAction()
  }

  handleConvertAction() {
    this.conversionAction.handleConvertAction()
  }

  handleHuntAction() {
    this.directedActions.handleHuntAction()
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
      case ACTION_TYPES.delivery:
        this.handleDeliveryAction()
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
        this.directedActions.startTakeMeatGathering((loadingType, soundId, options) => {
          this.startGathering(loadingType, soundId, options)
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
