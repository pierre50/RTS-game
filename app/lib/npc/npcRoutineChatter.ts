import { UNIT_TYPES } from '../../constants'
import type { UnitEntity } from '../../types/entities'
import { heroCanCommand, isChiefUnit } from '../chief'
import { getLang } from '../lang'
import { pickRandomItem } from '../random'
import { getVillagerAssignedJob } from '../units/villagerAssignments'
import { getVillagerSchedule } from '../units/villagerSchedule'
import {
  getForeignNpcMood,
  pickForeignNpcChatterLine,
  pickForeignNpcSleepingChatterLine,
  pickNpcChatterLine,
  pickNpcGreetingLine,
  pickNpcSleepingChatterLine,
} from './npcChatter'
import { NPC_ROUTINE_LINES, type NpcAudience, type NpcRoutinePhase } from './npcRoutineLines'

function routinePhase(unit: UnitEntity): NpcRoutinePhase {
  if (unit.type !== UNIT_TYPES.villager && !isChiefUnit(unit)) return 'idle'
  const { hour = 12, minute = 0 } = unit.context?.dayNight?.state ?? {}
  const now = hour * 60 + minute
  const { wakeMinute, workStartMinute, workEndMinute, bedMinute } = getVillagerSchedule(unit)
  if (now >= wakeMinute && now < workStartMinute) return 'morning'
  if (now >= workEndMinute && now < bedMinute) return 'evening'
  if (now >= workStartMinute && now < workEndMinute) return 'work'
  return 'idle'
}

function audienceFor(unit: UnitEntity, hero: UnitEntity | null | undefined): NpcAudience {
  const own = Boolean(hero?.owner && unit.owner === hero.owner)
  if (own) return heroCanCommand(hero) ? 'ownChief' : 'ownPeer'
  return heroCanCommand(hero) ? 'foreignChief' : 'visitor'
}

// Called once when opening communication, never while resolving the per-frame proximity prompt.
// Sleeping is captured before noticeNpc can wake the speaker.
export function pickNpcRoutineChatterLine(
  unit: UnitEntity,
  hero?: UnitEntity | null,
  options: { sleeping?: boolean; playerName?: string } = {}
): string {
  const audience = audienceFor(unit, hero)
  const sleeping = options.sleeping ?? (unit.shelterState?.reason === 'sleep' && unit.sleepVisualState === 'sleeping')
  if (sleeping) {
    return audience === 'ownChief' && !isChiefUnit(unit)
      ? pickNpcSleepingChatterLine()
      : pickForeignNpcSleepingChatterLine()
  }
  const lines = NPC_ROUTINE_LINES[getLang() === 'en' ? 'en' : 'fr']
  const phase = routinePhase(unit)
  const foreign = audience === 'foreignChief' || audience === 'visitor'
  const mood = getForeignNpcMood(unit)
  if (isChiefUnit(unit)) {
    const greeting =
      foreign && mood !== 'neutral' ? lines.foreignChiefGreeting[mood][audience] : lines.chiefGreeting[audience]
    return `${pickRandomItem(lines.chief[phase])} ${pickRandomItem(greeting)}`
  }
  if (phase === 'morning' || phase === 'evening') {
    const rest = foreign && mood !== 'neutral' ? lines.foreignRest[mood][phase][audience] : lines.rest[phase][audience]
    return pickRandomItem(rest)
  }
  const job = unit.autonomousJob ?? getVillagerAssignedJob(unit)
  if (phase === 'work' && job && Object.hasOwn(lines.jobs, job)) {
    const address = audience === 'ownChief' ? (getLang() === 'en' ? ', chief' : ', chef') : ''
    const workLine = pickRandomItem(lines.jobs[job]).replace('{address}', address)
    if (audience === 'ownChief' || audience === 'ownPeer') return workLine
    return `${workLine} ${pickRandomItem(lines.foreignWork[mood][audience])}`
  }
  if (audience === 'ownChief') return pickNpcGreetingLine(options.playerName || (getLang() === 'en' ? 'chief' : 'chef'))
  if (audience === 'ownPeer') return pickNpcChatterLine()
  return pickForeignNpcChatterLine(unit)
}
