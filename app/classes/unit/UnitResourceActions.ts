import {
  LOADING_TYPES,
  MENU_INFO_IDS,
  MINING_RESOURCE_CONFIG,
  RESOURCE_TYPES,
  SHEET_TYPES,
  SOUND_CUES,
} from '../../constants'
import {
  onSpriteLoopAtFrame,
  playAudibleSoundCue,
  showDamageFeedback,
  showResourceGainFeedback,
  SLASH_IMPACT_FRAME,
} from '../../lib'
import {
  getBuildRateXpMultiplier,
  grantUnitXp,
  LOADING_XP_CATEGORY,
  XP_BUILD_TICK,
  XP_CATEGORIES,
  XP_FELL_TREE_TICK,
} from '../../lib/units/unitExperience'
import { isHeroControlled } from '../../lib/units/unitControl'
import { spendOrWaitForEnergy } from '../../lib/units/unitEnergy'
import { syncEntityHealthDisplay } from '../../lib/entities/entityHealthDisplay'
import { finishManualHeroWorkSwing, lockManualHeroAction, stopManualHeroAction } from './UnitManualHeroWork'
import {
  addGatheredResource,
  clampDepletedBerrybushHitPoints,
  getGatherAmount,
  isBuildingEntity,
  isChoppableBerrybush,
  isFarmHarvestTarget,
  isResourceEntity,
  isRuntimeEntity,
  markBerrybushDepleted,
  sendVillagerToDeliveryIfFull,
  shouldReleaseGatheredResource,
  showDepletedBerrybushMessage,
} from './UnitResourceGathering'
import { logGatherVisualState } from './UnitGatherVisualDebug'
import { shouldSyncBuildHealthDisplay } from './UnitBuildVisuals'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { CommandSound } from '../../types/entities'

export class UnitResourceActions {
  unit: UnitEntity

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

  prepareLoopingWorkAction(): boolean {
    const unit = this.unit
    if (!unit.getActionCondition?.(unit.dest)) {
      unit.affectNewDest?.()
      return false
    }
    unit.setTextures?.(SHEET_TYPES.action)
    if (!unit.sprite) return false
    lockManualHeroAction(unit)
    return true
  }

