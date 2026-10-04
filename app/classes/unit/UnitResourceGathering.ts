import { getForgeGatherBonus } from '../../lib/equipment/forgeUpgrades'
import { notifyVillageWorkChanged } from '../../lib/units/village/villageWorkEvents'
import { collectiveHarvestBudget } from '../../lib/economy/collectiveTasks'
import { getWorkGatherAmount, getResourceGatherSwings } from '../../lib/economy/workRules'
import {
  LOADING_TYPES,
  RESOURCE_STOCKPILE_TYPES,
  RESOURCE_TYPES,
  SOUND_CUES,
  WILDGRASS_RESOURCE_TYPES,
} from '../../constants'
import {
  getResourceKeyForLoadingType,
  getUnitResourceCapacityRemaining,
  isUnitResourceCarryFull,
  unitShouldDeliverResource,
} from '../../lib/resources/resourceDelivery'
import { getGatherXpBonus } from '../../lib/units/unitExperience'
import { spawnWorkImpactFragments } from '../../lib/entities/workImpactFragments'
import { t } from '../../lib/lang'
import type { BuildingEntity, ResourceEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { UnitResourceActions } from './UnitResourceActions'

const DEPLETED_BERRYBUSH_HIT_POINTS = 4

export function isRuntimeEntity(value: UnitEntity['dest'] | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

export function isBuildingEntity(value: UnitEntity['dest'] | null | undefined): value is BuildingEntity {
  return isRuntimeEntity(value) && value.family === 'building'
}

export function isResourceEntity(value: UnitEntity['dest'] | null | undefined): value is ResourceEntity {
  return isRuntimeEntity(value) && value.family === 'resource'
}

function isWildgrassResource(value: RuntimeEntity | null | undefined): boolean {
  return Boolean(value && WILDGRASS_RESOURCE_TYPES.has(value.type))
}

function getForageLoadingType(target: RuntimeEntity | null): string {
  return (
    (target?.type && RESOURCE_STOCKPILE_TYPES[target.type as keyof typeof RESOURCE_STOCKPILE_TYPES]) ||
    LOADING_TYPES.berry
  )
}

export function startForageResourceAction(actions: UnitResourceActions): void {
  const { unit } = actions
  const target = isResourceEntity(unit.dest) ? unit.dest : null
  const sound = isWildgrassResource(target)
    ? actions.getWorkSound('gatherFood', SOUND_CUES.villager.gatherFood)
    : actions.getWorkSound('forageBerry', SOUND_CUES.villager.forageBerry)
  actions.startGathering(getForageLoadingType(target), sound, {
    dieOnEmpty: target?.type !== RESOURCE_TYPES.berrybush,
    onImpact: target => spawnWorkImpactFragments(unit, target),
    onDepleted: dest => {
      if (dest.type === RESOURCE_TYPES.berrybush) {
        markBerrybushDepleted(dest)
      }
    },
  })
}

function isDepletedBerrybush(value: RuntimeEntity | null | undefined): value is RuntimeEntity {
  return Boolean(RESOURCE_TYPES.berrybush && value?.type === RESOURCE_TYPES.berrybush && (value.quantity ?? 0) <= 0)
}

export function isChoppableBerrybush(value: RuntimeEntity | null | undefined): boolean {
  return isDepletedBerrybush(value) && (value.hitPoints ?? 0) > 0
}

function showHeroResourceCarryFullMessage(unit: UnitEntity): void {
  if (unit.owner?.isPlayed) unit.context?.menu?.showMessage(t('heroBagFull'), 'warning')
}

export function notifyIfHeroResourceCarryFull(unit: UnitEntity): void {
  if (isUnitResourceCarryFull(unit)) showHeroResourceCarryFullMessage(unit)
}

function markBerrybushDepleted(target: RuntimeEntity): void {
  if (!isDepletedBerrybush(target)) return
  target.totalHitPoints = Math.min(
    target.totalHitPoints ?? DEPLETED_BERRYBUSH_HIT_POINTS,
    DEPLETED_BERRYBUSH_HIT_POINTS
  )
  target.hitPoints = Math.min(target.hitPoints ?? DEPLETED_BERRYBUSH_HIT_POINTS, DEPLETED_BERRYBUSH_HIT_POINTS)
  target.updateTexture?.()
}

export function clampDepletedBerrybushHitPoints(target: RuntimeEntity): void {
  if (!isChoppableBerrybush(target)) return
  markBerrybushDepleted(target)
}

export function isFarmHarvestTarget(
  value: UnitEntity['dest'] | null | undefined
): value is BuildingEntity | ResourceEntity {
  return isResourceEntity(value) && value.type === RESOURCE_TYPES.wheat
}

export function getGatherAmount(unit: UnitEntity): number {
  return getWorkGatherAmount(
    unit.gatherAmount,
    unit.work ?? '',
    getGatherXpBonus(unit) + getForgeGatherBonus(unit.owner, unit.work ?? '', unit.type)
  )
}

export function addGatheredResource(unit: UnitEntity, loadingType: string, amount: number): number {
  const resourceKey = getResourceKeyForLoadingType(loadingType)
  const gatheredAmount = Math.min(
    Math.max(0, Math.floor(amount)),
    getUnitResourceCapacityRemaining(unit, loadingType),
    resourceKey && unit.owner ? collectiveHarvestBudget(unit.owner, unit, resourceKey) : Infinity
  )
  if (!resourceKey || gatheredAmount <= 0) return 0
  unit.inventory = unit.inventory ?? {}
  unit.inventory.resources = unit.inventory.resources ?? {}
  unit.inventory.resources[resourceKey] = (unit.inventory.resources[resourceKey] ?? 0) + gatheredAmount
  if (unit.context?.controls?.heroUnit === unit) {
    unit.context.menu?.refreshInventory?.()
  }
  notifyVillageWorkChanged(unit.owner)
  return gatheredAmount
}

export function sendVillagerToDeliveryIfFull(unit: UnitEntity, loadingType: string): boolean {
  if (!unitShouldDeliverResource(unit, loadingType)) return false
  if (unit.sendToDelivery?.() === true) return true
  return false
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

export function shouldReleaseGatheredResource(
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
