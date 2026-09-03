import { ACTION_TYPES, FAMILY_TYPES } from '../constants'
import type { AIEntityLike } from './types'
import type { ActiveThreat, ThreatResponseManager } from './AIThreatTypes'

type ThreatResponseOptions = {
  villagers: AIEntityLike[]
  waitingMilitary: AIEntityLike[]
  debug?: boolean
}

function getDistanceToThreat(unit: AIEntityLike, threat: ActiveThreat): number {
  return Math.abs(unit.i - threat.target.i) + Math.abs(unit.j - threat.target.j)
}

function getResponseRadius(threat: ActiveThreat): number {
  const { profile } = threat
  if (profile.isCriticalBuilding) return 18
  if (profile.isDirectVillageAssault) return 14
  if (profile.isRemoteVillagerIncident) return profile.hostileAnimals.length > 0 ? 4 : 6
  return profile.isNearHome ? 12 : 10
}

function chooseMilitaryDefenders(
  manager: ThreatResponseManager,
  threat: ActiveThreat,
  waitingMilitary: AIEntityLike[],
  assignedMilitary: Set<string>
): AIEntityLike[] {
  const nearbyMilitary = waitingMilitary
    .filter((unit: AIEntityLike) => unit.label && !assignedMilitary.has(unit.label))
    .sort((a: AIEntityLike, b: AIEntityLike) => getDistanceToThreat(a, threat) - getDistanceToThreat(b, threat))
  const desiredDefensePower = manager.getDefensePowerNeed(threat.profile)
  const chosenMilitary: AIEntityLike[] = []
  let defensePower = 0

  for (const soldier of nearbyMilitary) {
    chosenMilitary.push(soldier)
    defensePower += manager.player.strategy.military.getCombatPower(soldier)
    if (defensePower >= desiredDefensePower) break
  }

  return chosenMilitary
}

function getNearbyVillagers(
  manager: ThreatResponseManager,
  threat: ActiveThreat,
  villagers: AIEntityLike[],
  assignedVillagers: Set<string>
): AIEntityLike[] {
  const responseRadius = getResponseRadius(threat)
  return villagers
    .filter((villager: AIEntityLike) => {
      if (assignedVillagers.has(villager.label) || villager === manager.player.scout || villager.isDead) return false
      if ((villager.hitPoints ?? 0) <= (villager.totalHitPoints ?? 1) * 0.35) return false
      return getDistanceToThreat(villager, threat) <= responseRadius
    })
    .sort((a: AIEntityLike, b: AIEntityLike) => getDistanceToThreat(a, threat) - getDistanceToThreat(b, threat))
}

function getVillagerDefenseCount(threat: ActiveThreat, nearbyVillagers: AIEntityLike[]): number {
  const { profile } = threat
  if (profile.isChief) {
    return Math.min(nearbyVillagers.length, Math.max(4, threat.hostiles.length + 3))
  }

  if (profile.hostileMilitary.length > 0) {
    if (!profile.isDirectVillageAssault && !profile.isCriticalBuilding) return 0
    return Math.min(nearbyVillagers.length, profile.isCriticalBuilding ? 4 : 3)
  }

  let villagerDefenseCount = 0
  if (profile.hostileAnimals.length > 0) {
    villagerDefenseCount =
      profile.hostileAnimals.length === 1
        ? 1
        : Math.min(
            profile.isCriticalBuilding ? 4 : profile.isRemoteVillagerIncident ? 2 : 3,
            profile.hostileAnimals.length
          )
  }

  if (profile.hostileVillagers.length > 0) {
    const criticalBonus = profile.isCriticalBuilding ? 2 : 0
    const remotePenalty = profile.isRemoteVillagerIncident ? 2 : 0
    const maxDefense = profile.isCriticalBuilding ? 8 : Math.max(2, 6 - remotePenalty)
    villagerDefenseCount = Math.max(
      villagerDefenseCount,
      Math.min(maxDefense, profile.hostileVillagers.length + criticalBonus)
    )
  }

  return villagerDefenseCount
}

