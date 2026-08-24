import { Assets } from 'pixi.js'
import { ACTION_TYPES, FAMILY_TYPES, LOADING_TYPES, MINING_RESOURCE_CONFIG, SHEET_TYPES, WORK_TYPES } from '../constants'
import { isHeroInteractionTargetReachable } from './heroActionRange'
import { getActionCondition, isWheatMature } from './combat'
import { findInstancesInSight } from './grid/visibility'
import { t } from './lang'
import { buildingAcceptsCarriedResources, getCarriedResourceSpace, getTotalCarriedResources } from './resourceCarry'
import { hasEnergyForAction } from './unitEnergy'
import { applyWorkForAction } from '../classes/unit/UnitCommands'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { HeroContextAction } from '../types/heroTools'
import { CLICK_TARGET_SEARCH_RANGE, getDirectionalTarget, getDirectionalTargets, getHeroAimDegree } from './heroTargeting'

type DeliveryAimResult = 'delivered' | 'blocked' | 'none'
type ToolActionResult = 'triggered' | 'blocked' | 'miss'

function resourceKind(target: RuntimeEntity): string | undefined {
  return target.category || target.type
}

function buildingAcceptsCarriedResource(hero: UnitEntity, target: RuntimeEntity): target is BuildingEntity {
  return buildingAcceptsCarriedResources(hero, target)
}

type HeroContextActionConfig = {
  action: HeroContextAction
  matches: (target: RuntimeEntity) => boolean
  resolve: (hero: UnitEntity, target: RuntimeEntity) => (() => void) | null
}
type MiningHeroConfig = {
  action: string
  loadingType: string
  work: string
}

function getMiningResourceConfigMap(): Record<string, MiningHeroConfig> {
  const configured = MINING_RESOURCE_CONFIG ?? {}
  if (Object.keys(configured).length) return configured
  return {
    Stone: { action: ACTION_TYPES.minestone, loadingType: LOADING_TYPES.stone, work: WORK_TYPES.stoneminer },
    Gold: { action: ACTION_TYPES.minegold, loadingType: LOADING_TYPES.gold, work: WORK_TYPES.goldminer },
  }
}

function getMiningResourceConfig(target: RuntimeEntity): MiningHeroConfig | undefined {
  return getMiningResourceConfigMap()[resourceKind(target) ?? '']
}

function runHeroAction(hero: UnitEntity, target: RuntimeEntity, action: string): void {
  if (hero.actionLocked) return
  hero.setDest?.(target)
  hero.action = action
  hero.degree = getHeroAimDegree(hero, target)
  hero.getAction?.(action)
}

function refreshHeroActionSheet(hero: UnitEntity, work: string, action: string): void {
  const actionSheet = action === ACTION_TYPES.takemeat ? SHEET_TYPES.harvest : SHEET_TYPES.action
  const asset = hero.allAssets?.[work]?.[actionSheet]
  if (!asset) return
  const sheet = Assets.cache.get(asset)
  if (sheet) hero.actionSheet = sheet
}

function runHeroGatherAction(hero: UnitEntity, target: RuntimeEntity, action: string, work: string): void {
  if (hero.actionLocked) return
  applyWorkForAction(hero, work, action)
  refreshHeroActionSheet(hero, work, action)
  runHeroAction(hero, target, action)
}

function getLoadingTypeForAction(action: string): string | null {
  const miningConfig = Object.values(getMiningResourceConfigMap()).find(config => config.action === action)
  if (miningConfig) return miningConfig.loadingType
  switch (action) {
    case ACTION_TYPES.chopwood:
      return LOADING_TYPES.wood
    case ACTION_TYPES.forageberry:
      return LOADING_TYPES.berry
    case ACTION_TYPES.takemeat:
      return LOADING_TYPES.meat
    case ACTION_TYPES.farm:
      return LOADING_TYPES.wheat
    default:
      return null
  }
}

function heroHasGatherSpace(hero: UnitEntity, action: string): boolean {
  const loadingType = getLoadingTypeForAction(action)
  if (!loadingType) return true
  return getCarriedResourceSpace(hero, loadingType) > 0
}

function canShowTargetAlert(hero: UnitEntity, target: RuntimeEntity): boolean {
  return Boolean(hero.owner?.isPlayed && (hero.context?.controls?.instanceInCamera?.(target) ?? true))
}

function resolveHeroGatherAction(
  hero: UnitEntity,
  target: RuntimeEntity,
  action: string,
  work: string
): (() => void) | null {
  if (!getActionCondition(hero, target, action)) {
    if (
      action === ACTION_TYPES.farm &&
      resourceKind(target) === 'Wheat' &&
      !isWheatMature(target) &&
      canShowTargetAlert(hero, target)
    ) {
      hero.context?.menu?.showMessage(t('wheatNotReady'), 'warning')
    }
    return null
  }
  if (!heroHasGatherSpace(hero, action)) {
    hero.context?.menu?.showMessage(t('heroInventoryFull'), 'warning')
    return null
  }
  return () => runHeroGatherAction(hero, target, action, work)
}

