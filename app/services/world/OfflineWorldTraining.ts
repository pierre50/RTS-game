import { definedProperties } from '../../lib/definedProperties'
import type { SaveEntityState, SerializedSave } from '../../types/save'
import { isLiving, type OfflineWorldSpatial } from './OfflineWorldSpatial'
import { stopOfflineTask, type OfflineWorkRules, type OfflineWorldReport } from './OfflineWorldWork'

/** Finish paid, identified recruits before daily events, without creating runtime objects or spending again. */
export function completeOfflineTraining(
  state: SerializedSave,
  day: number,
  spatial: OfflineWorldSpatial,
  rules: OfflineWorkRules,
  report: OfflineWorldReport
): void {
  state.players.forEach((player, playerIndex) => {
    for (const building of player.buildings ?? []) {
      if (!isLiving(building) || !building.isBuilt || !building.trainingQueue?.length) continue
      for (const entry of [...building.trainingQueue]) {
        const start = entry.trainingStartedDay
        const end = entry.trainingCompleteDay
        if (start == null || end == null) continue
        entry.loading =
          day >= end ? 100 : Math.min(100, Math.floor((Math.max(0, day - start) / Math.max(1, end - start)) * 100))
        if (day < end) continue
        const point = spatial.findNear(building)
        // A blocked exit keeps the completed recruit in the queue for the next attempt.
        if (!point || !spatial.reachable(building, point)) continue
        const label = entry.trainee.label
        if ((player.units ?? []).some(unit => unit.label === label)) continue
        const config = rules.unitConfig(playerIndex, entry.type)
        const unit: SaveEntityState = definedProperties({
          ...point,
          ...entry.extra,
          type: entry.type,
          label,
          ...definedProperties({
            name: entry.extra?.name ?? entry.trainee.name,
            gender: entry.extra?.gender ?? entry.trainee.gender,
            appearanceVariants: entry.extra?.appearanceVariants ?? entry.trainee.appearanceVariants,
          }),
          totalHitPoints: Number(config.totalHitPoints) || 18,
          hitPoints: entry.extra?.hitPoints ?? (Number(config.totalHitPoints) || 18),
          isDead: false,
          isDestroyed: false,
        })
        stopOfflineTask(unit)
        player.units ??= []
        player.units.push(unit)
        spatial.reserve(unit)
        building.trainingQueue.splice(building.trainingQueue.indexOf(entry), 1)
        report.trainingsCompleted++
      }
      building.queue = building.trainingQueue.map(entry => entry.type)
      const first = building.trainingQueue[0]
      building.loading = first?.loading ?? null
      building.trainingStartedDay = first?.trainingStartedDay ?? null
      building.trainingCompleteDay = first?.trainingCompleteDay ?? null
      if (!first) building.isUsedBy = null
    }
  })
}
