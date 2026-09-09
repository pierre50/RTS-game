import { ACTION_TYPES, MINING_RESOURCE_CONFIG, WORK_TYPES } from '../constants'
import { canReachContact, isContactTouching, sampleContactApproach } from '../contact/contactGeometry'
import { getUnitMeleeWeapon, usesMeleeAttack } from '../combat/unitMelee'
import { getUnitWorkEquipment } from '../equipment/equipmentStats'
import { CONTACT_TOOL_PROFILES } from '../../config/contactProfiles'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'

// null means the hand, independently of equipped combat gear.
const WORK_CONTACT_ACTIONS: Readonly<Record<string, string | null>> = {
  [ACTION_TYPES.chopwood]: WORK_TYPES.woodcutter,
  [ACTION_TYPES.forageberry]: null,
  [ACTION_TYPES.takemeat]: null,
  [ACTION_TYPES.farm]: WORK_TYPES.farmer,
  [ACTION_TYPES.build]: WORK_TYPES.builder,
  ...Object.fromEntries(Object.values(MINING_RESOURCE_CONFIG ?? {}).map(config => [config.action, config.work])),
}

export function isWorkContactAction(action: string | null | undefined): boolean {
  return Boolean(action && Object.hasOwn(WORK_CONTACT_ACTIONS, action))
}

export function usesUnitContactAction(unit: UnitEntity, action: string | null | undefined): boolean {
  return isWorkContactAction(action) || (action === ACTION_TYPES.attack && usesMeleeAttack(unit))
}

export function getActionContactTool(unit: UnitEntity, action: string | null | undefined): string | undefined {
  if (action === ACTION_TYPES.attack) return getUnitMeleeWeapon(unit)
  const work = action ? WORK_CONTACT_ACTIONS[action] : undefined
  if (!work) return undefined
  return getUnitWorkEquipment(work, unit.owner?.age).find(key =>
    ['axe', 'pickaxe', 'scythe'].includes(CONTACT_TOOL_PROFILES[key] ?? '')
  )
}

export function canReachActionTarget(
  unit: UnitEntity,
  target: RuntimeEntity,
  action: string | null | undefined
): boolean {
  return (
    usesUnitContactAction(unit, action) &&
    canReachContact(unit, target, getActionContactTool(unit, action), {
      allowDeadTarget: action !== ACTION_TYPES.attack,
    })
  )
}

export function isActionTouchingTarget(
  unit: UnitEntity,
  target: RuntimeEntity,
  action: string | null | undefined
): boolean {
  return (
    usesUnitContactAction(unit, action) &&
    isContactTouching(unit, target, getActionContactTool(unit, action), {
      allowDeadTarget: action !== ACTION_TYPES.attack,
    })
  )
}

export function sampleActionApproach(unit: UnitEntity, target: RuntimeEntity, action: string) {
  return sampleContactApproach(unit, target, getActionContactTool(unit, action), {
    allowDeadTarget: action !== ACTION_TYPES.attack,
  })
}
