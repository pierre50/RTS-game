import {
  LOADING_TYPES,
  MENU_INFO_IDS,
  MINING_RESOURCE_CONFIG,
  RESOURCE_GATHER_SWINGS,
  RESOURCE_STOCKPILE_TYPES,
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
  finishManualHeroWorkSwing,
  lockManualHeroAction,
  stopManualHeroAction,
} from './UnitManualHeroWork'
import type { BuildingEntity, ResourceEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { CommandSound } from '../../types/entities'

type PlayerResourceKey = 'wood' | 'food' | 'stone' | 'gold' | 'copper' | 'iron'

const DEPLETED_BERRYBUSH_HIT_POINTS = 4

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
  return Boolean(RESOURCE_TYPES.berrybush && value?.type === RESOURCE_TYPES.berrybush && (value.quantity ?? 0) <= 0)
}

function isChoppableBerrybush(value: RuntimeEntity | null | undefined): boolean {
  return isDepletedBerrybush(value) && (value.hitPoints ?? 0) > 0
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
  target.totalHitPoints = Math.min(target.totalHitPoints ?? DEPLETED_BERRYBUSH_HIT_POINTS, DEPLETED_BERRYBUSH_HIT_POINTS)
  target.hitPoints = Math.min(target.hitPoints ?? DEPLETED_BERRYBUSH_HIT_POINTS, DEPLETED_BERRYBUSH_HIT_POINTS)
  target.updateTexture?.()
}

function clampDepletedBerrybushHitPoints(target: RuntimeEntity): void {
  if (!isChoppableBerrybush(target)) return
  markBerrybushDepleted(target)
}

function isFarmHarvestTarget(value: UnitEntity['dest'] | null | undefined): value is BuildingEntity | ResourceEntity {
  return isResourceEntity(value) && value.type === RESOURCE_TYPES.wheat
}

function getGatherAmount(unit: UnitEntity): number {
  return Math.max(1, Math.round(unit.gatherAmount?.[unit.work ?? ''] ?? 1)) + getGatherXpBonus(unit)
}

function getPlayerResourceKey(loadingType: string | null | undefined): PlayerResourceKey | null {
  if (!loadingType) return null
  if ([LOADING_TYPES.berry, LOADING_TYPES.wheat, LOADING_TYPES.meat].includes(loadingType)) return 'food'
  return Object.values(RESOURCE_STOCKPILE_TYPES).find(resource => resource === loadingType) ?? null
}

function addGatheredResourceToPlayer(unit: UnitEntity, loadingType: string, amount: number): void {
  const resourceKey = getPlayerResourceKey(loadingType)
  if (!resourceKey || !unit.owner) return
  unit.owner[resourceKey] = (unit.owner[resourceKey] ?? 0) + amount
  if (unit.owner.isPlayed) unit.context?.menu?.updateTopbar?.()
}

function getResourceGatherSwings(loadingType: string, override?: number): number {
  return Math.max(1, override ?? RESOURCE_GATHER_SWINGS?.[loadingType as keyof typeof RESOURCE_GATHER_SWINGS] ?? 1)
}

function getGatherProgressState(
  unit: UnitEntity,
  target: RuntimeEntity,
  loadingType: string,
  gatherEvery: number
): NonNullable<UnitEntity['gatherProgressState']> {
  const current = unit.gatherProgressState
  if (
    current &&
    current.target === target &&
    current.action === unit.action &&
    current.loadingType === loadingType &&
    current.gatherEvery === gatherEvery
  ) {
    return current
  }
  const next = {
    action: unit.action,
    gatherEvery,
    loadingType,
    progress: 0,
    target,
  }
  unit.gatherProgressState = next
  return next
}

function shouldReleaseGatheredResource(
  unit: UnitEntity,
  target: RuntimeEntity,
  loadingType: string,
  gatherEvery?: number
): boolean {
  const requiredSwings = getResourceGatherSwings(loadingType, gatherEvery)
  const gatherState = getGatherProgressState(unit, target, loadingType, requiredSwings)
  gatherState.progress++
  if (gatherState.progress < requiredSwings) return false
  gatherState.progress = 0
  return true
}

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
      const gain = getGatherAmount(unit)
      if (!dest || gain <= 0) {
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
      addGatheredResourceToPlayer(unit, loadingType, gain)
      grantUnitXp(unit, LOADING_XP_CATEGORY[loadingType], gain)
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
      const gain = getGatherAmount(unit)
      if (!d || gain <= 0) {
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
      addGatheredResourceToPlayer(unit, LOADING_TYPES.wheat, gain)
      grantUnitXp(unit, XP_CATEGORIES.farming, gain)
      d.quantity = Math.max((d.quantity ?? 0) - gain, 0)
      showResourceGainFeedback(unit, gain)
      if (d.selected) {
        menu?.updateInfo?.(MENU_INFO_IDS.quantityText, d.quantity)
      }
      if ((d.quantity ?? 0) <= 0) {
        d.die?.()
        unit.affectNewDest?.()
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
        const gain = getGatherAmount(unit)
        if (!shouldReleaseGatheredResource(unit, dest, LOADING_TYPES.wood)) {
          finishManualHeroWorkSwing(unit, SLASH_IMPACT_FRAME)
          return
        }
        addGatheredResourceToPlayer(unit, LOADING_TYPES.wood, gain)
        grantUnitXp(unit, XP_CATEGORIES.woodcutting, gain)
        dest.quantity = Math.max((dest.quantity ?? 0) - gain, 0)
        showResourceGainFeedback(unit, gain)
        if (dest.selected) {
          menu?.updateInfo?.(MENU_INFO_IDS.quantityText, dest.quantity)
        }
        if ((dest.quantity ?? 0) <= 0) {
          dest.die?.()
          unit.affectNewDest?.()
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
