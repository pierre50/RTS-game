import { getVillagerSchedule, isSoldierUnit } from './villagerSchedule'
import type { SaveEntityState } from '../../types/save'

type WatchUnit = Pick<
  SaveEntityState,
  | 'type'
  | 'label'
  | 'i'
  | 'j'
  | 'isChief'
  | 'isDead'
  | 'isDestroyed'
  | 'controlMode'
  | 'followingHero'
  | 'trainingTargetType'
  | 'dailySchedule'
  | 'factionExpedition'
>

/** Called when the roster changes or a village is restored, never by individual movement callbacks. */
export function configureVillageNightWatch(owner: {
  type?: string
  isPlayed?: boolean
  settlementType?: string
  units?: WatchUnit[]
}): void {
  if (owner.type !== 'AI' || owner.isPlayed || !owner.settlementType) return
  const units = owner.units ?? []
  const living = units.filter(
    unit =>
      !unit.isDead &&
      !unit.isDestroyed &&
      unit.controlMode !== 'hero' &&
      !unit.followingHero &&
      !unit.trainingTargetType &&
      !unit.factionExpedition
  )
  const escorts = living.some(unit => unit.type === 'Chief' || unit.isChief)
    ? new Set(living.filter(unit => unit.type === 'Fantassin').slice(0, 2))
    : new Set<WatchUnit>()
  const soldiers = living
    .filter(unit => isSoldierUnit(unit) && !escorts.has(unit))
    .sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''))
  for (const unit of units) {
    if (unit.dailySchedule?.nightWatch && !soldiers.includes(unit)) delete unit.dailySchedule.nightWatch
  }
  soldiers.forEach((unit, index) => {
    getVillagerSchedule(unit).nightWatch = index % 2 ? 'late' : 'early'
  })
}

export function isNightWatchDuty(unit: WatchUnit, minute: number): boolean {
  const shift = unit.dailySchedule?.nightWatch
  const now = ((minute % 1440) + 1440) % 1440
  return shift === 'early' ? now >= 1320 || now < 120 : shift === 'late' && now >= 120 && now < 360
}
