import { isHeroControlled } from '../../../lib/units/unitControl'
import {
  markVillagerAutonomyTargetRejected,
  isVillagerWorkTargetRejected,
} from '../../../lib/units/villagerAutonomyTargeting'
import { STEP_TIME, ACTION_TYPES, UNIT_TYPES } from '../../../constants'
import { CONTACT_APPROACH, GATHER_CONTACT_STALL } from '../../../config/contactProfiles'
import { startContactApproach } from '../../../lib/contact/contactApproach'
import { sampleActionApproach, usesUnitContactAction, isWorkContactAction } from '../../../lib/actions/contactActions'
import { sameMapSpace } from '../../../lib/mapSpaces'
import type { RuntimeEntity, UnitEntity } from '../../../types/entities'

export function tryStartUnitContactApproach(
  unit: UnitEntity,
  target: RuntimeEntity,
  action: string | null | undefined
): boolean {
  if (!action || !usesUnitContactAction(unit, action) || !unit.moveDirect || !unit.startInterval) return false
  const gathering =
    unit.type === UNIT_TYPES.villager &&
    !isHeroControlled(unit) &&
    action !== ACTION_TYPES.build &&
    isWorkContactAction(action)
  if (gathering && isVillagerWorkTargetRejected(unit, target)) return false
  const moveDirect = unit.moveDirect.bind(unit)
  const startInterval = unit.startInterval.bind(unit)
  let scheduledInterval = unit.interval
  return startContactApproach({
    actor: unit,
    ...(gathering ? { stallPolicy: GATHER_CONTACT_STALL } : {}),
    wait: () => unit.sprite?.stop(),
    isTargetValid: () => sameMapSpace(unit, target) && Boolean(unit.getActionCondition?.(target, action)),
    isCurrent: () => unit.dest === target && unit.action === action,
    sample: () => sampleActionApproach(unit, target, action),
    move: ({ point, distance }) =>
      distance > 0 &&
      moveDirect(
        (point.x - unit.x) / distance,
        (point.y - unit.y) / distance,
        Math.min(unit.speed ?? 1, CONTACT_APPROACH.maxStep, distance)
      ),
    begin: () => {
      unit.setDest?.(target)
      unit.action = action
      unit.path = []
    },
    arrive: ({ degree }) => {
      unit.degree = degree
      unit.getAction?.(action)
    },
    schedule: callback => {
      startInterval(callback, STEP_TIME, false, 'unit.contactApproach')
      scheduledInterval = unit.interval
    },
    // A callback queued before an external order must not stop that order's interval.
    stop: () => {
      if (unit.interval === scheduledInterval) unit.stopInterval?.()
    },
    retry: () => {
      if (gathering) {
        markVillagerAutonomyTargetRejected(unit, target)
        unit.affectNewDest?.()
      } else unit.sendToEvt?.(target, action, { forceRepath: true })
    },
  })
}
