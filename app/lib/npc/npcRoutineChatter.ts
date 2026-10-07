import { UNIT_TYPES } from '../../constants'
import type { UnitEntity } from '../../types/entities'
import { heroCanCommand, isChiefUnit } from '../chief'
import { getLang } from '../lang'
import { pickRandomItem } from '../random'
import { getVillagerAssignedJob } from '../units/autonomy/villagerAssignments'
import { getDailyRoutinePhase, hasDailyRestSchedule, isSoldierUnit } from '../units/village/villagerSchedule'
import { isNightWatchDuty } from '../units/village/villageNightWatch'
import {
  getForeignNpcMood,
  pickForeignNpcChatterLine,
  pickForeignNpcSleepingChatterLine,
  pickNpcChatterLine,
  pickNpcGreetingLine,
  pickNpcSleepingChatterLine,
} from './npcChatter'
import { NPC_ROUTINE_LINES, type NpcAudience } from './npcRoutineLines'

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
  const phase = hasDailyRestSchedule(unit) ? getDailyRoutinePhase(unit) : 'idle'
  const address = audience === 'ownChief' ? (getLang() === 'en' ? ', chief' : ', chef') : ''
  if (unit.type === UNIT_TYPES.villager && !isChiefUnit(unit) && phase === 'meal') {
    return pickRandomItem(lines.lunch).replace('{address}', address)
  }
  const foreign = audience === 'foreignChief' || audience === 'visitor'
  const mood = getForeignNpcMood(unit)
  if (isChiefUnit(unit)) {
    const greeting =
      foreign && mood !== 'neutral' ? lines.foreignChiefGreeting[mood][audience] : lines.chiefGreeting[audience]
    return `${pickRandomItem(lines.chief[phase === 'sleep' ? 'idle' : phase])} ${pickRandomItem(greeting)}`
  }
  if (isSoldierUnit(unit)) {
    const { hour = 12, minute = 0 } = unit.context?.dayNight?.state ?? {}
    const duty = isNightWatchDuty(unit, hour * 60 + minute)
    const guardPhase = duty
      ? 'nightWatch'
      : phase === 'morning' && unit.dailySchedule?.nightWatch
        ? 'relief'
        : phase === 'sleep' || phase === 'idle'
          ? 'offDuty'
          : phase
    const line = pickRandomItem(lines.guard[guardPhase]).replace('{address}', address)
    return foreign && phase === 'work' ? `${line} ${pickRandomItem(lines.foreignWork[mood][audience])}` : line
  }
  if (phase === 'morning' || phase === 'evening') {
    const rest = foreign && mood !== 'neutral' ? lines.foreignRest[mood][phase][audience] : lines.rest[phase][audience]
    return pickRandomItem(rest)
  }
  if (phase === 'work' && unit.autonomyBlockedJob && !unit.action && !unit.dest) {
    const key = unit.autonomyBlockedJob
    const labels: Record<string, [string, string]> = {
      stone: ['pierre', 'stone'],
      wood: ['bois', 'wood'],
      gold: ['or', 'gold'],
      copper: ['cuivre', 'copper'],
      tin: ['étain', 'tin'],
      iron: ['fer', 'iron'],
      food: ['nourriture', 'food'],
    }
    const label = labels[key]?.[getLang() === 'en' ? 1 : 0]
    return getLang() === 'en'
      ? `I cannot find ${label ?? 'a suitable target'} within reach. I am looking for another useful task.`
      : `Je ne trouve pas ${label === 'or' ? 'd’or' : label ? 'de ' + label : 'de cible adaptée'} accessible. Je cherche une autre tâche utile.`
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
