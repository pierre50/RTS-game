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
  playSoundCue,
  resumeVillagerAutonomy,
  showDamageFeedback,
  showResourceGainFeedback,
  SLASH_IMPACT_FRAME,
} from '../../lib'
import {
  getBuildRateXpMultiplier,
  getGatherXpBonus,
  grantUnitXp,
  LOADING_XP_CATEGORY,
  XP_BUILD_TICK,
  XP_CATEGORIES,
  XP_FELL_TREE_TICK,
} from '../../lib/unitExperience'
import { t } from '../../lib/lang'
import { isHeroControlled } from '../../lib/unitControl'
import { spendOrWaitForEnergy } from '../../lib/unitEnergy'
import { syncEntityHealthDisplay } from '../../lib/entityHealthDisplay'
import {
  addCarriedResource,
  clearCarriedResource,
  clearCarriedResources,
  getCarriedResourceSpace,
  getDeliverableResourceEntries,
  getPlayerResourceKey,
  getTotalCarriedResources,
} from '../../lib/resourceCarry'
import {
  applyLoadingWorkAssets,
  applyUnloadedWorkAssets,
  finishManualHeroWorkSwing,
  lockManualHeroAction,
  stopManualHeroAction,
} from './UnitManualHeroWork'
import type { BuildingEntity, ResourceEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { CommandSound } from '../../types/entities'

function isRuntimeEntity(value: UnitEntity['dest'] | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

function isBuildingEntity(value: UnitEntity['dest'] | null | undefined): value is BuildingEntity {
  return isRuntimeEntity(value) && value.family === 'building'
}

function isResourceEntity(value: UnitEntity['dest'] | null | undefined): value is ResourceEntity {
  return isRuntimeEntity(value) && value.family === 'resource'
}

function isDepletedBerrybush(value: RuntimeEntity | null | undefined): value is RuntimeEntity {
  return Boolean(value?.type === RESOURCE_TYPES.berrybush && (value.quantity ?? 0) <= 0)
}

function showDepletedBerrybushMessage(unit: UnitEntity, target: RuntimeEntity | null | undefined): void {
  if (
    isDepletedBerrybush(target) &&
    unit.owner?.isPlayed &&
    target &&
    (unit.context?.controls?.instanceInCamera?.(target) ?? true)
  ) {
    unit.context?.menu?.showMessage(t('berrybushDepleted'), 'warning')
  }
}

function markBerrybushDepleted(target: RuntimeEntity): void {
  if (!isDepletedBerrybush(target)) return
  target.updateTexture?.()
}

function isFarmHarvestTarget(value: UnitEntity['dest'] | null | undefined): value is BuildingEntity | ResourceEntity {
  return isResourceEntity(value) && value.type === RESOURCE_TYPES.wheat
}

function resumeAutonomyOrStop(unit: UnitEntity): void {
  if (resumeVillagerAutonomy?.(unit)) return
  unit.stop?.()
}

function getGatherAmount(unit: UnitEntity): number {
  return Math.max(1, Math.round(unit.gatherAmount?.[unit.work ?? ''] ?? 1)) + getGatherXpBonus(unit)
}

export class UnitResourceActions {
  unit: UnitEntity

  constructor(unit: UnitEntity) {
    this.unit = unit
  }

  playSound(soundId: CommandSound) {
    const unit = this.unit
    const controls = unit.context?.controls
    if (!soundId || !controls?.instanceIsAudible?.(unit)) return
    playSoundCue(soundId)
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
      gatherEvery: config.gatherEvery,
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
      gatherEvery = 1,
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
    let gatherProgress = 0
    const gatherTick = () => {
      const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
      if (!unit.getActionCondition?.(dest)) {
        if (dieOnEmpty && dest && (dest.quantity ?? 0) <= 0) {
          dest.die?.()
        }
        showDepletedBerrybushMessage(unit, dest)
        unit.affectNewDest?.()
        return
      }
      const wasEmpty = getTotalCarriedResources(unit) === 0
      const gain = Math.min(getGatherAmount(unit), getCarriedResourceSpace(unit, loadingType))
      if (!dest || gain <= 0) {
        if (isHeroControlled(unit)) {
          if (dest) menu?.showMessage(t('heroInventoryFull'), 'warning')
          stopManualHeroAction(unit)
          return
        }
        unit.sendToDelivery?.()
        return
      }
      if (!spendOrWaitForEnergy(unit, unit.action, dest)) {
        if (isHeroControlled(unit)) stopManualHeroAction(unit)
        return
      }
      gatherProgress++
      if (gatherProgress < Math.max(1, gatherEvery)) {
        this.playSound(soundId)
        finishManualHeroWorkSwing(unit, releaseFrame)
        return
      }
      gatherProgress = 0
      addCarriedResource(unit, loadingType, gain)
      grantUnitXp(unit, LOADING_XP_CATEGORY[loadingType], gain)
      unit.updateInterfaceLoading?.()
      if (isHeroControlled(unit)) menu?.updateHeroStatus?.(unit)
      this.playSound(soundId)
      if (updateTexture) dest.updateTexture?.()
      dest.quantity = Math.max((dest.quantity ?? 0) - gain, 0)
      showResourceGainFeedback(unit, gain)
      if (dest.selected && (!checkOwner || unit.owner?.isPlayed)) {
        menu?.updateInfo?.(MENU_INFO_IDS.quantityText, dest.quantity)
      }
      if ((dest.quantity ?? 0) <= 0) {
        if (dieOnEmpty) dest.die?.()
        onDepleted?.(dest)
        unit.affectNewDest?.()
      }
      if (wasEmpty) {
        applyLoadingWorkAssets(unit)
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

  handleDeliveryAction() {
    const unit = this.unit
    const menu = unit.context?.menu
    if (isHeroControlled(unit)) getTotalCarriedResources(unit)
    if (!unit.getActionCondition?.(unit.dest, unit.action ?? undefined)) {
      unit.stop?.()
      return
    }
    const dest = isBuildingEntity(unit.dest) ? unit.dest : null
    const entries = dest ? getDeliverableResourceEntries(unit, dest) : []
    const deliveredAmount = entries.reduce((total, [, amount]) => total + amount, 0)
    if (deliveredAmount <= 0) {
      unit.stop?.()
      return
    }
    for (const [loadingType, amount] of entries) {
      const resourceKey = getPlayerResourceKey(loadingType)
      if (resourceKey && unit.owner) {
        unit.owner[resourceKey] = (unit.owner[resourceKey] ?? 0) + amount
      }
      clearCarriedResource(unit, loadingType)
    }
    showResourceGainFeedback(unit, deliveredAmount)
    unit.owner?.isPlayed && menu?.updateTopbar()
    unit.updateInterfaceLoading?.()
    if (getTotalCarriedResources(unit) > 0) {
      applyLoadingWorkAssets(unit)
    } else {
      clearCarriedResources(unit)
      applyUnloadedWorkAssets(unit)
    }
    unit.setTextures?.(SHEET_TYPES.standing)
    if (unit.previousDest) {
      unit.goBackToPrevious?.()
    } else {
      resumeAutonomyOrStop(unit)
    }
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
      const wasEmpty = getTotalCarriedResources(unit) === 0
      const gain = Math.min(getGatherAmount(unit), getCarriedResourceSpace(unit, LOADING_TYPES.wheat))
      if (!d || gain <= 0) {
        if (isHeroControlled(unit)) {
          if (d) {
            d.isUsedBy = null
            menu?.showMessage(t('heroInventoryFull'), 'warning')
          }
          stopManualHeroAction(unit)
          return
        }
        unit.sendToDelivery?.()
        if (d) d.isUsedBy = null
        return
      }
      if (!spendOrWaitForEnergy(unit, unit.action, d)) {
        if (isHeroControlled(unit)) stopManualHeroAction(unit)
        return
      }
      addCarriedResource(unit, LOADING_TYPES.wheat, gain)
      grantUnitXp(unit, XP_CATEGORIES.farming, gain)
      unit.updateInterfaceLoading?.()
      if (isHeroControlled(unit)) menu?.updateHeroStatus?.(unit)
      this.playSound(this.getWorkSound('gatherFood', SOUND_CUES.villager.gatherFood))
      d.quantity = Math.max((d.quantity ?? 0) - gain, 0)
      showResourceGainFeedback(unit, gain)
      if (d.selected) {
        menu?.updateInfo?.(MENU_INFO_IDS.quantityText, d.quantity)
      }
      if ((d.quantity ?? 0) <= 0) {
        d.die?.()
        unit.affectNewDest?.()
      }
      if (wasEmpty) {
        applyLoadingWorkAssets(unit)
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
      const woodSpace = getCarriedResourceSpace(unit, LOADING_TYPES.wood)
      if (woodSpace <= 0) {
        if (isHeroControlled(unit)) {
          menu?.showMessage(t('heroInventoryFull'), 'warning')
          stopManualHeroAction(unit)
          return
        }
        unit.sendToDelivery?.()
        return
      }
      if (!spendOrWaitForEnergy(unit, unit.action, dest)) {
        if (isHeroControlled(unit)) stopManualHeroAction(unit)
        return
      }
      this.playSound(this.getWorkSound('chopWood', SOUND_CUES.villager.chopWood))
      if ((dest.hitPoints ?? 0) > 0) {
        const previousHitPoints = dest.hitPoints ?? 0
        dest.hitPoints = Math.max(previousHitPoints - 1, 0)
        showDamageFeedback(dest, previousHitPoints - (dest.hitPoints ?? 0))
        grantUnitXp(unit, XP_CATEGORIES.woodcutting, XP_FELL_TREE_TICK)
        if (dest.selected) {
          syncEntityHealthDisplay(dest, { menu, player, emptyWhenDepleted: true })
        }
        if ((dest.hitPoints ?? 0) <= 0) {
          dest.hitPoints = 0
          dest.setCuttedTreeTexture?.()
        }
      } else {
        const wasEmpty = getTotalCarriedResources(unit) === 0
        const gain = Math.min(getGatherAmount(unit), woodSpace)
        addCarriedResource(unit, LOADING_TYPES.wood, gain)
        grantUnitXp(unit, XP_CATEGORIES.woodcutting, gain)
        unit.updateInterfaceLoading?.()
        if (isHeroControlled(unit)) menu?.updateHeroStatus?.(unit)
        dest.quantity = Math.max((dest.quantity ?? 0) - gain, 0)
        showResourceGainFeedback(unit, gain)
        if (dest.selected) {
          menu?.updateInfo?.(MENU_INFO_IDS.quantityText, dest.quantity)
        }
        if ((dest.quantity ?? 0) <= 0) {
          dest.die?.()
          unit.affectNewDest?.()
        }
        if (wasEmpty) {
          applyLoadingWorkAssets(unit)
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
        if (dest.selected || dest.shouldKeepHealthBarVisible?.()) {
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
}
