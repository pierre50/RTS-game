import { ACTION_TYPES, FAMILY_TYPES } from '../constants'
import { getEntityCell } from '../mapSpaces'
import { assignVillagerAutonomy } from './villagerAutonomy'
import { getAutonomyJobForWork } from './villagerAutonomyTargeting'
import { logGoldMinerFlow } from './villagerJobDiagnostics'
import { sendUnitToMiningAction } from './miningActions'
import type { BuildingEntity, RuntimeEntity, UnitEntity, UnitResourceDeliveryReturnTask } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

export type VillagerStoredTask = UnitResourceDeliveryReturnTask

type ResumeStoredTaskOptions = {
  clearMotion?: boolean
  exploreWhenNoTarget?: boolean
  fallbackToAutonomy?: boolean
  preserveAutonomy?: boolean
}

function isRuntimeEntity(value: RuntimeEntity | RuntimeCell | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value))
}

function isBuildingEntity(value: RuntimeEntity | RuntimeCell | null | undefined): value is BuildingEntity {
  return isRuntimeEntity(value) && value.family === FAMILY_TYPES.building
}

function getStoredTaskAutonomyJob(
  unit: UnitEntity,
  task: VillagerStoredTask | null | undefined
): UnitEntity['autonomousJob'] {
  return task?.autonomousJob ?? getAutonomyJobForWork(task?.work) ?? unit.autonomousJob ?? null
}

function canUseStoredDestination(
  unit: UnitEntity,
  dest: RuntimeEntity | RuntimeCell | null | undefined,
  action: string | null | undefined
): dest is RuntimeEntity | RuntimeCell {
  if (!dest) return false
  if (!isRuntimeEntity(dest)) return true
  if (dest.isDestroyed || dest.isDead) return false
  if (action && unit.getActionCondition?.(dest, action) === false) return false
  return true
}

function sendToDestinationCell(unit: UnitEntity, dest: RuntimeEntity, action: string | null | undefined): boolean {
  const map = unit.context?.map
  const cell = map ? getEntityCell(dest, map) : null
  if (!cell) return false
  return issueTaskCommand(
    unit,
    cell,
    action ?? null,
    unit.sendToEvt
      ? () => unit.sendToEvt?.(cell, action ?? null, { forceRepath: true, preserveAutonomy: true })
      : null
  )
}

function sameDestination(
  current: RuntimeEntity | RuntimeCell | null | undefined,
  expected: RuntimeEntity | RuntimeCell
): boolean {
  if (current === expected) return true
  if (!current || !('label' in current) || !('label' in expected)) return false
  return Boolean(current.label && expected.label && current.label === expected.label)
}

function taskCommandWasAccepted(
  unit: UnitEntity,
  dest: RuntimeEntity | RuntimeCell,
  action: string | null,
  result: unknown
): boolean {
  if (result === false) return false
  if (sameDestination(unit.dest, dest) && (!action || unit.action === action)) return true
  if (
    isRuntimeEntity(dest) &&
    sameDestination(unit.blockedGatherApproach?.target, dest) &&
    unit.blockedGatherApproach?.action === action
  ) {
    return true
  }
  return Boolean(action && unit.isUnitAtDest?.(action, dest) && unit.action === action)
}

function issueTaskCommand(
  unit: UnitEntity,
  dest: RuntimeEntity | RuntimeCell,
  action: string | null,
  command: (() => unknown) | null
): boolean {
  if (!command) return false
  return taskCommandWasAccepted(unit, dest, action, command())
}