  startMiningResource(action: string | null | undefined): void {
    const config = Object.values(MINING_RESOURCE_CONFIG ?? {}).find(entry => entry.action === action)
    if (!config) return
    this.startGathering(config.loadingType, this.getWorkSound(config.sound, SOUND_CUES.villager.mineOre), {
      dieOnEmpty: Boolean(config.dieOnEmpty),
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
      onRelease,
      onDepleted,
    }: {
      dieOnEmpty?: boolean
      checkOwner?: boolean
      updateTexture?: boolean
      releaseFrame?: number
      gatherEvery?: number
      onRelease?: () => void
      onDepleted?: (target: RuntimeEntity) => void
    } = {}
  ) {
    const unit = this.unit
    const menu = unit.context?.menu
    if (!unit.getActionCondition?.(unit.dest)) {
      showDepletedBerrybushMessage(unit, isRuntimeEntity(unit.dest) ? unit.dest : null)
      unit.affectNewDest?.()
      return
    }
    unit.setTextures?.(SHEET_TYPES.action)
    if (!unit.sprite) return
    lockManualHeroAction(unit)
    const gatherTick = () => {
      const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
      if (!unit.getActionCondition?.(dest)) {
        unit.gatherProgressState = null
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
      if (!spendOrWaitForEnergy(unit, unit.action, dest)) {
        if (isHeroControlled(unit)) stopManualHeroAction(unit)
        return
      }
      if (!shouldReleaseGatheredResource(unit, dest, loadingType, gatherEvery)) {
        this.playSound(soundId)
        finishManualHeroWorkSwing(unit, releaseFrame)
        return
      }
      const gain = addGatheredResource(unit, loadingType, requestedGain)
      if (gain <= 0) {
        unit.gatherProgressState = null
        if (!isHeroControlled(unit)) unit.sendToDelivery?.()
        else stopManualHeroAction(unit)
        return
      }
      grantUnitXp(unit, LOADING_XP_CATEGORY[loadingType], gain)
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
      } else if (sendVillagerToDeliveryIfFull(unit, loadingType)) {
        unit.gatherProgressState = null
      }
      finishManualHeroWorkSwing(unit, releaseFrame)
    }
    onSpriteLoopAtFrame(unit.sprite, releaseFrame, () => {
      onRelease?.()
      gatherTick()
    })
  }

  handleForageBerryAction() {
    this.startGathering(LOADING_TYPES.berry, this.getWorkSound('forageBerry', SOUND_CUES.villager.forageBerry), {
      onDepleted: dest => {
        markBerrybushDepleted(dest)
        showDepletedBerrybushMessage(this.unit, dest)
      },
    })
  }

  handleFarmAction() {
    const unit = this.unit
    const menu = unit.context?.menu
    if (!unit.getActionCondition?.(unit.dest)) {
      unit.affectNewDest?.()
      return
    }
    const dest = isFarmHarvestTarget(unit.dest) ? unit.dest : null
    if (!dest) return
    if (!isHeroControlled(unit)) dest.isUsedBy = unit
    if (!this.prepareLoopingWorkAction()) return
    const sprite = unit.sprite
    if (!sprite) return
    onSpriteLoopAtFrame(sprite, SLASH_IMPACT_FRAME, () => {
      const d = isFarmHarvestTarget(unit.dest) ? unit.dest : null
      if (!unit.getActionCondition?.(d)) {
        if ((d?.quantity ?? 0) <= 0) {
          d?.die?.()
        }
        unit.affectNewDest?.()
        return
      }
      if (d && !isHeroControlled(unit)) d.isUsedBy = unit
      const requestedGain = getGatherAmount(unit)
      if (!d || requestedGain <= 0) {
        if (isHeroControlled(unit)) {
          if (d) {
            d.isUsedBy = null
          }
          stopManualHeroAction(unit)
          return
        }
        if (d) d.isUsedBy = null
        return
      }
      if (!spendOrWaitForEnergy(unit, unit.action, d)) {
        if (isHeroControlled(unit)) stopManualHeroAction(unit)
        return
      }
      this.playSound(this.getWorkSound('gatherFood', SOUND_CUES.villager.gatherFood))
      if (!shouldReleaseGatheredResource(unit, d, LOADING_TYPES.wheat)) {
        finishManualHeroWorkSwing(unit, SLASH_IMPACT_FRAME)
        return
      }
      const gain = addGatheredResource(unit, LOADING_TYPES.wheat, requestedGain)
      if (gain <= 0) {
        if (isHeroControlled(unit)) stopManualHeroAction(unit)
        else unit.sendToDelivery?.()
        return
      }
      grantUnitXp(unit, XP_CATEGORIES.farming, gain)
      d.quantity = Math.max((d.quantity ?? 0) - gain, 0)
      showResourceGainFeedback(unit, gain)
      if (d.selected) {
        menu?.updateInfo?.(MENU_INFO_IDS.quantityText, d.quantity)
      }
      if ((d.quantity ?? 0) <= 0) {
        d.die?.()
        unit.affectNewDest?.()
      } else if (sendVillagerToDeliveryIfFull(unit, LOADING_TYPES.wheat)) {
        unit.gatherProgressState = null
      }
      finishManualHeroWorkSwing(unit, SLASH_IMPACT_FRAME)
    })
  }

  handleChopWoodAction() {
    const unit = this.unit
    const menu = unit.context?.menu
    const player = unit.owner
    if (!this.prepareLoopingWorkAction()) return
    const sprite = unit.sprite
    if (!sprite) return
    onSpriteLoopAtFrame(sprite, SLASH_IMPACT_FRAME, () => {
      const dest = isResourceEntity(unit.dest) ? unit.dest : null
      if (!unit.getActionCondition?.(dest)) {
        if ((dest?.quantity ?? 0) <= 0) {
          dest?.die?.()
        }
        unit.affectNewDest?.()
        return
      }
      if (!dest) return
      if (!spendOrWaitForEnergy(unit, unit.action, dest)) {
        if (isHeroControlled(unit)) stopManualHeroAction(unit)
        return
      }
      this.playSound(this.getWorkSound('chopWood', SOUND_CUES.villager.chopWood))
      if ((dest.hitPoints ?? 0) > 0) {
        clampDepletedBerrybushHitPoints(dest)
        const previousHitPoints = dest.hitPoints ?? 0
        dest.hitPoints = Math.max(previousHitPoints - 1, 0)
        showDamageFeedback(dest, previousHitPoints - (dest.hitPoints ?? 0))
        grantUnitXp(unit, XP_CATEGORIES.woodcutting, XP_FELL_TREE_TICK)
        if (dest.selected) {
          syncEntityHealthDisplay(dest, { menu, player, emptyWhenDepleted: true })
        }
        if ((dest.hitPoints ?? 0) <= 0) {
          dest.hitPoints = 0
          if (dest.type === RESOURCE_TYPES.berrybush) {
            dest.die?.()
            unit.affectNewDest?.()
          } else {
            dest.setCuttedTreeTexture?.()
          }
        }
      } else if (!isChoppableBerrybush(dest)) {
        const requestedGain = getGatherAmount(unit)
        if (!shouldReleaseGatheredResource(unit, dest, LOADING_TYPES.wood)) {
          finishManualHeroWorkSwing(unit, SLASH_IMPACT_FRAME)
          return
        }
        const gain = addGatheredResource(unit, LOADING_TYPES.wood, requestedGain)
        if (gain <= 0) {
          if (isHeroControlled(unit)) stopManualHeroAction(unit)
          else unit.sendToDelivery?.()
          return
        }
        grantUnitXp(unit, XP_CATEGORIES.woodcutting, gain)
        dest.quantity = Math.max((dest.quantity ?? 0) - gain, 0)
        showResourceGainFeedback(unit, gain)
        if (dest.selected) {
          menu?.updateInfo?.(MENU_INFO_IDS.quantityText, dest.quantity)
        }
        if ((dest.quantity ?? 0) <= 0) {
          dest.die?.()
          unit.affectNewDest?.()
        } else if (sendVillagerToDeliveryIfFull(unit, LOADING_TYPES.wood)) {
          unit.gatherProgressState = null
        }
      }
      finishManualHeroWorkSwing(unit, SLASH_IMPACT_FRAME)
    })
  }

  handleBuildAction() {
    const unit = this.unit
    const menu = unit.context?.menu
    const player = unit.owner
    if (!this.prepareLoopingWorkAction()) return
    const sprite = unit.sprite
    if (!sprite) return
    onSpriteLoopAtFrame(sprite, SLASH_IMPACT_FRAME, () => {
      const dest = isBuildingEntity(unit.dest) ? unit.dest : null
      if (!unit.getActionCondition?.(dest)) {
        if (dest?.isBuilt && unit.continueBuildingQueue?.()) return
        unit.affectNewDest?.()
        return
      }
      if (!dest) return
      if ((dest.hitPoints ?? 0) < (dest.totalHitPoints ?? 0)) {
        if (!spendOrWaitForEnergy(unit, unit.action, dest)) {
          if (isHeroControlled(unit)) stopManualHeroAction(unit)
          return
        }
        this.playSound(this.getWorkSound('build', SOUND_CUES.villager.buildLoop))
        dest.hitPoints = Math.min(
          Math.round(
            (dest.hitPoints ?? 0) +
              ((dest.totalHitPoints ?? 0) / (dest.constructionTime ?? 1)) * getBuildRateXpMultiplier(unit)
          ),
          dest.totalHitPoints ?? 0
        )
        grantUnitXp(unit, XP_CATEGORIES.building, XP_BUILD_TICK)
        if (shouldSyncBuildHealthDisplay(dest)) {
          syncEntityHealthDisplay(dest, { menu, player, forceInfo: unit.owner?.isPlayed })
        }
        dest.updateHitPoints?.(unit.action ?? '')
      } else {
        if (!dest.isBuilt) {
          dest.updateHitPoints?.(unit.action ?? '')
          dest.isBuilt = true
        }
        if (unit.continueBuildingQueue?.()) return
        unit.affectNewDest?.()
      }
      finishManualHeroWorkSwing(unit, SLASH_IMPACT_FRAME)
    })
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
