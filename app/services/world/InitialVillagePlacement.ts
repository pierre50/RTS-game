import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import { TYPE_ACTION } from '../../constants/entities'
import { getVillagerSchedule } from '../../lib/units/villagerSchedule'
import { distance, isLiving, OfflineWorldSpatial, type OfflineTerrainCell } from './OfflineWorldSpatial'
import { offlineResourceWork, stopOfflineTask, type OfflineWorkRules } from './OfflineWorldWork'
import type { SaveEntityState, SerializedSave } from '../../types/save'

/** Only used when materializing an unvisited village, never for a saved return trip. */
export function placeInitialVillageUnits(
  state: SerializedSave,
  factions: Set<string>,
  terrain: (OfflineTerrainCell | null | undefined)[][],
  rules: OfflineWorkRules
): void {
  const spatial = new OfflineWorldSpatial(
    terrain,
    state,
    (building, index) => Number(rules.buildingConfig(index, building.type).size) || 2
  )
  const minutes =
    (((state.runtime?.dayNightElapsedMs ?? 0) / DAY_NIGHT_CONFIG.dayLengthMs) * 1440 +
      DAY_NIGHT_CONFIG.startHour * 60) %
    1440
  const assigned = new Map<SaveEntityState, number>()
  for (const player of state.players) {
    if (player.type !== 'AI' || player.isPlayed || !player.factionId || !factions.has(player.factionId)) continue
    const buildings = (player.buildings ?? []).filter(b => isLiving(b) && (!b.spaceId || b.spaceId === 'outside'))
    const center = buildings.find(b => b.type === 'TownCenter' && b.isBuilt)
    if (!center) continue
    for (const unit of player.units ?? []) {
      if (
        !isLiving(unit) ||
        unit.followingHero ||
        unit.controlMode === 'hero' ||
        unit.trainingTargetType ||
        (unit.spaceId && unit.spaceId !== 'outside')
      )
        continue
      const schedule = getVillagerSchedule(unit)
      const working =
        unit.type === 'Villager' && minutes >= schedule.workStartMinute && minutes < schedule.workEndMinute
      const builder = unit.autonomousJob === 'construction' || unit.work === 'builder'
      let targets: SaveEntityState[] = []
      let workingTarget = false
      if (working) {
        targets = builder
          ? buildings.filter(b => !b.isBuilt)
          : state.resources.filter(
              r => distance(center, r) <= 30 && offlineResourceWork(player, unit, r, rules.wheatMatureFrame)
            )
        workingTarget = targets.length > 0
      }
      if (!targets.length) {
        const types =
          unit.type === 'Villager'
            ? ['House', 'TownCenter']
            : unit.type === 'Chief'
              ? ['TownCenter']
              : ['Barracks', 'ArcheryRange', 'Stable', 'WatchTower', 'TownCenter']
        targets = buildings.filter(b => b.isBuilt && types.includes(b.type))
        const preferred = targets.filter(b => b.type !== 'TownCenter')
        if (preferred.length) targets = preferred
      }
      targets.sort(
        (a, b) => (assigned.get(a) ?? 0) - (assigned.get(b) ?? 0) || distance(center, a) - distance(center, b)
      )
      for (const target of targets) {
        const point = spatial.findNear(target, workingTarget && !builder ? 1 : 6, unit)
        if (!point) continue
        spatial.move(unit, point)
        stopOfflineTask(unit)
        delete unit.offlineWork
        if (workingTarget) {
          unit.work = builder ? 'builder' : offlineResourceWork(player, unit, target, rules.wheatMatureFrame)
          unit.dest = target.label ? [target.i, target.j, target.label] : [target.i, target.j]
          unit.action = builder ? 'build' : TYPE_ACTION[target.type as keyof typeof TYPE_ACTION]
          unit.inactif = false
        }
        assigned.set(target, (assigned.get(target) ?? 0) + 1)
        break
      }
    }
  }
}
