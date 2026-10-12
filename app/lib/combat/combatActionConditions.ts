import { hasRequiredWorkTool } from '../equipment/workTools'
import type { ActionProps, CombatEntity } from '../../types/combat'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import { shouldAttackBuildingForInteriorAccess } from '../buildings/interiorAccess'
import { BUILDING_TYPES, FAMILY_TYPES, UNIT_TYPES } from '../constants'
import { isReservedQuestTarget } from '../quests/questReservations'
import { unitHasDeliverableResourcesForBuilding } from '../resources/resourceDelivery'
import { unitSuspensionReason } from '../units/unitSuspension'
import { canAttack, canConvert } from './combatCapabilities'
import { isFriendlyTarget } from './combatRelations'
import { getResourceActionConditions } from './resourceActionConditions'
export { isValidCondition } from './configConditions'
export { isWheatMature } from './resourceActionConditions'

export const getActionCondition = (
  source: CombatEntity,
  target: CombatEntity,
  action: string | undefined,
  props?: ActionProps
): boolean => {
  if (!action || !source || !target) return false
  if (!hasRequiredWorkTool(source as UnitEntity, action)) return false
  if ((target as UnitEntity).ambientRoadGroup && action === 'convert') return false
  if ((source as UnitEntity).ambientRoadGroup && target.family === 'building' && action === 'attack') return false
  if (
    unitSuspensionReason(source as UnitEntity) === 'road-travel' ||
    unitSuspensionReason(target as UnitEntity) === 'road-travel'
  )
    return false
  if (['hunt', 'takemeat', 'attack', 'captureHorse'].includes(action) && isReservedQuestTarget(source, target))
    return false

  const conditions: Record<string, (props?: ActionProps) => boolean> = {
    ...getResourceActionConditions(source, target),
    build: () =>
      (source.type === UNIT_TYPES.villager || source.type === UNIT_TYPES.hero) &&
      (target.owner?.label === source.owner?.label ||
        (source.type === UNIT_TYPES.hero && isFriendlyTarget(source, target))) &&
      target.family === FAMILY_TYPES.building &&
      !target.constructionPaused &&
      (target.hitPoints ?? 0) > 0 &&
      (Boolean(target.buildingUpgrade) || !target.isBuilt || (target.hitPoints ?? 0) < (target.totalHitPoints ?? 0)) &&
      !target.isDead,
    attack: () =>
      Boolean(
        canAttack(source) &&
          target &&
          !target.indestructible &&
          !isFriendlyTarget(source, target) &&
          (source.owner?.isEnemy?.(target.owner as never) || target.family === FAMILY_TYPES.animal) &&
          (source.family !== FAMILY_TYPES.animal || target.family !== FAMILY_TYPES.building) &&
          [FAMILY_TYPES.building, FAMILY_TYPES.unit, FAMILY_TYPES.animal].includes(target.family ?? '') &&
          (target.family !== FAMILY_TYPES.building ||
            source.type === UNIT_TYPES.hero ||
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
          (Boolean((source as UnitEntity).resourceDeliveryState?.pickup) ||
            unitHasDeliverableResourcesForBuilding(source as UnitEntity, target as BuildingEntity))
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
