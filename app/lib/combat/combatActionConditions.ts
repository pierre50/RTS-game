import type { ActionProps, CombatEntity } from '../../types/combat'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import { shouldAttackBuildingForInteriorAccess } from '../buildings/interiorAccess'
import { BUILDING_TYPES, FAMILY_TYPES, UNIT_TYPES } from '../constants'
import { getEntityWeaponPower } from '../equipment/equipmentStats'
import { unitHasDeliverableResourcesForBuilding } from '../resources/resourceDelivery'
import { isBanditOwner, isBanditUnitType } from './bandits'
import { isFriendlyTarget } from './combatRelations'
import { getResourceActionConditions } from './resourceActionConditions'
export { isValidCondition } from './configConditions'
export { isWheatMature } from './resourceActionConditions'

function canAttack(source?: CombatEntity | null): boolean {
  return getEntityWeaponPower(source as Parameters<typeof getEntityWeaponPower>[0] | null | undefined) > 0
}

function canConvert(source?: CombatEntity | null, target?: CombatEntity | null): boolean {
  if (!source || source.type !== UNIT_TYPES.priest || !target) return false
  const sourceOwner = source.owner
  if (
    !sourceOwner ||
    isBanditOwner(sourceOwner as Parameters<typeof isBanditOwner>[0]) ||
    !sourceOwner.isEnemy?.(target.owner as never)
  )
    return false
  if (target.family === FAMILY_TYPES.unit) {
    return target.type !== UNIT_TYPES.priest && !isBanditUnitType(target.type)
  }
  const hasMonotheism = sourceOwner.technologies?.includes('Monotheism')
  return !!hasMonotheism && (target.family === FAMILY_TYPES.building || target.type === UNIT_TYPES.priest)
}

export const getActionCondition = (
  source: CombatEntity,
  target: CombatEntity,
  action: string | undefined,
  props?: ActionProps
): boolean => {
  if (!action) return false

  const conditions: Record<string, (props?: ActionProps) => boolean> = {
    ...getResourceActionConditions(source, target),
    build: () =>
      (source.type === UNIT_TYPES.villager || source.type === UNIT_TYPES.hero) &&
      target.owner?.label === source.owner?.label &&
      target.family === FAMILY_TYPES.building &&
      (target.hitPoints ?? 0) > 0 &&
      (!target.isBuilt || (target.hitPoints ?? 0) < (target.totalHitPoints ?? 0)) &&
      !target.isDead,
    attack: () =>
      Boolean(
        canAttack(source) &&
          target &&
          !isFriendlyTarget(source, target) &&
          (source.owner?.isEnemy?.(target.owner as never) || target.family === FAMILY_TYPES.animal) &&
          (source.family !== FAMILY_TYPES.animal || target.family !== FAMILY_TYPES.building) &&
          [FAMILY_TYPES.building, FAMILY_TYPES.unit, FAMILY_TYPES.animal].includes(target.family ?? '') &&
          (target.family !== FAMILY_TYPES.building ||
            shouldAttackBuildingForInteriorAccess(source as UnitEntity, target as BuildingEntity)) &&
          (target.hitPoints ?? 0) > 0 &&
          !target.isDead
      ),
    train: props =>
      Boolean(
        target &&
          (source.type === UNIT_TYPES.villager ||
            (target.type === BUILDING_TYPES.stable &&
              source.type === props?.trainingType &&
              !(source as UnitEntity).mountedOnHorse)) &&
          target.family === FAMILY_TYPES.building &&
          target.owner?.label === source.owner?.label &&
          target.isBuilt &&
          (target.hitPoints ?? 0) > 0 &&
          !target.isDead &&
          Array.isArray(target.units) &&
          !!props?.trainingType &&
          target.units.includes(props.trainingType)
      ),
    delivery: () =>
      Boolean(
        source.type === UNIT_TYPES.villager &&
          target.family === FAMILY_TYPES.building &&
          target.owner?.label === source.owner?.label &&
          target.isBuilt &&
          (target.hitPoints ?? 0) > 0 &&
          !target.isDead &&
          unitHasDeliverableResourcesForBuilding(source as UnitEntity, target as BuildingEntity)
      ),
    heal: () =>
      target &&
      target.owner?.label === source.owner?.label &&
      target.family === FAMILY_TYPES.unit &&
      (target.hitPoints ?? 0) > 0 &&
      (target.hitPoints ?? 0) < (target.totalHitPoints ?? 0) &&
      !target.isDead,
    convert: () => canConvert(source, target) && (target.hitPoints ?? 0) > 0 && !target.isDead,
  }
  return Boolean(
    target && target !== source && (source.hitPoints ?? 0) > 0 && !source.isDead && conditions[action]?.(props)
  )
}
