import {
  ACTION_TYPES,
  FAMILY_TYPES,
  LOADING_TYPES,
  MENU_INFO_IDS,
  MINING_RESOURCE_CONFIG,
  RESOURCE_TYPES,
  SHEET_TYPES,
  SOUND_CUES,
  STEP_TIME,
  TYPE_ACTION,
} from '../../constants'
import {
  degreeToDirection,
  canUpdateMinimap,
  getInstanceDegree,
  onSpriteLoopAtFrame,
  updateInstanceVisibility,
  playSoundCue,
  playerCanSeeInstance,
  BOW_SHOOT_RELEASE_FRAME,
  SLASH_IMPACT_FRAME,
  showDamageFeedback,
  showHealingFeedback,
  showConversionFeedback,
  showResourceGainFeedback,
  HUNTING_PROJECTILE,
  isBanditOwner,
  instancesDistance,
  resumeVillagerAutonomy,
} from '../../lib'
import { Projectile } from '../Projectile'
import {
  getBuildRateXpMultiplier,
  getGatherXpBonus,
  getHealingXpBonus,
  grantUnitXp,
  LOADING_XP_CATEGORY,
  XP_BUILD_TICK,
  XP_CATEGORIES,
  XP_CONVERT_SUCCESS,
  XP_FELL_TREE_TICK,
} from '../../lib/unitExperience'
import { refreshBakedLpcUnitAssets } from '../../lib/lpc'
import { t } from '../../lib/lang'
import { isHeroControlled, isManualHeroActionReleased } from '../../lib/unitControl'
import { spendOrWaitForEnergy } from '../../lib/unitEnergy'
import { applyUnitWorkAssets } from '../../lib/unitWorkAppearance'
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
import { HeroLassoThrow } from '../HeroLassoThrow'
import {
  getNearestAvailableStableForUnit,
  routeCapturedHorseToStableWithOwnerContact,
} from '../../lib/horseCapture'
import type { AnimalEntity, BuildingEntity, ResourceEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { SchedulerTaskId } from '../../types/context'
import type { PlayerLike } from '../../types/player'
import type { CommandSound } from '../../types/entities'
const BASE_CONVERSION_MIN_CHANTS = 3
const BASE_CONVERSION_CHANCE = 0.3
const ASTROLOGY_CONVERSION_CHANCE = 0.39

const RESOURCE_SEND_TO_BY_TYPE: Record<keyof typeof TYPE_ACTION, (unit: UnitEntity, dest: RuntimeEntity) => boolean> = {
  Stone: (unit, dest) => (unit.sendToStone ? (unit.sendToStone(dest, true), true) : false),
  Gold: (unit, dest) => (unit.sendToMineResource ? (unit.sendToMineResource(dest, true), true) : false),
  Copper: (unit, dest) => (unit.sendToMineResource ? (unit.sendToMineResource(dest, true), true) : false),
  Iron: (unit, dest) => (unit.sendToMineResource ? (unit.sendToMineResource(dest, true), true) : false),
  Berrybush: (unit, dest) => (unit.sendToBerrybush ? (unit.sendToBerrybush(dest, true), true) : false),
  Wheat: (unit, dest) => (unit.sendToFarm ? (unit.sendToFarm(dest, true), true) : false),
  Tree: (unit, dest) => (unit.sendToTree ? (unit.sendToTree(dest, true), true) : false),
}
const CAPTURE_HORSE_RETRY_INTERVAL_MS = 750
const CAPTURE_HORSE_REPATH_INTERVAL_MS = 220
const CAPTURE_HORSE_OWNER_STABLE_MIN_TIMEOUT_MS = 20000
const CAPTURE_HORSE_OWNER_STABLE_MS_PER_CELL = 900

type CaptureHorseActionState = {
  lastLassoAttemptAt: number
  lastRepathAt: number
  stableRouteStop: (() => void) | null
  stableRouteHorseLabel: string | null
  tickTaskId: SchedulerTaskId | null
}

const captureHorseActionStateByUnit = new WeakMap<UnitEntity, CaptureHorseActionState>()

type HeroLassoWithTarget = {
  target?: RuntimeEntity | null
}

function getCaptureHorseActionState(unit: UnitEntity): CaptureHorseActionState {
  let state = captureHorseActionStateByUnit.get(unit)
  if (!state) {
    state = {
      lastLassoAttemptAt: 0,
      lastRepathAt: 0,
      stableRouteStop: null,
      stableRouteHorseLabel: null,
      tickTaskId: null,
    }
    captureHorseActionStateByUnit.set(unit, state)
  }
  return state
}

function stopCaptureHorseTick(unit: UnitEntity, state: CaptureHorseActionState): void {
  if (state.tickTaskId == null) return
  unit.context?.scheduler?.remove(state.tickTaskId)
  state.tickTaskId = null
}

function ensureCaptureHorseTick(unit: UnitEntity, state: CaptureHorseActionState): void {
  const scheduler = unit.context?.scheduler
  if (!scheduler || state.tickTaskId != null) return
  state.tickTaskId = scheduler.add(() => {
    if (unit.action !== ACTION_TYPES.captureHorse || unit.isDead || unit.isDestroyed) {
      resetCaptureHorseActionState(unit)
      return
    }
    unit.getAction?.(ACTION_TYPES.captureHorse)
  }, STEP_TIME, 'unit.captureHorse')
}

function getCaptureHorseOwnerStableTimeoutMs(owner: UnitEntity, stable: BuildingEntity): number {
  return Math.max(
    CAPTURE_HORSE_OWNER_STABLE_MIN_TIMEOUT_MS,
    Math.ceil(instancesDistance(owner, stable) * CAPTURE_HORSE_OWNER_STABLE_MS_PER_CELL)
  )
}

function releaseCaptureHorseAttachment(
  unit: UnitEntity,
  horse: AnimalEntity | null | undefined = null,
  { allowFlee = true }: { allowFlee?: boolean } = {}
): void {
  const lasso = getHeroCaptureLasso(unit)
  const lassoTarget = (lasso as HeroLassoWithTarget | null)?.target
  const lassoHorse = isHorseEntity(lassoTarget) ? lassoTarget : null
  const ownedHorse = horse && getHorseLassoOwner(horse)?.label === unit.label ? horse : lassoHorse

  if (lasso && lassoHorse && getHorseLassoOwner(lassoHorse)?.label === unit.label) {
    lasso.releaseHorse({ allowStable: false, allowFlee })
  } else if (ownedHorse && getHorseLassoOwner(ownedHorse)?.label === unit.label) {
    ownedHorse.isLassoed = false
    ownedHorse.lassoOwner = null
    if (allowFlee) ownedHorse.animalBehavior?.start?.()
  }
  lasso?.clearLasso({ releaseHorse: false })
}

function resetCaptureHorseActionState(unit: UnitEntity, horse: AnimalEntity | null = null): void {
  const state = captureHorseActionStateByUnit.get(unit)
  if (state?.stableRouteStop) {
    state.stableRouteStop()
  }
  if (state) stopCaptureHorseTick(unit, state)
  releaseCaptureHorseAttachment(unit, horse)
  captureHorseActionStateByUnit.delete(unit)
}

type OwnerListKey = 'units' | 'buildings'
type ConvertibleEntity = (UnitEntity | BuildingEntity) & Partial<UnitEntity & BuildingEntity>

function isRuntimeEntity(value: UnitEntity['dest'] | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

function isUnitEntity(value: UnitEntity['dest'] | null | undefined): value is UnitEntity {
  return isRuntimeEntity(value) && value.family === FAMILY_TYPES.unit
}

function isBuildingEntity(value: UnitEntity['dest'] | null | undefined): value is BuildingEntity {
  return isRuntimeEntity(value) && value.family === FAMILY_TYPES.building
}

function isResourceEntity(value: UnitEntity['dest'] | null | undefined): value is ResourceEntity {
  return isRuntimeEntity(value) && value.family === FAMILY_TYPES.resource
}

function isDepletedBerrybush(value: RuntimeEntity | null | undefined): value is RuntimeEntity {
  return Boolean(value?.type === RESOURCE_TYPES.berrybush && (value.quantity ?? 0) <= 0)
}

function isHorseEntity(value: RuntimeEntity | null | undefined): value is AnimalEntity {
  return Boolean(value?.family === FAMILY_TYPES.animal && value.type === 'Horse')
}

function getHorseLassoOwner(horse: AnimalEntity): UnitEntity | null | undefined {
  return horse.lassoOwner
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

function getHeroLassoTarget(unit: UnitEntity): RuntimeEntity | null {
  const lasso = (unit.heroLasso ?? null) as HeroLassoWithTarget | null
  const target = lasso?.target
  return isRuntimeEntity(target) ? target : null
}

function getHeroCaptureLasso(unit: UnitEntity): HeroLassoThrow | null {
  return unit.heroLasso instanceof HeroLassoThrow ? unit.heroLasso : null
}

const ownerList = (owner: PlayerLike | null | undefined, key: OwnerListKey): RuntimeEntity[] | undefined => {
  if (!owner) return undefined
  return key === 'units' ? owner.units : owner.buildings
}

function stopManualHeroAction(unit: UnitEntity): void {
  unit.previousDest = null
  unit.stop?.()
}

function stopManualHeroActionAfterLoop(unit: UnitEntity): void {
  const sprite = unit.sprite
  if (!sprite) {
    stopManualHeroAction(unit)
    return
  }
  sprite.onLoop = () => {
    sprite.onLoop = undefined
    unit.actionLocked = false
    stopManualHeroAction(unit)
  }
}

// Stays locked for the whole ongoing action (every swing loop), not just the
// first one — release is explicit, via stopManualHeroAction/AfterLoop once
// the target is gone or the player releases the action key/button.
function lockManualHeroAction(unit: UnitEntity): void {
  if (!isHeroControlled(unit)) return
  unit.actionLocked = true
}

function setActionSpriteLoop(unit: UnitEntity, loop: boolean): void {
  if (unit.sprite) unit.sprite.loop = loop
  if (unit.shadow) unit.shadow.loop = loop
  const layers = (unit as UnitEntity & { appearanceLayerSprites?: Map<number, { loop: boolean }> })
    .appearanceLayerSprites
  for (const sprite of layers?.values() ?? []) {
    sprite.loop = loop
  }
}

function applyLoadingWorkAssets(unit: UnitEntity): void {
  applyUnitWorkAssets(unit, unit.work, { action: unit.action, loading: true })
  if (unit.currentSheet && (unit.currentSheet === SHEET_TYPES.standing || unit.currentSheet === SHEET_TYPES.walking)) {
    unit.setTextures?.(unit.currentSheet)
  }
}

function applyUnloadedWorkAssets(unit: UnitEntity): void {
  applyUnitWorkAssets(unit, unit.work, { action: unit.action, loading: false })
}

function resumeAutonomyOrStop(unit: UnitEntity): void {
  if (resumeVillagerAutonomy?.(unit)) return
  unit.stop?.()
}

function removeFromOwnerList(
  owner: PlayerLike | null | undefined,
  key: 'units' | 'buildings',
  instance: RuntimeEntity
) {
  const list = ownerList(owner, key)
  if (!Array.isArray(list)) return
  const index = list.indexOf(instance)
  if (index >= 0) list.splice(index, 1)
}

function addToOwnerList(owner: PlayerLike | null | undefined, key: 'units' | 'buildings', instance: RuntimeEntity) {
  const list = ownerList(owner, key)
  if (!Array.isArray(list) || list.includes(instance)) return
  list.push(instance)
}

function isConvertibleEntity(target: RuntimeEntity): target is ConvertibleEntity {
  return isUnitEntity(target) || isBuildingEntity(target)
}

const lastConversionDebugAt = new Map<string, number>()

function debugConversionFailure(
  converter: UnitEntity,
  target: RuntimeEntity,
  reason: string,
  details: Record<string, unknown> = {}
): void {
  if (!converter.owner?.isPlayed) return
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const key = `${converter.label ?? 'converter'}:${target.label ?? 'target'}:${reason}`
  const last = lastConversionDebugAt.get(key) ?? 0
  if (now - last < 600) return
  lastConversionDebugAt.set(key, now)
  console.warn('[conversion]', reason, {
    converter: {
      label: converter.label,
      type: converter.type,
      owner: converter.owner?.label,
      action: converter.action,
    },
    target: {
      label: target.label,
      type: target.type,
      family: target.family,
      owner: target.owner?.label,
      hitPoints: target.hitPoints,
      isDead: target.isDead,
      isDestroyed: target.isDestroyed,
    },
    ...details,
  })
}

function clearConvertedUnitRuntimeState(target: ConvertibleEntity): void {
  target.stopInterval?.()
  if (target.energyWaitTaskId != null) {
    target.context?.scheduler?.remove(target.energyWaitTaskId)
    target.energyWaitTaskId = null
  }
  if (target.sprite) {
    target.sprite.onLoop = undefined
    target.sprite.onFrameChange = undefined
    target.sprite.onComplete = undefined
  }
  target.path = []
  target.action = null
  target.dest = null
  target.realDest = null
  target.previousDest = null
  target.previousWork = null
  target.waitingForEnergyAction = null
  target.waitingForEnergyTarget = null
  target.combatMode = null
  target.lastCombatRecoveryMoveAt = null
  target.actionLocked = false
  target.pendingOrder = null
  target.blockedGatherApproach = null
  target.inactif = true
}

// Resources gained per swing (chop/farm/mine/forage/...), separate from
// `gatheringRate` which is now only an AI food-source scoring heuristic
// (app/ai/AIEconomy.ts) — technologies bump this flat amount instead of
// speeding up the animation.
function getGatherAmount(unit: UnitEntity): number {
  return Math.max(1, Math.round(unit.gatherAmount?.[unit.work ?? ''] ?? 1)) + getGatherXpBonus(unit)
}

export class UnitActions {
  unit: UnitEntity

  constructor(unit: UnitEntity) {
    this.unit = unit
  }

  restorePreviousWork() {
    const unit = this.unit
    if (!unit.previousWork || unit.work === unit.previousWork) return
    unit.work = unit.previousWork
    unit.previousWork = null
  }

  clearInvalidPreviousTask(): boolean {
    const unit = this.unit
    const previousDest = isRuntimeEntity(unit.previousDest) ? unit.previousDest : null
    if (!previousDest) return false
    if (previousDest.family === FAMILY_TYPES.animal) return false

    if (previousDest.family === FAMILY_TYPES.building) {
      if (
        unit.getActionCondition?.(previousDest, ACTION_TYPES.build) ||
        unit.getActionCondition?.(previousDest, ACTION_TYPES.farm)
      ) {
        return false
      }
      unit.previousDest = null
      return true
    }

    const type = previousDest.category || previousDest.type
    const action = TYPE_ACTION[type as keyof typeof TYPE_ACTION]
    if (!action || !unit.getActionCondition?.(previousDest, action)) {
      unit.previousDest = null
      return true
    }
    return false
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

  startMiningResource(action: string | null | undefined): void {
    const config = Object.values(MINING_RESOURCE_CONFIG ?? {}).find(entry => entry.action === action)
    if (!config) return
    this.startGathering(config.loadingType, this.getWorkSound(config.sound, SOUND_CUES.villager.mineOre), {
      dieOnEmpty: Boolean(config.dieOnEmpty),
      gatherEvery: config.gatherEvery,
    })
  }

  getConversionRules() {
    const technologies = this.unit.owner?.technologies || []
    return technologies.includes('Astrology')
      ? { minChants: BASE_CONVERSION_MIN_CHANTS, chance: ASTROLOGY_CONVERSION_CHANCE }
      : { minChants: BASE_CONVERSION_MIN_CHANTS, chance: BASE_CONVERSION_CHANCE }
  }

  convertTarget(target: RuntimeEntity, options: { grantXp?: boolean; stopConverter?: boolean } = {}): boolean {
    const unit = this.unit
    const grantXpOnSuccess = options.grantXp ?? true
    const stopConverter = options.stopConverter ?? true
    const menu = unit.context?.menu
    const player = unit.owner
    if (!isConvertibleEntity(target)) {
      debugConversionFailure(unit, target, 'target-not-convertible')
      return false
    }
    const t = target
    const oldOwner = t.owner
    const newOwner = unit.owner
    if (!oldOwner || !newOwner || oldOwner.label === newOwner.label) {
      debugConversionFailure(unit, target, 'invalid-owner', {
        oldOwner: oldOwner?.label,
        newOwner: newOwner?.label,
      })
      return false
    }
    if (isBanditOwner(newOwner)) {
      debugConversionFailure(unit, target, 'bandit-owner-cannot-convert', {
        newOwner: newOwner.label,
      })
      return false
    }

    if (t.selected) {
      t.select?.()
      if (player?.selectedOther === target) player.selectedOther = null
    }

    clearConvertedUnitRuntimeState(t)
    t.assetCiv = t.assetCiv || oldOwner.civ
    t.assetAge = t.assetAge ?? oldOwner.age
    t.owner = newOwner

    if (t.family === FAMILY_TYPES.unit) {
      removeFromOwnerList(oldOwner, 'units', t)
      addToOwnerList(newOwner, 'units', t)
      oldOwner.population = Math.max(0, oldOwner.population - 1)
      newOwner.population += 1
      t.setTextures?.(SHEET_TYPES.standing)
    } else if (t.family === FAMILY_TYPES.building) {
      t.assetType = t.assetType || t.type
      removeFromOwnerList(oldOwner, 'buildings', t)
      addToOwnerList(newOwner, 'buildings', t)
      if (t.increasePopulation && t.populationCapacityApplied) {
        oldOwner.populationMax = Math.max(0, oldOwner.populationMax - t.increasePopulation)
        newOwner.populationMax += t.increasePopulation
      }
      t.clearRallyPoint?.()
      t.queue = []
      t.technology = null
      t.loading = null
      t.finalTexture?.()
      if (t.interface) {
        const units = newOwner.isPlayed && menu ? (t.units || []).map(key => menu.getActionUnitButton?.(key, t)) : []
        t.interface.menu = newOwner.isPlayed
          ? [...units, ...(units.length && menu ? [menu.getActionRallyPointButton?.()] : [])].filter(
              (item): item is NonNullable<typeof item> => Boolean(item)
            )
          : []
      }
      if (t.isBuilt && !newOwner.hasBuilt?.includes(t.type)) {
        newOwner.hasBuilt?.push(t.type)
      }
    } else {
      return false
    }

    updateInstanceVisibility(t)
    showConversionFeedback?.(t, newOwner.color ?? newOwner.colorHex)
    if (t.selected || t.shouldKeepHealthBarVisible?.()) {
      syncEntityHealthDisplay(t, { menu, player: newOwner })
    } else {
      t.removeHealthBar?.()
    }
    canUpdateMinimap(t, player) && menu?.updatePlayerMiniMapEvt?.(oldOwner)
    canUpdateMinimap(t, player) && menu?.updatePlayerMiniMapEvt?.(newOwner)
    if (newOwner.isPlayed) menu?.updateTopbar()
    if (grantXpOnSuccess) grantUnitXp(unit, XP_CATEGORIES.healing, XP_CONVERT_SUCCESS)
    if (stopConverter) unit.stop?.()
    return true
  }

  goBackToPrevious() {
    const unit = this.unit
    const map = unit.context?.map
    this.clearInvalidPreviousTask()
    if (!unit.previousDest) {
      this.restorePreviousWork()
      resumeAutonomyOrStop(unit)
      return
    }
    const dest = isRuntimeEntity(unit.previousDest) ? unit.previousDest : null
    if (!dest) {
      unit.previousDest = null
      this.restorePreviousWork()
      resumeAutonomyOrStop(unit)
      return true
    }
    const type = dest.category || dest.type
    unit.previousDest = null
    this.restorePreviousWork()
    unit.handleChangeDest?.()
    unit.dest = null
    unit.path = []
    if (dest.family === FAMILY_TYPES.animal) {
      if (unit.getActionCondition?.(dest, ACTION_TYPES.takemeat)) {
        unit.sendToTakeMeat?.(dest, true)
      } else if (map) {
        unit.sendToEvt?.(map.grid[dest.i][dest.j], ACTION_TYPES.hunt)
      }
    } else if (dest.family === FAMILY_TYPES.building) {
      if (unit.getActionCondition?.(dest, ACTION_TYPES.build)) {
        if (isBuildingEntity(dest)) unit.sendToBuilding?.(dest)
      } else if (unit.getActionCondition?.(dest, ACTION_TYPES.farm)) {
        unit.sendToFarm?.(dest, true)
      } else if (map) {
        unit.sendToEvt?.(map.grid[dest.i][dest.j], ACTION_TYPES.build)
      }
    } else if (TYPE_ACTION[type as keyof typeof TYPE_ACTION]) {
      const action = TYPE_ACTION[type as keyof typeof TYPE_ACTION]
      if (unit.getActionCondition?.(dest, action)) {
        const sendTo = RESOURCE_SEND_TO_BY_TYPE[type as keyof typeof TYPE_ACTION]
        if (!sendTo(unit, dest)) unit.stop?.()
      } else if (map) {
        unit.sendToEvt?.(map.grid[dest.i][dest.j], action)
      }
    } else if (map) {
      unit.sendToEvt?.(map.grid[dest.i][dest.j])
    }
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
        if (isManualHeroActionReleased(unit)) stopManualHeroActionAfterLoop(unit)
        return
      }
      gatherProgress = 0
      addCarriedResource(unit, loadingType, gain)
      grantUnitXp(unit, LOADING_XP_CATEGORY[loadingType], gain)
      unit.updateInterfaceLoading?.()
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
      if (isManualHeroActionReleased(unit)) stopManualHeroActionAfterLoop(unit)
    }
    onSpriteLoopAtFrame(unit.sprite, releaseFrame, () => {
      onRelease?.()
      gatherTick()
    })
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

  getAction(name: string) {
    const unit = this.unit
    const menu = unit.context?.menu
    const player = unit.owner
    const map = unit.context?.map
    const sprite = unit.sprite
    if (!sprite) return
    setActionSpriteLoop(unit, true)
    sprite.onLoop = undefined
    sprite.onFrameChange = undefined
    switch (name) {
      case ACTION_TYPES.delivery: {
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
        break
      }
      case ACTION_TYPES.farm: {
        if (!unit.getActionCondition?.(unit.dest)) {
          unit.affectNewDest?.()
          return
        }
        const dest = isFarmHarvestTarget(unit.dest) ? unit.dest : null
        if (!dest) return
        if (!isHeroControlled(unit)) dest.isUsedBy = unit
        unit.setTextures?.(SHEET_TYPES.action)
        if (!unit.sprite) return
        lockManualHeroAction(unit)
        onSpriteLoopAtFrame(unit.sprite, SLASH_IMPACT_FRAME, () => {
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
          if (isManualHeroActionReleased(unit)) stopManualHeroActionAfterLoop(unit)
        })
        break
      }
      case ACTION_TYPES.chopwood: {
        if (!unit.getActionCondition?.(unit.dest)) {
          unit.affectNewDest?.()
          return
        }
        unit.setTextures?.(SHEET_TYPES.action)
        if (!unit.sprite) return
        lockManualHeroAction(unit)
        onSpriteLoopAtFrame(unit.sprite, SLASH_IMPACT_FRAME, () => {
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
          if (isManualHeroActionReleased(unit)) stopManualHeroActionAfterLoop(unit)
        })
        break
      }
      case ACTION_TYPES.forageberry:
        this.startGathering(LOADING_TYPES.berry, this.getWorkSound('forageBerry', SOUND_CUES.villager.forageBerry), {
          onDepleted: dest => {
            markBerrybushDepleted(dest)
            showDepletedBerrybushMessage(unit, dest)
          },
        })
        break
      case ACTION_TYPES.minestone:
      case ACTION_TYPES.minegold:
      case ACTION_TYPES.minecopper:
      case ACTION_TYPES.mineiron:
        this.startMiningResource(unit.action)
        break
      case ACTION_TYPES.build: {
        if (!unit.getActionCondition?.(unit.dest)) {
          unit.affectNewDest?.()
          return
        }
        unit.setTextures?.(SHEET_TYPES.action)
        if (!unit.sprite) return
        lockManualHeroAction(unit)
        onSpriteLoopAtFrame(unit.sprite, SLASH_IMPACT_FRAME, () => {
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
          if (isManualHeroActionReleased(unit)) stopManualHeroActionAfterLoop(unit)
        })
        break
      }
      case ACTION_TYPES.attack:
        unit.unitCombat?.handleAttackAction()
        break
      case ACTION_TYPES.train: {
        if (
          !unit.getActionCondition?.(unit.dest, ACTION_TYPES.train, { trainingType: unit.trainingTargetType ?? '' })
        ) {
          unit.affectNewDest?.()
          return
        }
        const dest = isBuildingEntity(unit.dest) ? unit.dest : null
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
          unit.affectNewDest?.()
        }
        break
      }
      case ACTION_TYPES.heal:
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
          if (unit.destHasMoved?.() && dest && unit.realDest) {
            unit.realDest.i = dest.i
            unit.realDest.j = dest.j
            unit.realDest.x = dest.x
            unit.realDest.y = dest.y
            const oldDeg = unit.degree
            unit.degree = getInstanceDegree(unit, dest.x, dest.y)
            if (degreeToDirection(oldDeg ?? 0) !== degreeToDirection(unit.degree ?? 0)) {
              unit.setTextures?.(SHEET_TYPES.action)
            }
          }
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
        break
      case ACTION_TYPES.convert:
        if (!unit.getActionCondition?.(unit.dest)) {
          const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
          if (dest) debugConversionFailure(unit, dest, 'action-condition-failed', { stage: 'start' })
          unit.affectNewDest?.()
          return
        }
        unit.conversionChants = 0
        unit.setTextures?.(SHEET_TYPES.action)
        sprite.onLoop = () => {
          const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
          if (!unit.getActionCondition?.(dest)) {
            if (dest) debugConversionFailure(unit, dest, 'action-condition-failed', { stage: 'loop' })
            unit.affectNewDest?.()
            return
          }
          if (unit.destHasMoved?.() && dest && unit.realDest) {
            unit.realDest.i = dest.i
            unit.realDest.j = dest.j
            unit.realDest.x = dest.x
            unit.realDest.y = dest.y
            const oldDeg = unit.degree
            unit.degree = getInstanceDegree(unit, dest.x, dest.y)
            if (degreeToDirection(oldDeg ?? 0) !== degreeToDirection(unit.degree ?? 0)) {
              unit.setTextures?.(SHEET_TYPES.action)
            }
          }
          if (!unit.isUnitAtDest?.(unit.action, dest)) {
            unit.sendToEvt?.(dest ?? null, ACTION_TYPES.convert, { forceRepath: true })
            return
          }

          if (!spendOrWaitForEnergy(unit, unit.action, dest)) return
          this.playSound(unit.sounds?.convert)
          unit.conversionChants = (unit.conversionChants || 0) + 1
          const { minChants, chance } = this.getConversionRules()
          if (unit.conversionChants >= minChants && map && map.random() < chance && dest) {
            this.convertTarget(dest)
          }
        }
        break
      case ACTION_TYPES.takemeat:
        this.startGathering(LOADING_TYPES.meat, this.getWorkSound('takeMeat', SOUND_CUES.villager.takeMeat), {
          checkOwner: true,
          updateTexture: true,
        })
        break
      case ACTION_TYPES.hunt: {
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
            if (unit.context?.map?.revealEverything || (dest && playerCanSeeInstance(dest, unit.owner))) {
              unit.sendToEvt?.(dest ?? null, ACTION_TYPES.hunt, { forceRepath: true })
            } else {
              unit.stop?.()
            }
            return
          }
          if (unit.destHasMoved?.() && dest && unit.realDest) {
            unit.realDest.i = dest.i
            unit.realDest.j = dest.j
            unit.realDest.x = dest.x
            unit.realDest.y = dest.y
            const oldDeg = unit.degree
            unit.degree = getInstanceDegree(unit, dest.x, dest.y)
            if (degreeToDirection(oldDeg ?? 0) !== degreeToDirection(unit.degree ?? 0)) {
              unit.setTextures?.(SHEET_TYPES.action)
            }
          }
        }
        if (unit.sprite) {
          onSpriteLoopAtFrame(unit.sprite, BOW_SHOOT_RELEASE_FRAME, () => {
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
        break
      }
      case ACTION_TYPES.captureHorse: {
        const unitContext = unit.context
        if (!unitContext) {
          unit.affectNewDest?.()
          return
        }
        const unitDest = isRuntimeEntity(unit.dest) ? unit.dest : null
        const heroLassoTarget = getHeroLassoTarget(unit)
        const now = unitContext.scheduler?.elapsedMs ?? Date.now()
        const captureHorseState = getCaptureHorseActionState(unit)
        const clearStableRoute = () => {
          getHeroCaptureLasso(unit)?.setExternalStableRouteActive(false)
          if (captureHorseState.stableRouteStop) {
            captureHorseState.stableRouteStop()
            captureHorseState.stableRouteStop = null
          }
          captureHorseState.stableRouteHorseLabel = null
        }
        const stableTarget = unitDest?.family === FAMILY_TYPES.building ? (unitDest as BuildingEntity) : null
        const horse = isHorseEntity(unitDest) ? unitDest : isHorseEntity(heroLassoTarget) ? heroLassoTarget : null
        if (!horse || horse.isDead || horse.isDestroyed) {
          clearStableRoute()
          resetCaptureHorseActionState(unit, horse)
          unit.affectNewDest?.()
          return
        }

        const lassoOwner = getHorseLassoOwner(horse)
        if (!horse.isLassoed && lassoOwner?.label === unit.label) {
          horse.lassoOwner = null
        }
        if (horse.isLassoed && !lassoOwner) {
          horse.isLassoed = false
          clearStableRoute()
          captureHorseState.lastLassoAttemptAt = 0
          captureHorseState.lastRepathAt = 0
          resetCaptureHorseActionState(unit, horse)
          unit.affectNewDest?.()
          return
        }
        const isLassoedByOther = Boolean(horse.isLassoed && lassoOwner && lassoOwner.label !== unit.label)
        if (isLassoedByOther) {
          clearStableRoute()
          resetCaptureHorseActionState(unit)
          unit.affectNewDest?.()
          return
        }
        ensureCaptureHorseTick(unit, captureHorseState)

        const heroCaptureLasso = getHeroCaptureLasso(unit)
        const lassoTarget = (heroCaptureLasso as HeroLassoWithTarget | null)?.target
        if (
          heroCaptureLasso &&
          heroCaptureLasso.state !== 'retracting' &&
          isRuntimeEntity(lassoTarget) &&
          lassoTarget.label !== horse.label
        ) {
          heroCaptureLasso.clearLasso?.({ releaseHorse: false })
        }
        const hasActiveCaptureLasso =
          unit.action === ACTION_TYPES.captureHorse &&
          Boolean(
            heroCaptureLasso &&
              heroCaptureLasso.state !== 'retracting' &&
              (!isRuntimeEntity(lassoTarget)
                ? unitDest?.label === horse.label
                : lassoTarget.label === horse.label)
          )
        const isHeroLassoOwner = horse.isLassoed && horse.type === 'Horse' && lassoOwner?.label === unit.label
        const isCapturing = isHeroLassoOwner || hasActiveCaptureLasso

        if (stableTarget) {
          if (!isCapturing || !horse.isLassoed) {
            clearStableRoute()
            unit.affectNewDest?.()
            unit.sendToEvt?.(horse, ACTION_TYPES.captureHorse, { forceRepath: true })
            return
          }
          if (unit.isUnitAtDest?.(unit.action, stableTarget)) {
            unit.setTextures?.(SHEET_TYPES.standing)
          } else if ((unit.path?.length ?? 0) === 0) {
            unit.sendToEvt?.(stableTarget, ACTION_TYPES.captureHorse, { forceRepath: true })
          }
          return
        }

        if (!isCapturing && !unit.getActionCondition?.(horse, ACTION_TYPES.captureHorse)) {
          clearStableRoute()
          resetCaptureHorseActionState(unit, horse)
          unit.affectNewDest?.()
          return
        }

        unit.setTextures?.(SHEET_TYPES.action)

        if (!unit.isUnitAtDest?.(unit.action, horse)) {
          unit.sendToEvt?.(horse, ACTION_TYPES.captureHorse, { forceRepath: true })
          return
        }

        if (unit.destHasMoved?.() && horse && unit.realDest) {
          unit.realDest.i = horse.i
          unit.realDest.j = horse.j
          unit.realDest.x = horse.x
          unit.realDest.y = horse.y
          const oldDeg = unit.degree
          unit.degree = getInstanceDegree(unit, horse.x, horse.y)
          if (degreeToDirection(oldDeg ?? 0) !== degreeToDirection(unit.degree ?? 0)) {
            unit.setTextures?.(SHEET_TYPES.action)
          }
        }

        if (!isCapturing && !hasActiveCaptureLasso && unit.context && horse) {
          if (now - captureHorseState.lastRepathAt > CAPTURE_HORSE_REPATH_INTERVAL_MS) {
            unit.sendToEvt?.(horse, ACTION_TYPES.captureHorse, { forceRepath: true })
            captureHorseState.lastRepathAt = now
          }
          if (now - captureHorseState.lastLassoAttemptAt < CAPTURE_HORSE_RETRY_INTERVAL_MS) return
          captureHorseState.lastLassoAttemptAt = now
          const lasso = new HeroLassoThrow(unit, { x: horse.x, y: horse.y }, unit.context, {
            pullCapturedHorseToOwner: true,
            allowStableOnRelease: false,
            releaseHorseOnClear: false,
            autoRouteStableWhileAttached: false,
            showMessages: unit.owner?.isPlayed,
          })
          unit.context.map?.addChild(lasso)
          return
        }

        if (!horse.isLassoed) {
          clearStableRoute()
          captureHorseState.lastRepathAt = now
          return
        }

        const stable = getNearestAvailableStableForUnit(unit, horse)
        if (!stable) {
          clearStableRoute()
          unit.affectNewDest?.()
          resetCaptureHorseActionState(unit, horse)
          return
        }

        if (captureHorseState.stableRouteHorseLabel !== horse.label) {
          clearStableRoute()
        }
        if (!captureHorseState.stableRouteStop) {
          captureHorseState.stableRouteHorseLabel = horse.label
          captureHorseState.stableRouteStop = routeCapturedHorseToStableWithOwnerContact({
            gameContext: unitContext,
            owner: unit,
            horse,
            ownerContactTimeoutMs: getCaptureHorseOwnerStableTimeoutMs(unit, stable),
            isRouteValid: () =>
              Boolean(horse.isLassoed && getHorseLassoOwner(horse)?.label === unit.label),
            onHorseRouteStart: () => {
              getHeroCaptureLasso(unit)?.setExternalStableRouteActive(true)
            },
            onStored: () => {
              horse.isLassoed = false
              horse.lassoOwner = null
              clearStableRoute()
              unit.heroLasso?.clearLasso?.({ releaseHorse: false })
              if (unit.action === ACTION_TYPES.captureHorse) {
                unit.affectNewDest?.()
              }
            },
            onFailure: () => {
              clearStableRoute()
              horse.isLassoed = false
              horse.lassoOwner = null
              unit.heroLasso?.clearLasso?.({ releaseHorse: false })
              if (unit.action === ACTION_TYPES.captureHorse) {
                if (unit.getActionCondition?.(horse, ACTION_TYPES.captureHorse)) {
                  unit.sendToEvt?.(horse, ACTION_TYPES.captureHorse, { forceRepath: true })
                } else {
                  unit.affectNewDest?.()
                }
              }
            },
          })
        }

        const shouldMoveToStable =
          !stableTarget &&
          (unitDest?.label !== stable.label ||
            ((unit.path?.length ?? 0) === 0 && !unit.isUnitAtDest?.(ACTION_TYPES.captureHorse, stable)))
        if (shouldMoveToStable) {
          unit.sendToEvt?.(stable, ACTION_TYPES.captureHorse, { forceRepath: true })
        }
        break
      }
      default:
        unit.stop?.()
    }
  }
}
