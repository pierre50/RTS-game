import { hasAnimalCorpseLoot } from '../equipment/animalCorpseLoot'
import { canGatherCaveMineral } from '../resources/caveMinerals'
import type { CombatEntity } from '../../types/combat'
import {
  ACTION_TYPES,
  FAMILY_TYPES,
  FORAGE_RESOURCE_TYPES,
  MINING_RESOURCE_CONFIG,
  RESOURCE_TYPES,
  UNIT_TYPES,
} from '../constants'
import { isWildHorse } from '../horses/horseTaming'
import { canMineIronResource } from '../resources/ironMining'

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

function isForageResource(target?: CombatEntity | null): boolean {
  const type = target?.type
  return type ? FORAGE_RESOURCE_TYPES.has(type) : false
}

export function getResourceActionConditions(source: CombatEntity, target: CombatEntity): Record<string, () => boolean> {
  return {
    takemeat: () =>
      Boolean(
        isVillagerOrHero(source) &&
          target.family === FAMILY_TYPES.animal &&
          hasAnimalCorpseLoot(target as Parameters<typeof hasAnimalCorpseLoot>[0]) &&
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
      !(target as { isCatchingPoleCaught?: boolean }).isCatchingPoleCaught,
    chopwood: () =>
      isVillagerOrHero(source) &&
      ((target.type === RESOURCE_TYPES.tree && (target.quantity ?? 0) > 0 && !target.isDead) ||
        isDepletedBerrybush(target)),
    farm: () =>
      isVillagerOrHero(source) &&
      target.type === RESOURCE_TYPES.wheat &&
      isWheatMature(target) &&
      (target.quantity ?? 0) > 0 &&
      (source.type === UNIT_TYPES.hero || !target.isUsedBy || target.isUsedBy === source) &&
      !target.isDead,
    forageberry: () =>
      isVillagerOrHero(source) && isForageResource(target) && (target.quantity ?? 0) > 0 && !target.isDead,
    ...Object.fromEntries(
      getMiningActionEntries().map(([resourceType, config]) => [
        config.action,
        () =>
          isVillagerOrHero(source) &&
          canGatherCaveMineral(source, target) &&
          canMineIronResource(source, target) &&
          target.type === resourceType &&
          (target.quantity ?? 0) > 0 &&
          !target.isDead,
      ])
    ),
  }
}
