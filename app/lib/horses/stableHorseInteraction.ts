import { definedProperties } from '../definedProperties'
import { BUILDING_TYPES } from '../../constants'
import { applyTheftConsequences, THEFT_SUBJECT_TYPES } from '../theft/theft'
import { getMapSpace } from '../mapSpaces'
import { detachStableInteriorHorse, exchangeStableHorseAt, getStableHorses, type StableHorse } from './stableHorses'
import { getStableInteriorHorseIndex, isStableInteriorSpace } from './stableInteriorHorseIdentity'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'

export type StableHorseTakeResult = {
  building: BuildingEntity
  horse: StableHorse
}

function getStableInteriorHorseBuilding(hero: UnitEntity, horse: RuntimeEntity): BuildingEntity | null {
  const map = hero.context?.map
  const space = map && horse.spaceId ? getMapSpace(map, horse.spaceId) : null
  if (!isStableInteriorSpace(space)) return null
  return space.building.type === BUILDING_TYPES.stable ? space.building : null
}

function sameOwner(a: UnitEntity['owner'] | null | undefined, b: BuildingEntity['owner'] | null | undefined): boolean {
  if (!a || !b) return false
  return a === b || Boolean(a.label && b.label && a.label === b.label)
}

export function isStoredForeignStableHorse(hero: UnitEntity, horse: RuntimeEntity): boolean {
  const building = getStableInteriorHorseBuilding(hero, horse)
  const index = getStableInteriorHorseIndex(horse)
  if (!building || index === null || !building.owner || sameOwner(hero.owner, building.owner)) return false
  return index >= 0 && index < getStableHorses(building).length
}

export function takeStableInteriorHorseForHero(
  hero: UnitEntity,
  horse: RuntimeEntity,
  replacementHorse: StableHorse | null | undefined = null
): StableHorseTakeResult | null {
  const map = hero.context?.map
  if (!map || horse.isDead || horse.isDestroyed) return null
  const building = getStableInteriorHorseBuilding(hero, horse)
  const index = getStableInteriorHorseIndex(horse)
  if (!building || index === null) return null
  const shouldApplyTheft = isStoredForeignStableHorse(hero, horse)
  const stableHorse = replacementHorse
    ? exchangeStableHorseAt(building, index, replacementHorse)
    : detachStableInteriorHorse(horse, map)
  if (!stableHorse) return null

  if (shouldApplyTheft) {
    applyTheftConsequences({
      actor: hero,
      owner: building.owner ?? null,
      subject: THEFT_SUBJECT_TYPES.horse,
      target: definedProperties({
        ...horse,
        owner: building.owner,
      }),
    })
  }

  return { building, horse: stableHorse }
}
