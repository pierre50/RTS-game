import { unitSuspensionReason } from '../unitSuspension'
import { ACTION_TYPES } from '../../../constants'
import { shouldVillagerWork } from '../villagerSchedule'
import type { UnitEntity } from '../../../types/entities'

export function hasPriorityCombat(unit: UnitEntity): boolean {
  return Boolean(
    unit.combatMode ||
      unit.followAssist ||
      unit.followAssistIntent ||
      (unit.action && [ACTION_TYPES.attack, ACTION_TYPES.flee].includes(unit.action))
  )
}

export function villagerAutonomySuspension(unit: UnitEntity, reconsiderDeposit = false): string | null {
  const simulation = unitSuspensionReason(unit)
  if (simulation) return simulation
  if (unit.isDead || unit.isDestroyed) return 'unavailable'
  const suspension = controlSuspension(unit, reconsiderDeposit)
  if (suspension) return suspension
  if (unit.waitingForEnergyAction) return 'energy-recovery'
  if (hasPriorityCombat(unit)) return 'combat'
  if (unit.pendingOrder) return 'pending-order'
  if (unit.actionLocked || unit.assigningAutonomousJob) return 'action-locked'
  if (!shouldVillagerWork(unit)) return 'outside-work-hours'
  return null
}

function controlSuspension(unit: UnitEntity, reconsiderDeposit: boolean): string | null {
  if (unit.controlMode === 'hero' || unit.followingHero || unit.lookingAtHero || unit.isDirectMoving)
    return 'player-control'
  if (unit.trainingTargetType || unit.action === ACTION_TYPES.train) return 'training'
  if (!reconsiderDeposit && (unit.resourceDeliveryState || unit.action === ACTION_TYPES.delivery)) return 'delivery'
  if (unit.shelterState || unit.suspendedRestState || unit.sleepVisualState) return 'resting'
  if (unit.spacePortalState || unit.interiorExitState) return 'interior-transition'
  return null
}
