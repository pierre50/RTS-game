import { updateTargetPursuit } from '../../../lib/units/targetPursuit'
import { scheduleVillagerExplorationResume } from '../../../lib/units/autonomy/villagerExploration'
import { isVillagerWorkTargetRejected } from '../../../lib/units/villagerAutonomyTargeting'
import { ACTION_TYPES, FAMILY_TYPES, SHEET_TYPES, UNIT_TYPES, WORK_TYPES } from '../../../constants'
import {
  findInstancesInSight,
  getClosestInstanceWithPath,
  getInstanceDegree,
  instanceContactInstance,
  resumeVillagerAutonomy,
  showConfusionFeedback,
} from '../../../lib'
import { isHeroControlled } from '../../../lib/units/unitControl'
import { isRecoveringAttack, isRuntimeEntity, pauseCombatRecoveryMove } from './UnitMovementHelpers'
import type { RuntimeEntity, UnitEntity } from '../../../types/entities'
import type { RuntimeCell } from '../../../types/map'

type BuildTarget = RuntimeEntity & {
  isBuilt?: boolean
  totalHitPoints?: number
}

function isBuildTarget(dest: RuntimeEntity | null): dest is BuildTarget {
  return dest?.family === FAMILY_TYPES.building
}

function isCompletedBuildTarget(unit: UnitEntity): boolean {
  const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
  return Boolean(
    unit.action === ACTION_TYPES.build &&
      isBuildTarget(dest) &&
      (dest.isBuilt || ((dest.hitPoints ?? 0) >= (dest.totalHitPoints ?? 0) && (dest.totalHitPoints ?? 0) > 0))
  )
}

export function affectNewDest(unit: UnitEntity): void {
  if (updateTargetPursuit(unit)) return
  unit.stopInterval?.()
  if (!unit.action) {
    handleIdleDestination(unit)
    return
  }
  if (isHeroControlled(unit)) {
    handleHeroDestination(unit)
    return
  }
  const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
  const queuedBuildInterrupted =
    unit.work === WORK_TYPES.builder && unit.action === ACTION_TYPES.build && (unit.buildQueue?.length ?? 0) > 0
  if (queuedBuildInterrupted) {
    handleInterruptedBuildQueue(unit, dest)
    return
  }

  const lostBuildTarget =
    unit.work === WORK_TYPES.builder &&
    unit.action === ACTION_TYPES.build &&
    (!dest || !unit.getActionCondition?.(dest, ACTION_TYPES.build))

  if (lostBuildTarget) {
    handleLostBuildTarget(unit)
    return
  }

  if (
    unit.previousDest &&
    (!isRuntimeEntity(unit.previousDest) || !isVillagerWorkTargetRejected(unit, unit.previousDest))
  ) {
    unit.goBackToPrevious?.()
    return
  }
  handleReplacementDestination(unit, dest, unit.action)
}

function handleReplacementDestination(unit: UnitEntity, dest: RuntimeEntity | null, action: string): void {
  let handleSuccess = false
  if (
    unit.type === UNIT_TYPES.villager &&
    (unit.action === ACTION_TYPES.takemeat || unit.action === ACTION_TYPES.hunt)
  ) {
    handleSuccess = Boolean(unit.handleAffectNewDestHunter?.())
  } else if (!dest || dest.family !== FAMILY_TYPES.animal) {
    if (trySetReplacementTarget(unit, action)) return
  }
  if (!handleSuccess) {
    if (unit.work === WORK_TYPES.builder && unit.previousWork) {
      unit.goBackToPrevious?.()
    } else if (resumeVillagerAutonomy?.(unit)) {
      return
    } else {
      showConfusionFeedback(unit)
      unit.stop?.()
    }
  }
}

function handleIdleDestination(unit: UnitEntity): void {
  if (unit.exploringForAutonomy) {
    unit.exploringForAutonomy = false
    unit.dest = null
    unit.realDest = null
    unit.path = []
    unit.inactif = true
    unit.sprite?.stop()
    unit.setTextures?.(SHEET_TYPES.standing)
    scheduleVillagerExplorationResume(unit, actor => resumeVillagerAutonomy?.(actor))
    return
  }
  if (isRecoveringAttack(unit)) {
    pauseCombatRecoveryMove(unit)
    return
  }
  if (resumeVillagerAutonomy?.(unit)) return
  unit.stop?.()
  return
}

function handleHeroDestination(unit: UnitEntity): void {
  if (isCompletedBuildTarget(unit)) {
    unit.previousDest = null
    unit.previousWork = null
    unit.stop?.()
    return
  }
  showConfusionFeedback(unit)
  unit.previousDest = null
  unit.previousWork = null
  unit.stop?.()
  return
}

function handleInterruptedBuildQueue(unit: UnitEntity, dest: RuntimeEntity | null): void {
  if (dest && unit.getActionCondition?.(dest, ACTION_TYPES.build) && unit.buildQueue) {
    const first = unit.buildQueue.shift()
    if (first) unit.buildQueue.push(first)
  }
  unit.stop?.()
  unit.context?.scheduler?.addOneShot?.(
    () => {
      if (unit.inactif && (unit.buildQueue?.length ?? 0) > 0) unit.continueBuildingQueue?.()
    },
    500,
    'unit.resumeBuildQueue'
  )
  return
}

function handleLostBuildTarget(unit: UnitEntity): void {
  if (unit.previousDest || unit.previousWork) {
    unit.goBackToPrevious?.()
    return
  }

  const unitAsInstance = unit
  const targets = findInstancesInSight<UnitEntity, RuntimeEntity>(unitAsInstance, instance =>
    Boolean(unit.getActionCondition?.(instance, ACTION_TYPES.build))
  )
  if (targets.length) {
    const target = getClosestInstanceWithPath<RuntimeEntity, RuntimeCell>(unitAsInstance, targets)
    if (target) {
      unit.setDest?.(target.instance)
      unit.setPath?.(target.path)
      return
    }
  }

  unit.stop?.()
  unit.work = null
  return
}

function trySetReplacementTarget(unit: UnitEntity, action: string): boolean {
  const targets = findInstancesInSight<UnitEntity, RuntimeEntity>(
    unit,
    instance => Boolean(unit.getActionCondition?.(instance)) && !isVillagerWorkTargetRejected(unit, instance),
    action === ACTION_TYPES.attack ? { useInsightRange: true } : undefined
  )
  if (!targets.length) return false
  const target = getClosestInstanceWithPath<RuntimeEntity, RuntimeCell>(unit, targets)
  if (!target) return false
  unit.setDest?.(target.instance)
  if (instanceContactInstance(unit, target.instance)) {
    unit.degree = getInstanceDegree(unit, target.instance.x, target.instance.y)
    unit.getAction?.(action)
  } else unit.setPath?.(target.path)
  return true
}
