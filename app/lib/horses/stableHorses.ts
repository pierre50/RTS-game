import { BUILDING_TYPES } from '../constants'
import { HORSE_TAMING_STATUS, tameHorse, type HorseTamingStatus } from './horseTaming'
import {
  getStableInteriorHorseIndex,
  getStableInteriorHorseLabel,
  isStableInteriorSpace,
} from './stableInteriorHorseIdentity'
import type { RuntimeMap } from '../../types/map'
import type { AnimalEntity, BuildingEntity, RuntimeEntity } from '../../types/entities'

export const STABLE_HORSE_CAPACITY = 5

export type StableHorse = {
  horseColor?: string
  tamingStatus?: HorseTamingStatus
}

type StableHorseBuilding = BuildingEntity & {
  horseAmount?: number
  stableHorses?: StableHorse[]
}

function isStable(building: BuildingEntity): building is StableHorseBuilding {
  return building.type === BUILDING_TYPES.stable
}

function syncStableInteriorHorses(building: BuildingEntity): void {
  building.context?.syncStableInteriorHorses?.(building)
}

export function getStableHorses(building: BuildingEntity): StableHorse[] {
  if (!isStable(building)) return []
  const fallbackAmount = Math.max(0, Math.min(STABLE_HORSE_CAPACITY, Number(building.horseAmount) || 0))
  const horses: StableHorse[] = Array.isArray(building.stableHorses)
    ? building.stableHorses
    : Array.from({ length: fallbackAmount }, () => ({}))
  building.stableHorses = horses.slice(0, STABLE_HORSE_CAPACITY).map(horse => ({
    ...horse,
    tamingStatus: HORSE_TAMING_STATUS.tamed,
  }))
  building.horseAmount = building.stableHorses.length
  return building.stableHorses
}

export function getStableHorseAmount(building: BuildingEntity): number {
  return getStableHorses(building).length
}

export function canStoreStableHorse(building: BuildingEntity): boolean {
  return isStable(building) && getStableHorseAmount(building) < STABLE_HORSE_CAPACITY
}

export function storeStableHorse(building: BuildingEntity, horse: Pick<AnimalEntity, 'horseColor' | 'type'>): boolean {
  if (!canStoreStableHorse(building)) return false
  tameHorse(horse as AnimalEntity)
  const horses = getStableHorses(building)
  horses.push({ horseColor: horse.horseColor, tamingStatus: HORSE_TAMING_STATUS.tamed })
  building.horseAmount = horses.length
  syncStableInteriorHorses(building)
  return true
}

export function consumeStableHorse(building: BuildingEntity): StableHorse | null {
  if (!isStable(building)) return null
  const horses = getStableHorses(building)
  const horse = horses.shift() ?? null
  building.horseAmount = horses.length
  if (horse) syncStableInteriorHorses(building)
  return horse
}

function consumeStableHorseAt(building: BuildingEntity, index: number): StableHorse | null {
  if (!isStable(building)) return null
  const horses = getStableHorses(building)
  if (!Number.isInteger(index) || index < 0 || index >= horses.length) return null
  const [horse] = horses.splice(index, 1)
  building.horseAmount = horses.length
  if (horse) syncStableInteriorHorses(building)
  return horse ?? null
}

export function exchangeStableHorseAt(
  building: BuildingEntity,
  index: number,
  incomingHorse: StableHorse | null | undefined
): StableHorse | null {
  if (!incomingHorse || !isStable(building)) return consumeStableHorseAt(building, index)
  const horses = getStableHorses(building)
  if (!Number.isInteger(index) || index < 0 || index >= horses.length) return null
  const outgoingHorse = horses[index] ?? null
  horses[index] = {
    ...incomingHorse,
    tamingStatus: HORSE_TAMING_STATUS.tamed,
  }
  building.horseAmount = horses.length
  if (outgoingHorse) syncStableInteriorHorses(building)
  return outgoingHorse
}

export function returnStableHorse(building: BuildingEntity, horse: StableHorse | null | undefined): void {
  if (!horse || !isStable(building)) return
  getStableHorses(building).unshift(horse)
  building.stableHorses = getStableHorses(building).slice(0, STABLE_HORSE_CAPACITY)
  building.horseAmount = building.stableHorses.length
  syncStableInteriorHorses(building)
}

let detachedHorseId = 0

// Detach the physical horse before synchronizing the remaining stock. It may
// still be inside (mounted, dying, or about to cross the exit).
export function detachStableInteriorHorse(horse: RuntimeEntity, map: RuntimeMap): StableHorse | null {
  const space = map.spaces?.get(horse.spaceId ?? '')
  const index = getStableInteriorHorseIndex(horse)
  if (horse.type !== 'Horse' || !isStableInteriorSpace(space) || index === null) return null
  const horses = getStableHorses(space.building)
  if (index >= horses.length) return null
  const [record] = horses.splice(index, 1)
  horse.label = `${horse.label}:detached:${++detachedHorseId}`
  reindexRemainingHorses(horse, map, index, space.id)
  space.building.horseAmount = horses.length
  syncStableInteriorHorses(space.building)
  return record ?? null
}

function reindexRemainingHorses(horse: RuntimeEntity, map: RuntimeMap, index: number, spaceId: string): void {
  for (const other of map.gaia?.animals ?? []) {
    if (other === horse || other.isDestroyed || other.type !== 'Horse' || other.spaceId !== horse.spaceId) continue
    const otherIndex = getStableInteriorHorseIndex(other)
    if (otherIndex !== null && otherIndex > index) {
      other.label = getStableInteriorHorseLabel(horse.spaceId ?? spaceId, otherIndex - 1)
    }
  }
}
