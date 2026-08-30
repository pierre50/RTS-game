import type { AnimalEntity, RuntimeEntity } from '../../types/entities'

export const HORSE_TAMING_STATUS = {
  wild: 'wild',
  tamed: 'tamed',
} as const

export type HorseTamingStatus = (typeof HORSE_TAMING_STATUS)[keyof typeof HORSE_TAMING_STATUS]

export type HorseTamingState = {
  tamingStatus?: unknown
}

export function isHorseTamingStatus(value: unknown): value is HorseTamingStatus {
  return value === HORSE_TAMING_STATUS.wild || value === HORSE_TAMING_STATUS.tamed
}

function normalizeHorseTamingStatus(value: unknown, fallback: HorseTamingStatus): HorseTamingStatus {
  return isHorseTamingStatus(value) ? value : fallback
}

export function getHorseTamingStatus(
  horse: Pick<RuntimeEntity, 'type'> & HorseTamingState,
  fallback: HorseTamingStatus = HORSE_TAMING_STATUS.wild
): HorseTamingStatus {
  if (horse.type !== 'Horse') return fallback
  return normalizeHorseTamingStatus(horse.tamingStatus, fallback)
}

export function isWildHorse(horse: (Pick<RuntimeEntity, 'type'> & HorseTamingState) | null | undefined): boolean {
  return Boolean(horse && horse.type === 'Horse' && getHorseTamingStatus(horse) === HORSE_TAMING_STATUS.wild)
}

export function isTamedHorse(horse: (Pick<RuntimeEntity, 'type'> & HorseTamingState) | null | undefined): boolean {
  return Boolean(horse && horse.type === 'Horse' && getHorseTamingStatus(horse) === HORSE_TAMING_STATUS.tamed)
}

export function setHorseTamingStatus(horse: AnimalEntity, status: HorseTamingStatus): void {
  if (horse.type !== 'Horse') return
  horse.tamingStatus = status
}

export function tameHorse(horse: AnimalEntity): void {
  setHorseTamingStatus(horse, HORSE_TAMING_STATUS.tamed)
}

export function shouldHorseFleeFromThreat(horse: (Pick<RuntimeEntity, 'type'> & HorseTamingState) | null | undefined): boolean {
  return !horse || horse.type !== 'Horse' || isWildHorse(horse)
}
