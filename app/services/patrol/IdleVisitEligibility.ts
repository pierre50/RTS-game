import { isRpgVillager, RPG_VILLAGE_WORKERS } from '../../config/rpgVillages'
import { isChiefEscort } from '../../lib/units/chiefEscort'
import { isChiefUnit } from '../../lib/chief'
import { isUnitSuspended } from '../../lib/units/unitSuspension'
import { isDistantOwner } from '../../lib/units/village/villageActivity'
import { shouldVillagerWork } from '../../lib/units/village/villagerSchedule'
import type { UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

const IDLE_VISIT_UNIT_TYPES = ['Villager', 'Chief', 'Fantassin', 'Bowman']

function isOutsideIdleRoster(unit: UnitEntity, owner: PlayerLike): boolean {
  return Boolean(
    !IDLE_VISIT_UNIT_TYPES.includes(unit.type) ||
      owner.type === 'Bandits' ||
      unit.campPatrolAnchor ||
      unit.banditCampAnchor ||
      unit.isDead ||
      unit.isDestroyed ||
      isUnitSuspended(unit) ||
      isDistantOwner(owner)
  )
}

function isOccupied(unit: UnitEntity): boolean {
  return Boolean(
    unit.controlMode === 'hero' ||
      unit.followingHero ||
      unit.lookingAtHero ||
      unit.combatMode ||
      unit.action ||
      unit.autonomousJob ||
      unit.collectiveTask ||
      unit.actionLocked ||
      unit.waitingForEnergyAction ||
      unit.trainingTargetType ||
      unit.pendingOrder ||
      unit.shelterState ||
      unit.resourceDeliveryState
  )
}

function isReservedVillageWorker(unit: UnitEntity, owner: PlayerLike): boolean {
  if (!isRpgVillager(unit)) return false
  const residents = owner.units.filter(u => isRpgVillager(u) && !u.isDead && !u.isDestroyed)
  const type = owner.settlementType ?? 'village'
  return residents.indexOf(unit) < RPG_VILLAGE_WORKERS[type]
}

function isOffDuty(unit: UnitEntity, owner: PlayerLike): boolean {
  if (unit.dailySchedule?.nightWatch && !shouldVillagerWork(unit)) return true
  if (unit.work && unit.work !== 'attacker') return true
  if (isChiefUnit(unit) && !owner.isPlayed) return true // AI chief keeps its dialogue/guard role.
  return unit.type === 'Villager' && !shouldVillagerWork(unit)
}

export function isIdleVisitEligible(unit: UnitEntity): boolean {
  const owner = unit.owner
  if (!owner || isOutsideIdleRoster(unit, owner) || isOccupied(unit) || isChiefEscort(unit)) return false
  return !isOffDuty(unit, owner) && !isReservedVillageWorker(unit, owner)
}
