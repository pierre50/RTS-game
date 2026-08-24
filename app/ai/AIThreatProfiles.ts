import { BUILDING_TYPES, FAMILY_TYPES, UNIT_TYPES } from '../constants'
import { isChiefUnit } from '../lib/chief'
import type { AIEntityLike } from './types'
import type { StoredThreat, ThreatManagerPlayer, ThreatProfile } from './AIThreatTypes'

export function getThreatProfile(
  player: ThreatManagerPlayer,
  threat: StoredThreat & { hostiles: AIEntityLike[] },
  homeAnchor: AIEntityLike | null
): ThreatProfile {
  const military = player.strategy.military
  const hostileUnits = threat.hostiles.filter((hostile: AIEntityLike) => hostile.family === FAMILY_TYPES.unit)
  const hostileMilitary = hostileUnits.filter((hostile: AIEntityLike) => hostile.type !== UNIT_TYPES.villager)
  const hostileVillagers = hostileUnits.filter((hostile: AIEntityLike) => hostile.type === UNIT_TYPES.villager)
  const hostileAnimals = threat.hostiles.filter((hostile: AIEntityLike) => hostile.family === FAMILY_TYPES.animal)
  const hostilePower = military.getGroupCombatPower(threat.hostiles)
  const targetDistanceToHome = homeAnchor
    ? Math.abs(threat.target.i - homeAnchor.i) + Math.abs(threat.target.j - homeAnchor.j)
    : Infinity
  const targetIsTownCenter = threat.target.type === BUILDING_TYPES.townCenter
  const targetIsBuilding = threat.target.family === FAMILY_TYPES.building
  const targetIsVillager = threat.target.type === UNIT_TYPES.villager
  const targetIsChief = isChiefUnit(threat.target)
  const homeThreatRadius = player.difficultyConfig.homeThreatRadius || 15
  const villageCoreRadius = Math.min(homeThreatRadius, player.difficultyConfig.villageCoreRadius || 10)
  const isNearHome = targetDistanceToHome <= homeThreatRadius
  const isInVillageCore = targetDistanceToHome <= villageCoreRadius
  const isRemoteVillagerIncident = targetIsVillager && !isNearHome
  const isDirectVillageAssault =
    hostileMilitary.length > 0 && (targetIsTownCenter || targetIsBuilding || isInVillageCore)
  const isSeriousMilitaryThreat =
    hostileMilitary.length > 0 && (isNearHome || hostilePower >= (player.difficultyConfig.defenseRecallThreshold || 16) * 0.85)

  let priority = hostilePower + threat.hostiles.length * 2 + threat.count
  if (targetIsTownCenter) priority += 16
  else if (targetIsChief) priority += 22
  else if (targetIsBuilding) priority += 9
  else if (targetIsVillager) priority += 2

  if (isNearHome) priority += 10
  if (isInVillageCore) priority += 7
  if (hostileMilitary.length > 0) priority += 12 + hostileMilitary.length * 4
  else if (hostileVillagers.length > 0) priority += 4 + hostileVillagers.length * 2
  else if (hostileAnimals.length > 0) priority -= 4
  if (isRemoteVillagerIncident && hostileMilitary.length === 0) priority -= 6

  return {
    hostileUnits,
    hostileMilitary,
    hostileVillagers,
    hostileAnimals,
    hostilePower,
    isNearHome,
    isInVillageCore,
    isRemoteVillagerIncident,
    isDirectVillageAssault,
    isSeriousMilitaryThreat,
    targetDistanceToHome,
    isCriticalBuilding: targetIsTownCenter,
    isChief: targetIsChief,
    isBuilding: targetIsBuilding,
    priority,
  }
}

export function getDefensePowerNeed(player: ThreatManagerPlayer, profile: ThreatProfile): number {
  if (!profile) return 0

  if (profile.hostileMilitary.length > 0) {
    const powerRatio = player.difficultyConfig.defensePowerRatio || 0.85
    const baseNeed = Math.max(6, profile.hostilePower * powerRatio)
    if (profile.isChief) return baseNeed * 1.35
    if (profile.isDirectVillageAssault) return baseNeed * 1.15
    if (profile.isRemoteVillagerIncident) return baseNeed * 0.75
    return profile.isCriticalBuilding ? baseNeed * 1.15 : baseNeed
  }

  if (profile.hostileVillagers.length > 0) {
    if (profile.isRemoteVillagerIncident) {
      if (profile.isChief) return Math.max(5, profile.hostileVillagers.length * 3)
      return Math.max(2, profile.hostileVillagers.length * 1.5)
    }
    return profile.isChief
      ? Math.max(6, profile.hostileVillagers.length * 3)
      : Math.max(3, profile.hostileVillagers.length * 2.5)
  }

  if (profile.hostileAnimals.length > 0) {
    if (profile.isRemoteVillagerIncident) {
      if (profile.isChief) return Math.min(5, Math.max(2, profile.hostileAnimals.length * 2))
      return Math.min(3, Math.max(1, profile.hostileAnimals.length))
    }
    return Math.min(5, Math.max(1.5, profile.hostileAnimals.length * 1.25))
  }

  return 0
}
