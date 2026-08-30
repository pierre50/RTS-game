import { BUILDING_TYPES } from '../../constants'
import { applyTheftConsequences, THEFT_SUBJECT_TYPES } from '../theft/theft'
import { getMapSpace } from '../mapSpaces'
import {
  consumeStableHorseAt,
  exchangeStableHorseAt,
  type StableHorse,
} from './stableHorses'
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

export function takeStableInteriorHorseForHero(
  hero: UnitEntity,
  horse: RuntimeEntity,
  replacementHorse: StableHorse | null | undefined = null
): StableHorseTakeResult | null {
  const building = getStableInteriorHorseBuilding(hero, horse)
  const index = getStableInteriorHorseIndex(horse)
  if (!building || index === null) return null
  const stableHorse = replacementHorse
    ? exchangeStableHorseAt(building, index, replacementHorse)
    : consumeStableHorseAt(building, index)
  if (!stableHorse) return null

  applyTheftConsequences({
    actor: hero,
    owner: building.owner ?? null,
    subject: THEFT_SUBJECT_TYPES.horse,
    target: {
      ...horse,
      owner: building.owner,
    },
  })

  return { building, horse: stableHorse }
}
