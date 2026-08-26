import { ACTION_TYPES, FAMILY_TYPES, UNIT_TYPES, WORK_TYPES } from '../../../constants'
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

type UnitAffectNewDestRouting = {
  sendToPostBuildResource(): boolean
}

export function affectNewDest(unit: UnitEntity, routing: UnitAffectNewDestRouting): void {
  unit.stopInterval?.()
  if (!unit.action) {
    if (isRecoveringAttack(unit)) {
      pauseCombatRecoveryMove(unit)
      return
    }
    if (resumeVillagerAutonomy?.(unit)) return
    unit.stop?.()
    return
  }
  if (isHeroControlled(unit)) {
    showConfusionFeedback(unit)
    unit.previousDest = null
    unit.previousWork = null
    unit.stop?.()
    return
  }
  const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
  const queuedBuildInterrupted =
    unit.work === WORK_TYPES.builder && unit.action === ACTION_TYPES.build && (unit.buildQueue?.length ?? 0) > 0
  if (queuedBuildInterrupted) {
    if (dest && unit.getActionCondition?.(dest, ACTION_TYPES.build) && unit.buildQueue) {
      unit.buildQueue.push(unit.buildQueue.shift()!)
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

  const lostBuildTarget =
    unit.work === WORK_TYPES.builder &&
    unit.action === ACTION_TYPES.build &&
    (!dest || !unit.getActionCondition?.(dest, ACTION_TYPES.build))

  if (lostBuildTarget) {
    if (unit.previousDest || unit.previousWork) {
      unit.goBackToPrevious?.()
      return
    }

    if (routing.sendToPostBuildResource()) return

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

  if (unit.previousDest) {
    unit.goBackToPrevious?.()
    return
  }
  let handleSuccess = false
  if (unit.type === UNIT_TYPES.villager && (unit.action === ACTION_TYPES.takemeat || unit.action === ACTION_TYPES.hunt)) {
    handleSuccess = Boolean(unit.handleAffectNewDestHunter?.())
  } else if (!dest || dest.family !== FAMILY_TYPES.animal) {
    const unitAsInstance = unit
    const targets = findInstancesInSight<UnitEntity, RuntimeEntity>(
      unitAsInstance,
      instance => Boolean(unit.getActionCondition?.(instance)),
      unit.action === ACTION_TYPES.attack ? { useInsightRange: true } : undefined
    )
    if (targets.length) {
      const target = getClosestInstanceWithPath<RuntimeEntity, RuntimeCell>(unitAsInstance, targets)
      if (target) {
        unit.setDest?.(target.instance)
        if (instanceContactInstance(unitAsInstance, target.instance)) {
          unit.degree = getInstanceDegree(unitAsInstance, target.instance.x, target.instance.y)
          unit.getAction?.(unit.action)
          return
        }
        unit.setPath?.(target.path)
        return
      }
    }
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
