import { isStaticSettlement } from '../../../config/settlementProfiles'
import { getTrainingDurationDays } from '../../../lib/training/trainingRules'
import {
  MAX_INFANTRY,
  MAX_ARCHERS,
  AI_DIFFICULTIES,
  AI_BUILDING_TRAINING_CAPACITY,
  AI_ABSTRACT_DAILY_RECRUITS,
} from '../../../ai/config'
import { BUILDING_TYPES, UNIT_TYPES } from '../../../constants'
import { isOfflineWorker, type OfflineWorkRules } from '../offline/OfflineWorldWork'
import { isLiving, type OfflineWorldSpatial } from '../offline/OfflineWorldSpatial'
import type { SerializedSave } from '../../../types/save'

export function planAbstractTraining(
  state: SerializedSave,
  day: number,
  rules: OfflineWorkRules,
  spatial: OfflineWorldSpatial
): void {
  state.players.forEach((player, index) => {
    if (isStaticSettlement(player)) return
    if (player.type !== 'AI' || player.aiState?.phase !== 'military_build') return
    const workers = (player.units ?? []).filter(isOfflineWorker)
    const difficulty =
      AI_DIFFICULTIES[state.config?.difficulty as keyof typeof AI_DIFFICULTIES] ?? AI_DIFFICULTIES.medium
    const reserveWorkers = Math.max(4, Math.ceil(difficulty.econToMilVillagers * 0.6))
    let budget = Math.min(AI_ABSTRACT_DAILY_RECRUITS, workers.length - reserveWorkers)
    for (const [type, buildingType, cap] of [
      [UNIT_TYPES.infantry, BUILDING_TYPES.barracks, MAX_INFANTRY],
      [UNIT_TYPES.bowman, BUILDING_TYPES.archeryRange, MAX_ARCHERS],
    ] as const) {
      const config = rules.unitConfig(index, type)
      const queued = (player.buildings ?? [])
        .flatMap(b => b.trainingQueue ?? [])
        .filter(entry => entry.type === type).length
      let need =
        cap -
        queued -
        (player.units ?? []).filter(u => isLiving(u) && (u.type === type || u.trainingTargetType === type)).length
      for (const worker of workers) {
        if (budget <= 0 || need <= 0) break
        if (worker.autonomousJob === 'construction' || worker.work === 'builder' || !player.units?.includes(worker))
          continue
        const building = player.buildings?.find(
          b =>
            b.type === buildingType &&
            b.isBuilt &&
            isLiving(b) &&
            (b.trainingQueue?.length ?? 0) < AI_BUILDING_TRAINING_CAPACITY
        )
        if (!building || !worker.label) continue
        const trainee = {
          type: worker.type,
          label: worker.label,
          i: worker.i,
          j: worker.j,
          ...(worker.name !== undefined ? { name: worker.name } : {}),
          gender: worker.gender,
          appearanceVariants: worker.appearanceVariants,
          ...(worker.inventory !== undefined ? { inventory: structuredClone(worker.inventory) } : {}),
        }
        building.trainingQueue ??= []
        building.trainingQueue.push({
          type,
          trainee,
          cost: {},
          loading: 0,
          trainingStartedDay: day,
          trainingCompleteDay: day + getTrainingDurationDays(config),
        })
        building.queue = building.trainingQueue.map(entry => entry.type)
        building.loading = building.trainingQueue[0].loading
        building.trainingStartedDay = building.trainingQueue[0].trainingStartedDay
        building.trainingCompleteDay = building.trainingQueue[0].trainingCompleteDay
        spatial.release(worker)
        player.units.splice(player.units.indexOf(worker), 1)
        budget--
        need--
      }
    }
  })
}
