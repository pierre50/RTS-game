import { BUILDING_TYPES, UNIT_TYPES, MOUNTED_HORSE_SPEED_BONUS } from '../../../constants'
import { BUILDING_TRAINING_CAPACITY } from '../../../lib/buildings/buildingTraining'
import { getTrainingDurationDays } from '../../../lib/training/trainingRules'
import { hasLivingChief, playerNeedsChiefForCommand } from '../../../lib/chief'
import { getVillagerWorkingMinutes } from '../../../lib/units/village/villagerSchedule'
import { consumeStableHorse, getStableHorseAmount } from '../../../lib/horses/stableHorses'
import type { BuildingEntity } from '../../../types/entities'
import type { SaveEntityState, SavePlayerState } from '../../../types/save'
import type { TrainingTrainee } from '../../../types/training'
import { isLiving, type OfflineWorldSpatial } from './OfflineWorldSpatial'
import { travelMs, type OfflineWorkRules } from './OfflineWorldWork'

function targetLabel(unit: SaveEntityState): string | undefined {
  return typeof unit.dest === 'string' ? unit.dest : Array.isArray(unit.dest) ? unit.dest[2] : unit.dest?.label
}

export function advanceOfflineTrainingRequests(
  player: SavePlayerState,
  playerIndex: number,
  day: number,
  fromMinute: number,
  toMinute: number,
  minuteMs: number,
  spatial: OfflineWorldSpatial,
  rules: OfflineWorkRules
): void {
  if (playerNeedsChiefForCommand(player) && !hasLivingChief(player)) return
  for (const building of player.buildings ?? []) {
    if (!isLiving(building) || !building.isBuilt) continue
    const config = rules.buildingConfig(playerIndex, building.type)
    for (const request of [...(building.trainingRequests ?? [])]) {
      if (!config.units?.includes(request.type)) continue
      let unit = request.traineeLabel ? player.units?.find(unit => unit.label === request.traineeLabel) : undefined
      if (
        unit &&
        (!isLiving(unit) ||
          unit.followingHero ||
          unit.controlMode === 'hero' ||
          unit.isFleeing ||
          unit.trainingTargetType !== request.type ||
          unit.action !== 'train' ||
          targetLabel(unit) !== building.label)
      ) {
        if (unit.trainingTargetType === request.type) unit.trainingTargetType = null
        unit = undefined
      }
      if (!unit) {
        delete request.traineeLabel
        delete request.travelRemainingMs
        const incoming = (player.units ?? []).filter(
          unit => isLiving(unit) && unit.trainingTargetType && targetLabel(unit) === building.label
        ).length
        if ((building.trainingQueue?.length ?? 0) + incoming >= BUILDING_TRAINING_CAPACITY) continue
        if (
          building.type === BUILDING_TYPES.stable &&
          getStableHorseAmount(building as unknown as BuildingEntity) <= incoming
        )
          continue
        const point = spatial.findNear(building)
        if (!point) continue
        unit = (player.units ?? [])
          .filter(
            unit =>
              isLiving(unit) &&
              !unit.isChief &&
              unit.controlMode !== 'hero' &&
              !unit.followingHero &&
              !unit.trainingTargetType &&
              !unit.isFleeing &&
              !unit.resourceDelivery &&
              (unit.spaceId ?? 'outside') === (building.spaceId ?? 'outside') &&
              !unit.cavePosition &&
              !['attack', 'flee', 'train'].includes(unit.action ?? '') &&
              getVillagerWorkingMinutes(unit, fromMinute, toMinute) > 0 &&
              (building.type === BUILDING_TYPES.stable
                ? unit.type === request.type && !unit.mountedOnHorse
                : unit.type === UNIT_TYPES.villager)
          )
          .sort(
            (a, b) => Math.hypot(a.i - building.i, a.j - building.j) - Math.hypot(b.i - building.i, b.j - building.j)
          )
          .find(candidate => spatial.reachable(candidate, point))
        if (!unit) continue
        request.traineeLabel = unit.label
        request.travelRemainingMs = travelMs(unit, point, rules.unitConfig(playerIndex, unit.type)) + 1000
        unit.trainingTargetType = request.type
        unit.action = 'train'
        unit.dest = [building.i, building.j, building.label]
        unit.autonomousJob = null
        unit.collectiveTask = null
        delete unit.resourceDelivery
        delete unit.offlineWork
      }
      if (request.travelRemainingMs == null) {
        const point = spatial.findNear(building)
        if (!point || !spatial.reachable(unit, point)) continue
        request.travelRemainingMs = travelMs(unit, point, rules.unitConfig(playerIndex, unit.type)) + 1000
      }
      request.travelRemainingMs = Math.max(
        0,
        request.travelRemainingMs - getVillagerWorkingMinutes(unit, fromMinute, toMinute) * minuteMs
      )
      if (request.travelRemainingMs > 0) continue
      // Saved incoming orders may exceed today's capacity; never admit an extra trainee.
      if ((building.trainingQueue?.length ?? 0) >= BUILDING_TRAINING_CAPACITY) continue
      const mounting = building.type === BUILDING_TYPES.stable
      const horse = mounting ? consumeStableHorse(building as unknown as BuildingEntity) : null
      if (mounting && !horse) continue
      const duration = getTrainingDurationDays(
        rules.unitConfig(playerIndex, request.type),
        mounting ? config.mountingDays : undefined
      )
      building.trainingQueue ??= []
      building.trainingQueue.push({
        type: request.type,
        trainee: structuredClone(unit) as TrainingTrainee,
        extra: {
          label: unit.label,
          name: unit.name,
          gender: unit.gender,
          inventory: unit.inventory,
          appearanceVariants: unit.appearanceVariants,
          experience: mounting ? unit.experience : {},
          ...(mounting
            ? {
                mountedOnHorse: true,
                horseColor: horse?.horseColor,
                speed: (Number(rules.unitConfig(playerIndex, unit.type).speed) || 1.5) + MOUNTED_HORSE_SPEED_BONUS,
              }
            : {}),
        },
        cost: {},
        loading: 0,
        trainingStartedDay: day,
        trainingCompleteDay: day + duration,
      })
      spatial.release(unit)
      player.units!.splice(player.units!.indexOf(unit), 1)
      building.trainingRequests!.splice(building.trainingRequests!.indexOf(request), 1)
      building.queue = building.trainingQueue.map(entry => entry.type)
      const first = building.trainingQueue[0]
      building.loading = first.loading
      building.trainingStartedDay = first.trainingStartedDay
      building.trainingCompleteDay = first.trainingCompleteDay
    }
  }
}
