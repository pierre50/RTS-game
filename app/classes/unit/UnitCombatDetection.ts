import { ACTION_TYPES, FAMILY_TYPES, UNIT_TYPES } from '../../constants'
import { evaluateCombatMorale } from '../../lib'
import { shouldSuppressAggroDuringCombatRecovery } from '../../lib/combat/combatBehavior'
import { showAlertThenAggressionFeedback } from '../../lib/combat/combatFeedback'
import { canAutoAcquireTarget } from '../../lib/units/unitControl'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'

export function detectCombatThreat(unit: UnitEntity, instance: RuntimeEntity | null): void {
  if (unit.context?.editor) return
  if (!canAutoAcquireTarget(unit)) return
  if (shouldSuppressAggroDuringCombatRecovery(unit)) return
  if (!instance || instance.family !== FAMILY_TYPES.unit) return
  if (!unit.getActionCondition?.(instance, ACTION_TYPES.attack)) return

  const isVillager = unit.type === UNIT_TYPES.villager
  const isIdleCombatUnit = !isVillager && !unit.path?.length && !unit.dest
  const canInterruptCivilianTask = isVillager && unit.action !== ACTION_TYPES.attack

  if (isVillager && evaluateCombatMorale(unit, instance) === 'flee') {
    ;(unit as UnitEntity & { runaway?: (target: RuntimeEntity) => void }).runaway?.(instance)
    return
  }

  if (isIdleCombatUnit || canInterruptCivilianTask) {
    showAlertThenAggressionFeedback(unit, () => {
      if (unit.context?.editor || !canAutoAcquireTarget(unit)) return
      if (!unit.getActionCondition?.(instance, ACTION_TYPES.attack)) return
      if (unit.sendToAttack) {
        unit.sendToAttack(instance, { keepPrevious: isVillager })
        return
      }
      if (unit.path?.length || unit.dest) return
      unit.sendTo?.(instance, ACTION_TYPES.attack)
    })
  }
}
