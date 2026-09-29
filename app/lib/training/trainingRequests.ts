import { VillageScheduleGate } from '../units/VillageScheduleGate'
import { notifyVillageStateChanged } from '../units/villageStateEvents'
import type { GameContextLike } from '../../types/context'
import { getStableHorseAmount } from '../horses/stableHorses'
import { shouldVillagerWork } from '../units/villagerSchedule'
import { wakeUnitSimulation } from '../units/unitSuspension'
import { ACTION_TYPES, BUILDING_TYPES } from '../../constants'
import { canUnitTrainInto, hasBuildingTrainingCapacity, isTraineeTrainingType } from '../buildings/buildingTraining'
import { hasPriorityCombat } from '../units/autonomy/villagerAutonomyAvailability'
import { hasLivingChief, playerNeedsChiefForCommand } from '../chief'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

export function requestBuildingTraining(building: BuildingEntity, type: string, count: number): boolean {
  if (!building.isBuilt || building.isDead || building.isDestroyed || !isTraineeTrainingType(building, type))
    return false
  if (!Number.isSafeInteger(count) || count <= 0) return false
  building.trainingRequests ??= []
  for (let index = 0; index < count; index++) building.trainingRequests.push({ type })
  notifyVillageStateChanged(building.owner)
  if (building.owner) dispatchTrainingRequests(building.owner)
  return true
}

export function completeTrainingRequest(building: BuildingEntity, label: string): void {
  const index = building.trainingRequests?.findIndex(request => request.traineeLabel === label) ?? -1
  if (index >= 0) {
    building.trainingRequests!.splice(index, 1)
    notifyVillageStateChanged(building.owner)
  }
}

function availableRecruit(unit: UnitEntity): boolean {
  return Boolean(
    !unit.isChief &&
      !unit.trainingTargetType &&
      !unit.pendingOrder &&
      !hasPriorityCombat(unit) &&
      !unit.isDead &&
      !unit.isDestroyed &&
      unit.controlMode !== 'hero' &&
      !unit.followingHero &&
      !unit.lookingAtHero &&
      !unit.isDirectMoving &&
      !unit.actionLocked &&
      !unit.resourceDeliveryState &&
      !unit.shelterState &&
      !unit.sleepVisualState &&
      !unit.suspendedRestState &&
      !unit.spacePortalState &&
      !unit.interiorExitState &&
      shouldVillagerWork(unit)
  )
}

export function dispatchTrainingRequests(owner: PlayerLike): void {
  if (playerNeedsChiefForCommand(owner) && !hasLivingChief(owner)) return
  for (const building of owner.buildings ?? []) {
    if (!building.isBuilt || building.isDead || building.isDestroyed || !building.trainingRequests?.length) continue
    const candidates = owner.units
      .filter(availableRecruit)
      .sort((a, b) => Math.hypot(a.i - building.i, a.j - building.j) - Math.hypot(b.i - building.i, b.j - building.j))
    const requests = [
      ...building.trainingRequests.filter(request => request.traineeLabel),
      ...building.trainingRequests.filter(request => !request.traineeLabel),
    ]
    const incomingCount = requests.filter(request => request.traineeLabel).length
    for (const [requestIndex, request] of requests.entries()) {
      if (request.traineeLabel) {
        if (building.trainingQueue?.some(entry => entry.trainee.label === request.traineeLabel)) {
          completeTrainingRequest(building, request.traineeLabel)
          continue
        }
        const unit = owner.units.find(unit => unit.label === request.traineeLabel)
        if (
          unit &&
          !unit.isDead &&
          !unit.isDestroyed &&
          !unit.followingHero &&
          !hasPriorityCombat(unit) &&
          unit.trainingTargetType === request.type &&
          unit.dest === building &&
          unit.action === ACTION_TYPES.train
        )
          continue
        // A combat or follow order releases this reservation; the request stays in the queue.
        if (unit?.trainingTargetType === request.type) unit.trainingTargetType = null
        delete request.traineeLabel
      }
      if (!hasBuildingTrainingCapacity(building)) {
        if (requestIndex >= incomingCount) break
        continue
      }
      if (building.type === BUILDING_TYPES.stable) {
        const incoming = owner.units.filter(
          unit => !unit.isDead && !unit.isDestroyed && unit.dest === building && unit.trainingTargetType
        ).length
        if (getStableHorseAmount(building) <= incoming) continue
      }
      for (const unit of candidates) {
        if (!availableRecruit(unit) || !canUnitTrainInto(building, unit, request.type)) continue
        wakeUnitSimulation(unit)
        unit.trainingTargetType = request.type
        request.traineeLabel = unit.label
        const sent: unknown = unit.sendToEvt?.(building, ACTION_TYPES.train, {
          forceRepath: true,
          allowPassageStop: true,
        })
        const entered = building.trainingQueue?.some(entry => entry.trainee.label === unit.label)
        if (entered) completeTrainingRequest(building, unit.label)
        if (entered || (sent !== false && unit.dest === building && unit.action === ACTION_TYPES.train)) {
          unit.autonomousJob = null
          unit.collectiveTask = null
          unit.previousDest = null
          unit.previousWork = null
          break
        }
        unit.trainingTargetType = null
        delete request.traineeLabel
      }
    }
  }
}

export function cancelBuildingTrainingRequest(
  building: BuildingEntity,
  request: NonNullable<BuildingEntity['trainingRequests']>[number]
): void {
  const index = building.trainingRequests?.indexOf(request) ?? -1
  if (index < 0) return
  building.trainingRequests!.splice(index, 1)
  notifyVillageStateChanged(building.owner)
  const unit = building.owner?.units.find(unit => unit.label === request.traineeLabel)
  if (
    unit &&
    unit.dest === building &&
    unit.action === ACTION_TYPES.train &&
    unit.trainingTargetType === request.type
  ) {
    unit.trainingTargetType = null
    unit.stop?.()
  }
}

const trainingGates = new WeakMap<PlayerLike, VillageScheduleGate>()
export function flushTrainingRequests(owner: PlayerLike, context: GameContextLike): void {
  let gate = trainingGates.get(owner)
  if (!gate) {
    gate = new VillageScheduleGate()
    trainingGates.set(owner, gate)
  }
  const clock = { dayNight: context.dayNight, players: [owner] }
  if (!gate.due(clock)) return
  dispatchTrainingRequests(owner)
  gate.settle(clock)
}