const HERO_CONTEXT_ACTIONS: HeroContextActionConfig[] = [
  {
    action: 'gather',
    matches: target =>
      resourceKind(target) === 'Berrybush' ||
      resourceKind(target) === 'Wheat' ||
      (target.family === FAMILY_TYPES.animal && Boolean(target.isDead)),
    resolve: (hero, target) => {
      if (resourceKind(target) === 'Wheat') {
        return resolveHeroGatherAction(hero, target, ACTION_TYPES.farm, WORK_TYPES.farmer)
      }
      if (resourceKind(target) === 'Berrybush') {
        return getActionCondition(hero, target, ACTION_TYPES.forageberry)
          ? resolveHeroGatherAction(hero, target, ACTION_TYPES.forageberry, WORK_TYPES.forager)
          : null
      }
      return resolveHeroGatherAction(hero, target, ACTION_TYPES.takemeat, WORK_TYPES.hunter)
    },
  },
  {
    action: 'chop',
    matches: target => resourceKind(target) === 'Tree',
    resolve: (hero, target) => resolveHeroGatherAction(hero, target, ACTION_TYPES.chopwood, WORK_TYPES.woodcutter),
  },
  {
    action: 'mine',
    matches: target => Boolean(getMiningResourceConfig(target)),
    resolve: (hero, target) => {
      const config = getMiningResourceConfig(target)
      return config ? resolveHeroGatherAction(hero, target, config.action, config.work) : null
    },
  },
  {
    action: 'build',
    matches: target => {
      if (target.family !== FAMILY_TYPES.building) return false
      const building = target as BuildingEntity
      return !building.isBuilt || (building.hitPoints ?? 0) < (building.totalHitPoints ?? 0)
    },
    resolve: (hero, target) =>
      getActionCondition(hero, target, ACTION_TYPES.build)
        ? () => runHeroGatherAction(hero, target, ACTION_TYPES.build, WORK_TYPES.builder)
        : null,
  },
]

function checkHeroEnergy(hero: UnitEntity, action: string): boolean {
  if (hasEnergyForAction(hero, action)) return true
  if (hero.owner?.isPlayed) {
    hero.context?.menu?.showMessage(t('heroNotEnoughEnergy'), 'warning')
  }
  return false
}

function runContextAction(
  hero: UnitEntity,
  contextAction: HeroContextAction,
  unitAction: string,
  effect: () => void
): boolean {
  if (!checkHeroEnergy(hero, unitAction)) return false
  hero.contextAction = contextAction
  effect()
  return true
}

function canDeliverToBuilding(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (getTotalCarriedResources(hero) <= 0) return false
  if (!buildingAcceptsCarriedResource(hero, target)) return false
  if (!getActionCondition(hero, target, ACTION_TYPES.delivery, { buildingTypes: [target.type] })) return false
  if (!hero.isUnitAtDest?.(ACTION_TYPES.delivery, target)) return false
  return true
}

function deliverToBuilding(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (!canDeliverToBuilding(hero, target)) return false
  runHeroAction(hero, target, ACTION_TYPES.delivery)
  return true
}

function canAimDeliveryAtBuilding(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (getTotalCarriedResources(hero) <= 0) return false
  if (!buildingAcceptsCarriedResource(hero, target)) return false
  return getActionCondition(hero, target, ACTION_TYPES.delivery, { buildingTypes: [target.type] })
}

export function tryDeliverAt(hero: UnitEntity): DeliveryAimResult {
  if (getTotalCarriedResources(hero) <= 0) return 'none'
  const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(
    hero,
    target => canAimDeliveryAtBuilding(hero, target),
    CLICK_TARGET_SEARCH_RANGE
  )

  const target = getDirectionalTarget(hero, candidates)
  if (!target) return 'none'
  return deliverToBuilding(hero, target) ? 'delivered' : 'blocked'
}

function getContextActionForTarget(contextAction: HeroContextAction, target: RuntimeEntity): string | null {
  if (contextAction === 'gather' && resourceKind(target) === 'Wheat') return ACTION_TYPES.farm
  if (contextAction === 'gather' && resourceKind(target) === 'Berrybush') return ACTION_TYPES.forageberry
  if (contextAction === 'gather' && target.family === FAMILY_TYPES.animal && target.isDead) return ACTION_TYPES.takemeat
  if (contextAction === 'chop' && resourceKind(target) === 'Tree') return ACTION_TYPES.chopwood
  if (contextAction === 'mine') return getMiningResourceConfig(target)?.action ?? null
  if (contextAction === 'build' && target.family === FAMILY_TYPES.building) return ACTION_TYPES.build
  return null
}

function isContextActionTargetReachable(
  hero: UnitEntity,
  contextAction: HeroContextAction,
  target: RuntimeEntity
): boolean {
  const action = getContextActionForTarget(contextAction, target)
  if (!action) return false
  return isHeroInteractionTargetReachable(hero, action, target) || Boolean(hero.isUnitAtDest?.(action, target))
}

function blockContextActionWhileMounted(hero: UnitEntity): boolean {
  if (!hero.mountedOnHorse) return false
  if (hero.owner?.isPlayed) hero.context?.menu?.showMessage(t('heroCannotGatherMounted'), 'warning')
  return true
}

export function performContextActionAt(hero: UnitEntity): ToolActionResult {
  const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(
    hero,
    target => HERO_CONTEXT_ACTIONS.some(config => config.matches(target)),
    CLICK_TARGET_SEARCH_RANGE
  )

  for (const target of getDirectionalTargets(hero, candidates)) {
    const config = HERO_CONTEXT_ACTIONS.find(candidate => candidate.matches(target))
    if (!config) continue
    if (!isContextActionTargetReachable(hero, config.action, target)) continue
    if (blockContextActionWhileMounted(hero)) return 'miss'
    const unitAction = getContextActionForTarget(config.action, target)
    if (!unitAction) continue
    const action = config.resolve(hero, target)
    if (action) return runContextAction(hero, config.action, unitAction, action) ? 'triggered' : 'blocked'
    return 'blocked'
  }

  return 'miss'
}
