import { updateUnitEnergy } from '../lib'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { UnitEntity } from '../types/entities'

export const UNIT_ENERGY_REGEN_INTERVAL_MS = 500

function hasActivePath(unit: UnitEntity): boolean {
  return (unit.path?.length ?? 0) > 0
}

function isWaitingForEnergy(unit: UnitEntity): boolean {
  return Boolean(unit.waitingForEnergyAction)
}

export function shouldApplyPassiveUnitEnergyRegen(unit: UnitEntity): boolean {
  return Boolean(unit && !unit.isDead && !unit.isDestroyed && !hasActivePath(unit) && !isWaitingForEnergy(unit))
}

export class UnitEnergyRegenSystem {
  private context: GameContextLike
  private taskId: SchedulerTaskId | null = null

  constructor(context: GameContextLike, intervalMs = UNIT_ENERGY_REGEN_INTERVAL_MS) {
    this.context = context
    this.taskId = context.scheduler.add(() => this.update(intervalMs), intervalMs, 'unit.energyPassiveRegen')
  }

  update(elapsedMs = UNIT_ENERGY_REGEN_INTERVAL_MS): void {
    for (const player of this.context.players ?? []) {
      for (const unit of player.units ?? []) {
        if (shouldApplyPassiveUnitEnergyRegen(unit)) updateUnitEnergy?.(unit, elapsedMs)
      }
    }
  }

  destroy(): void {
    if (this.taskId == null) return
    this.context.scheduler.remove(this.taskId)
    this.taskId = null
  }
}