function attackWithVillagers(
  threat: ActiveThreat,
  chosenVillagers: AIEntityLike[],
  assignedVillagers: Set<string>
): void {
  const primaryHostile = threat.hostiles[0]
  for (const villager of chosenVillagers) {
    assignedVillagers.add(villager.label)
    if (primaryHostile.family === FAMILY_TYPES.animal) {
      villager.sendToHunt?.(primaryHostile)
    } else {
      villager.sendToAttack?.(primaryHostile, { keepPrevious: true })
    }
  }
}

function getEvacuationGroups(
  threat: ActiveThreat,
  nearbyVillagers: AIEntityLike[],
  assignedVillagers: Set<string>
): { nearbyWorkersToEvacuate: AIEntityLike[]; evacVillagers: AIEntityLike[] } {
  const buildersOnSite = nearbyVillagers.filter(
    (villager: AIEntityLike) => villager.dest && 'label' in villager.dest && villager.dest.label === threat.target.label
  )
  const lethalThreat = threat.profile.hostileMilitary.length > 0
  const shouldEvacuateNearbyVillagers =
    lethalThreat && (threat.profile.isNearHome || threat.profile.isDirectVillageAssault)
  const nearbyWorkersToEvacuate = shouldEvacuateNearbyVillagers
    ? nearbyVillagers.filter(
        (villager: AIEntityLike) =>
          villager.label &&
          !assignedVillagers.has(villager.label) &&
          (!villager.dest || !('label' in villager.dest) || villager.dest.label !== threat.target.label)
      )
    : []
  const evacVillagers = buildersOnSite.filter(
    (villager: AIEntityLike) => villager.label && !assignedVillagers.has(villager.label)
  )
  return { nearbyWorkersToEvacuate, evacVillagers }
}

function evacuateVillagers(villagers: AIEntityLike[], hostile: AIEntityLike, assignedVillagers: Set<string>): void {
  for (const villager of villagers) {
    assignedVillagers.add(villager.label)
    villager.runaway?.(hostile)
  }
}

function logThreatResponse(
  threat: ActiveThreat,
  chosenMilitary: AIEntityLike[],
  chosenVillagers: AIEntityLike[],
  nearbyWorkersToEvacuate: AIEntityLike[],
  evacVillagers: AIEntityLike[]
): void {
  console.log(
    'Threat response:',
    threat.target.type,
    'hostiles=',
    threat.hostiles.length,
    'priority=',
    Math.round(threat.profile.priority),
    'military=',
    chosenMilitary.length,
    'villagers=',
    chosenVillagers.length,
    'fallback=',
    nearbyWorkersToEvacuate.length,
    'evac=',
    evacVillagers.length
  )
}

export function handleThreatResponses(manager: ThreatResponseManager, options: ThreatResponseOptions): number {
  const threats = manager.getActiveThreats()
  if (!threats.length) return 0

  let actions = 0
  const assignedMilitary = new Set<string>()
  const assignedVillagers = new Set<string>()

  for (const threat of threats) {
    const primaryHostile = threat.hostiles[0]
    if (!threat.target || !primaryHostile) continue

    const chosenMilitary = chooseMilitaryDefenders(manager, threat, options.waitingMilitary, assignedMilitary)
    for (const soldier of chosenMilitary) {
      assignedMilitary.add(soldier.label)
      soldier.sendTo?.(primaryHostile, ACTION_TYPES.attack)
    }

    const nearbyVillagers = getNearbyVillagers(manager, threat, options.villagers, assignedVillagers)
    const missingDefenders = Math.max(0, getVillagerDefenseCount(threat, nearbyVillagers) - chosenMilitary.length)
    const chosenVillagers = nearbyVillagers.slice(0, missingDefenders)
    attackWithVillagers(threat, chosenVillagers, assignedVillagers)

    const { nearbyWorkersToEvacuate, evacVillagers } = getEvacuationGroups(threat, nearbyVillagers, assignedVillagers)
    evacuateVillagers(nearbyWorkersToEvacuate, primaryHostile, assignedVillagers)
    evacuateVillagers(evacVillagers, primaryHostile, assignedVillagers)

    if (options.debug) {
      logThreatResponse(threat, chosenMilitary, chosenVillagers, nearbyWorkersToEvacuate, evacVillagers)
    }

    if (chosenMilitary.length || chosenVillagers.length || nearbyWorkersToEvacuate.length || evacVillagers.length) {
      actions++
    }
  }

  return actions
}
