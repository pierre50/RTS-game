import {
  ACTION_TYPES,
  MENU_INFO_IDS,
  MINING_RESOURCE_CONFIG,
  SHEET_TYPES,
  UNIT_TYPES,
  WORK_TYPES,
} from '../../constants'
import { getAutonomyJobForWork, setVillagerAutonomy } from '../../lib'
import { t } from '../../lib/lang'
import { isHeroControlled } from '../../lib/units/unitControl'
import { applyUnitWorkAssets } from '../../lib/units/unitWorkAppearance'
import { logGoldMinerFlow } from '../../lib/units/villagerJobDiagnostics'
import {
  findResourceDeliveryTarget,
  unitHasDeliverableResources,
  unitHasDeliverableResourcesForBuilding,
} from '../../lib/resources/resourceDelivery'
import type {
  BuildingEntity,
  RuntimeEntity,
  UnitCreationExtra,
  UnitEntity,
  UnitResourceDeliveryReturnTask,
} from '../../types/entities'
import type { ActionProps } from '../../lib/combat'

type ActionConditionChecker = (
  source: UnitEntity,
  target: object | null | undefined,
  action?: string,
  props?: ActionProps | UnitCreationExtra
) => boolean

function isRuntimeEntity(value: UnitEntity['dest'] | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

// Applies the work/texture bookkeeping a work reassignment needs. Extracted out of
// commonSendTo so hero-direct triggers can reuse it without command-queue machinery.
export function applyWorkForAction(unit: UnitEntity, work: string, action: string | null): void {
  const menu = unit.context?.menu
  if (unit.work === work && unit.action === action) return
  unit.work = work
  if (unit.owner?.isPlayed && unit.owner.selectedUnit === unit) {
    menu?.updateInfo?.(MENU_INFO_IDS.type, t(unit.type === UNIT_TYPES.villager ? unit.work || unit.type : unit.type))
  }
  applyUnitWorkAssets(unit, work, { action, refreshEquipmentStats: true })
  // If the unit is already moving when AI/job assignment changes its role,
  // refresh the walking animation immediately so the sprite matches the new work.
  if (unit.path?.length) {
    unit.setTextures?.(SHEET_TYPES.walking)
  }
}

function isGatherAction(action: string | null | undefined): boolean {
  if (!action) return false
  if (
    action === ACTION_TYPES.farm ||
    action === ACTION_TYPES.forageberry ||
    action === ACTION_TYPES.takemeat ||
    action === ACTION_TYPES.chopwood
  ) {
    return true
  }
  return Object.values(MINING_RESOURCE_CONFIG ?? {}).some(config => config.action === action)
}

function shouldDeliverBeforeGatherJobSwitch(unit: UnitEntity, work: string, action: string | null): boolean {
  if (unit.type !== UNIT_TYPES.villager || isHeroControlled(unit) || unit.isDead) return false
  if (unit.action === ACTION_TYPES.delivery || unit.resourceDeliveryState) return false
  if (!isGatherAction(action) || !unitHasDeliverableResources(unit)) return false

  const currentJob = unit.autonomousJob ?? getAutonomyJobForWork?.(unit.work) ?? null
  const nextJob = getAutonomyJobForWork?.(work) ?? null
  return Boolean(currentJob && nextJob && currentJob !== nextJob)
}

export function getDeliveryBeforeGatherJobSwitch(
  unit: UnitEntity,
  target: RuntimeEntity,
  work: string,
  action: string | null
): { target: BuildingEntity; returnTask: UnitResourceDeliveryReturnTask } | null {
  if (!shouldDeliverBeforeGatherJobSwitch(unit, work, action)) return null
  const deliveryTarget = findResourceDeliveryTarget(unit)
  if (!deliveryTarget) return null
  return {
    target: deliveryTarget,
    returnTask: {
      action,
      autonomousJob: getAutonomyJobForWork?.(work) ?? null,
      dest: target,
      work,
    },
  }
}

export function sendUnitToDelivery(
  unit: UnitEntity,
  checkActionCondition: ActionConditionChecker,
  target: BuildingEntity | null = null,
  returnTaskOverride: UnitResourceDeliveryReturnTask | null = null
): boolean {
  if (unit.type !== UNIT_TYPES.villager || isHeroControlled(unit) || unit.isDead) return false
  const deliveryTarget = target ?? findResourceDeliveryTarget(unit)
  if (!deliveryTarget || !unitHasDeliverableResourcesForBuilding(unit, deliveryTarget)) return false
  if (!checkActionCondition(unit, deliveryTarget, ACTION_TYPES.delivery)) return false

  const previousDest = isRuntimeEntity(unit.dest) && unit.dest !== deliveryTarget ? unit.dest : null
  const previousWork = unit.work ?? null
  const previousAction = unit.action ?? null
  const previousAutonomousJob = unit.autonomousJob ?? null
  unit.handleChangeDest?.()
  unit.previousDest = previousDest
  unit.previousWork = previousWork
  unit.resourceDeliveryState = {
    building: deliveryTarget,
    phase: 'toBuilding',
    returnTask: returnTaskOverride
      ? returnTaskOverride
      : previousDest
        ? {
            action: previousAction,
            autonomousJob: previousAutonomousJob,
            dest: previousDest,
            work: previousWork,
          }
        : null,
  }
  logGoldMinerFlow(unit, 'delivery.started', { deliveryTarget: deliveryTarget.label })
  applyWorkForAction(unit, previousWork ?? WORK_TYPES.forager, ACTION_TYPES.delivery)
  setVillagerAutonomy?.(unit, getAutonomyJobForWork?.(previousWork) ?? unit.autonomousJob ?? null)
  unit.sendToEvt?.(deliveryTarget, ACTION_TYPES.delivery, { forceRepath: true, preserveAutonomy: true })
  return true
}
