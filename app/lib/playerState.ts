import { ACTION_TYPES, PLAYER_TYPES } from '../constants'
import type { RuntimeEntity } from '../types/entities'

type UnitState = {
  action?: string | null
  combatMode?: string | null
  hitPoints?: number
  isDead?: boolean
  isDestroyed?: boolean
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

export function isUnitAlive(unit?: UnitState | null): boolean {
  return Boolean(unit && !unit.isDead && !unit.isDestroyed && (unit.hitPoints ?? 0) > 0)
}

export function isUnitFleeing(unit?: UnitState | null): boolean {
  return Boolean(unit && (unit.combatMode === 'flee' || unit.action === ACTION_TYPES.flee))
}

export function isUnitAbleToHoldPlayerBuildings(unit?: UnitState | null): boolean {
  return isUnitAlive(unit) && !isUnitFleeing(unit)
}

function hasLivingUnits(player?: PlayerState | null): boolean {
  return !!player?.units?.some(isUnitAlive)
}

function hasActiveUnits(player?: PlayerState | null): boolean {
  return !!player?.units?.some(isUnitAbleToHoldPlayerBuildings)
}

function hasOperationalBuildings(player?: PlayerState | null): boolean {
  return !!player?.buildings?.some(isOperationalBuilding)
}

export function canPlayerStillAct(player?: PlayerState | null): boolean {
  return hasLivingUnits(player) || hasOperationalBuildings(player)
}

export function isPlayerEliminated(player?: PlayerState | null): boolean {
  if (isAIControlledPlayer(player)) return !hasActiveUnits(player)
  return !canPlayerStillAct(player)
}

export function isPlayedHeroDefeated(player?: PlayerState | null, hero?: UnitState | null): boolean {
  const playerHero = hero ?? player?.units?.[0] ?? null
  return !playerHero || playerHero.isDead || (playerHero.hitPoints ?? 0) <= 0
}