function routeStoredTask(unit: UnitEntity, task: VillagerStoredTask, dest: RuntimeEntity | RuntimeCell): boolean {
  const action = task.action ?? null
  if (!isRuntimeEntity(dest)) {
    return issueTaskCommand(
      unit,
      dest,
      action,
      unit.sendToEvt
        ? () => unit.sendToEvt?.(dest, action, { forceRepath: true, preserveAutonomy: true })
        : null
    )
  }

  switch (action) {
    case ACTION_TYPES.farm:
      return issueTaskCommand(unit, dest, action, unit.sendToFarm ? () => unit.sendToFarm?.(dest, true) : null)
    case ACTION_TYPES.forageberry:
      return issueTaskCommand(unit, dest, action, unit.sendToBerrybush ? () => unit.sendToBerrybush?.(dest, true) : null)
    case ACTION_TYPES.chopwood:
      return issueTaskCommand(unit, dest, action, unit.sendToTree ? () => unit.sendToTree?.(dest, true) : null)
    case ACTION_TYPES.takemeat:
      return issueTaskCommand(unit, dest, action, unit.sendToTakeMeat ? () => unit.sendToTakeMeat?.(dest, true) : null)
    case ACTION_TYPES.minestone:
    case ACTION_TYPES.minegold:
    case ACTION_TYPES.minecopper:
    case ACTION_TYPES.mineiron:
      return issueTaskCommand(unit, dest, action, () => sendUnitToMiningAction(unit, dest, action, true))
    case ACTION_TYPES.build:
      if (isBuildingEntity(dest)) {
        return issueTaskCommand(unit, dest, action, unit.sendToBuilding ? () => unit.sendToBuilding?.(dest) : null)
      }
      return sendToDestinationCell(unit, dest, action)
    default: {
      return issueTaskCommand(
        unit,
        dest,
        action,
        unit.sendToEvt
          ? () => unit.sendToEvt?.(dest, action, { forceRepath: true, preserveAutonomy: true })
          : null
      )
    }
  }
}

function clearMotionForStoredTask(unit: UnitEntity): void {
  unit.previousDest = null
  unit.previousWork = null
  unit.handleChangeDest?.()
  unit.dest = null
  unit.path = []
}

export function resumeStrictVillagerAutonomy(
  unit: UnitEntity,
  job: UnitEntity['autonomousJob'] = unit.autonomousJob ?? null,
  options: { exploreWhenNoTarget?: boolean } = {}
): boolean {
  if (!job) return false
  unit.autonomousJob = job
  return assignVillagerAutonomy(unit, job, {
    exploreWhenNoTarget: options.exploreWhenNoTarget ?? true,
    preserveRejectedTargets: true,
  })
}

export function resumeVillagerJobIntent(
  unit: UnitEntity,
  task: VillagerStoredTask | null | undefined = null,
  options: Pick<ResumeStoredTaskOptions, 'clearMotion' | 'preserveAutonomy'> = {}
): boolean {
  const autonomousJob = getStoredTaskAutonomyJob(unit, task)
  logGoldMinerFlow(unit, 'job.resume.requested', { resolvedJob: autonomousJob }, task)
  if (options.clearMotion ?? true) clearMotionForStoredTask(unit)
  if (task?.work) unit.work = task.work
  if (options.preserveAutonomy !== false) unit.autonomousJob = autonomousJob

  if (task && canUseStoredDestination(unit, task.dest, task.action) && routeStoredTask(unit, task, task.dest)) {
    logGoldMinerFlow(unit, 'job.resume.previous-target-accepted', {}, task)
    return true
  }
  logGoldMinerFlow(unit, 'job.resume.previous-target-rejected', {}, task)
  const resumed = resumeStrictVillagerAutonomy(unit, autonomousJob, { exploreWhenNoTarget: true })
  logGoldMinerFlow(unit, resumed ? 'job.resume.autonomy-accepted' : 'job.resume.autonomy-stopped', {}, task)
  return resumed
}

export function resumeVillagerStoredTask(
  unit: UnitEntity,
  task: VillagerStoredTask | null | undefined,
  options: ResumeStoredTaskOptions = {}
): boolean {
  if (!task) return false
  if (options.exploreWhenNoTarget !== false && options.fallbackToAutonomy !== false) {
    return resumeVillagerJobIntent(unit, task, options)
  }
  const autonomousJob = getStoredTaskAutonomyJob(unit, task)
  if (options.clearMotion ?? true) clearMotionForStoredTask(unit)
  if (task.work) unit.work = task.work
  if (options.preserveAutonomy !== false) unit.autonomousJob = autonomousJob
  if (canUseStoredDestination(unit, task.dest, task.action) && routeStoredTask(unit, task, task.dest)) return true
  if (options.fallbackToAutonomy === false) return false
  return resumeStrictVillagerAutonomy(unit, autonomousJob, { exploreWhenNoTarget: options.exploreWhenNoTarget })
}
