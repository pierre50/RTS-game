import { ACTION_TYPES, FAMILY_TYPES, MINING_RESOURCE_CONFIG, RESOURCE_TYPES, UNIT_TYPES } from '../constants'
import { getEntityWeaponPower } from '../equipment/equipmentStats'
import { isWildHorse } from '../horses/horseTaming'
import { canUpgradeUnitAtBuilding } from '../units/unitUpgrades'
import { isBanditOwner, isBanditUnitType } from './bandits'
import { isFriendlyTarget } from './combatRelations'
import type { ActionProps, CombatEntity } from '../../types/combat'
import type { Condition, ConfigValue } from '../../types/config'

type MiningActionConfig = {
  action: string
}

function getMiningActionEntries(): Array<[string, MiningActionConfig]> {
  const config = MINING_RESOURCE_CONFIG ?? {
    [RESOURCE_TYPES.stone]: { action: ACTION_TYPES.minestone },
    [RESOURCE_TYPES.gold]: { action: ACTION_TYPES.minegold },
  }
  return Object.entries(config)
    .filter(([resourceType, entry]) => Boolean(resourceType && entry?.action))
    .map(([resourceType, entry]) => [resourceType, { action: entry.action }])
}

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

function isVillagerOrHero(source?: CombatEntity | null): boolean {
  return source?.type === UNIT_TYPES.villager || source?.type === UNIT_TYPES.hero
}

export function isWheatMature(target?: CombatEntity | null): boolean {
  if (!target || target.type !== RESOURCE_TYPES.wheat) return false
  const sprite = target.sprite as { currentFrame?: number; textures?: unknown[] } | null | undefined
  if (
    !sprite ||
    typeof sprite.currentFrame !== 'number' ||
    !Array.isArray(sprite.textures) ||
    !sprite.textures.length
  ) {
    return false
  }
  return sprite.currentFrame >= sprite.textures.length - 1
}

function isDepletedBerrybush(target?: CombatEntity | null): boolean {
  return Boolean(
    target?.type === RESOURCE_TYPES.berrybush &&
      (target.quantity ?? 0) <= 0 &&
      (target.hitPoints ?? 0) > 0 &&
      !target.isDead
  )
}

function ownerHasTechnology(source: CombatEntity, technology: string): boolean {
  return Boolean(source.owner?.technologies?.includes(technology))
}

const arraysEqual = (a: readonly ConfigValue[], b: readonly ConfigValue[]): boolean => {
  if (a.length !== b.length) return false
  const sortedA = a.slice().sort()
  const sortedB = b.slice().sort()
  return sortedA.every((val, index) => val === sortedB[index])
}

export const isValidCondition = (condition: Condition | null | undefined, values: object): boolean => {
  if (!condition) return true

  const { op, key, value } = condition
  const expectedValue = (values as Record<string, ConfigValue>)[key]

  if (expectedValue === undefined) {
    throw new Error(`Key not found in values: ${key}`)
  }

  switch (op) {
    case '=':
    case '!=': {
      const result =
        Array.isArray(value) && Array.isArray(expectedValue)
          ? arraysEqual(value, expectedValue)
          : value === expectedValue
      return op === '!=' ? !result : result
    }
    case '<':
      return Number(expectedValue) < Number(value)
    case '<=':
      return Number(expectedValue) <= Number(value)
    case '>=':
      return Number(expectedValue) >= Number(value)
    case '>':
      return Number(expectedValue) > Number(value)
    case 'includes':
      return Array.isArray(expectedValue) && expectedValue.includes(value)
    case 'notincludes':
      return Array.isArray(expectedValue) && !expectedValue.includes(value)
    default:
      throw new Error(`Invalid condition operation provided: ${op}`)
  }
}

export const getActionCondition = (
  source: CombatEntity,
  target: CombatEntity,
  action: string | undefined,
  props?: ActionProps
): boolean => {
  if (!action) return false

  const conditions: Record<string, (props?: ActionProps) => boolean> = {
    takemeat: () =>
      Boolean(
        isVillagerOrHero(source) &&
          target.family === FAMILY_TYPES.animal &&
          (target.quantity ?? 0) > 0 &&
          target.isDead &&
          !target.isDestroyed
      ),
    hunt: () =>
      isVillagerOrHero(source) &&
      target.family === FAMILY_TYPES.animal &&
      (target.quantity ?? 0) > 0 &&
      (target.hitPoints ?? 0) > 0 &&
      !target.isDead,
    captureHorse: () =>
      source.type === UNIT_TYPES.villager &&
      target.family === FAMILY_TYPES.animal &&
      target.type === 'Horse' &&
      isWildHorse(target as { type: string; tamingStatus?: unknown }) &&
      (target.hitPoints ?? 0) > 0 &&
      !target.isDead &&
      !target.isDestroyed &&
      !(target as { isLassoed?: boolean }).isLassoed,
    chopwood: () =>
      isVillagerOrHero(source) &&
      ((target.type === RESOURCE_TYPES.tree && (target.quantity ?? 0) > 0 && !target.isDead) ||
        isDepletedBerrybush(target)),
    farm: () =>
      isVillagerOrHero(source) &&
      ownerHasTechnology(source, 'Farming') &&
      target.type === RESOURCE_TYPES.wheat &&
      isWheatMature(target) &&
      (target.quantity ?? 0) > 0 &&
      (source.type === UNIT_TYPES.hero || !target.isUsedBy || target.isUsedBy === source) &&
      !target.isDead,
    forageberry: () =>
      isVillagerOrHero(source) &&
      target.type === RESOURCE_TYPES.berrybush &&
      (target.quantity ?? 0) > 0 &&
      !target.isDead,
    ...Object.fromEntries(
      getMiningActionEntries().map(([resourceType, config]) => [
        config.action,
        () =>
          isVillagerOrHero(source) &&
          ownerHasTechnology(source, 'Pickaxe') &&
          target.type === resourceType &&
          (target.quantity ?? 0) > 0 &&
          !target.isDead,
      ])
    ),
    build: () =>
      isVillagerOrHero(source) &&
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
          (target.hitPoints ?? 0) > 0 &&
          !target.isDead
      ),
    train: props =>
      Boolean(
        target &&
          (source.type === UNIT_TYPES.villager ||
            canUpgradeUnitAtBuilding(target.type, source.type, props?.trainingType)) &&
          target.family === FAMILY_TYPES.building &&
          target.owner?.label === source.owner?.label &&
          target.isBuilt &&
          (target.hitPoints ?? 0) > 0 &&
          !target.isDead &&
          Array.isArray(target.units) &&
          !!props?.trainingType &&
          target.units.includes(props.trainingType)
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
