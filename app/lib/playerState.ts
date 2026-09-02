import { PLAYER_TYPES } from '../constants'
import type { RuntimeEntity } from '../types/entities'

type UnitState = {
  hitPoints?: number
  isDead?: boolean
}

type GaiaState = {
  animals?: RuntimeEntity[]
  units?: RuntimeEntity[]
}

export function getGaiaAnimals(gaia?: GaiaState | null): RuntimeEntity[] {
  return gaia?.animals ?? gaia?.units ?? []
}

type BuildingState = UnitState & {
  isBuilt?: boolean
  range?: number
  units?: string[]
}

type PlayerState = {
  buildings?: BuildingState[]
  type?: string
  units?: UnitState[]
}

export function isAIControlledPlayer(player?: PlayerState | null): boolean {
  return player?.type === PLAYER_TYPES.ai || player?.type === PLAYER_TYPES.bandits
}

function isOperationalBuilding(building?: BuildingState | null): boolean {
  if (!building || building.isDead || (building.hitPoints ?? 0) <= 0 || !building.isBuilt) {
    return false
  }

  if ((building.range ?? 0) > 0) {
    return true
  }

  return Array.isArray(building.units) && building.units.length > 0
}

function hasLivingUnits(player?: PlayerState | null): boolean {
  return !!player?.units?.some(unit => unit && !unit.isDead && (unit.hitPoints ?? 0) > 0)
}

function hasOperationalBuildings(player?: PlayerState | null): boolean {
  return !!player?.buildings?.some(isOperationalBuilding)
}

export function canPlayerStillAct(player?: PlayerState | null): boolean {
  return hasLivingUnits(player) || hasOperationalBuildings(player)
}

export function isPlayerEliminated(player?: PlayerState | null): boolean {
  return !canPlayerStillAct(player)
}

export function isPlayedHeroDefeated(player?: PlayerState | null, hero?: UnitState | null): boolean {
  const playerHero = hero ?? player?.units?.[0] ?? null
  return !playerHero || playerHero.isDead || (playerHero.hitPoints ?? 0) <= 0
}
