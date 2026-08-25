import { ACTION_TYPES, FAMILY_TYPES, LOADING_TYPES, SHEET_TYPES, SOUND_CUES } from '../../constants'
import {
  BOW_SHOOT_RELEASE_FRAME,
  HUNTING_PROJECTILE,
  onSpriteLoopAtFrame,
  playerCanSeeInstance,
  showHealingFeedback,
  syncMovedActionTarget,
} from '../../lib'
import { syncEntityHealthDisplay } from '../../lib/entityHealthDisplay'
import { t } from '../../lib/lang'
import { refreshBakedLpcUnitAssets } from '../../lib/lpc'
import { getHealingXpBonus, grantUnitXp, XP_CATEGORIES } from '../../lib/unitExperience'
import { isHeroControlled } from '../../lib/unitControl'
import { spendOrWaitForEnergy } from '../../lib/unitEnergy'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { CommandSound } from '../../types/entities'
import { Projectile } from '../Projectile'
import { stopManualHeroAction } from './UnitManualHeroWork'

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

  upgrade(type: string): void {
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

  handleTrainAction(): void {
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

  handleHuntAction(): void {
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

  getWorkSound(key: string, fallback: CommandSound = null): CommandSound {
    return this.unit.sounds?.work?.[key] ?? fallback
  }

  startTakeMeatGathering(startGathering: (loadingType: string, soundId: CommandSound, options: object) => void): void {
    startGathering(LOADING_TYPES.meat, this.getWorkSound('takeMeat', SOUND_CUES.villager.takeMeat), {
      checkOwner: true,
      updateTexture: true,
    })
  }
}
