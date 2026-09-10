import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import type { EnvironmentId } from '../../constants'
import { createSeededRandom } from '../../lib/random'
import type { RandomFn, WeatherPhase } from './WeatherProfiles'

type DailyWeatherKind = 'sunny' | 'overcast' | 'showers' | 'rainy' | 'storm' | 'snow' | 'sandstorm'
type WeatherPeriod = { startHour: number; endHour: number; phase: WeatherPhase }
type DailyWeatherPlan = {
  day: number
  kind: DailyWeatherKind
  background: 'sunny' | 'clouding'
  periods: WeatherPeriod[]
}

// Weights describe whole days, not repeated chances to trigger another event.
const DAILY_WEIGHTS: Record<EnvironmentId, Record<DailyWeatherKind, number>> = {
  Temperate: { sunny: 48, overcast: 25, showers: 18, rainy: 7, storm: 2, snow: 0, sandstorm: 0 },
  Jungle: { sunny: 25, overcast: 23, showers: 30, rainy: 17, storm: 5, snow: 0, sandstorm: 0 },
  BlackForest: { sunny: 30, overcast: 32, showers: 20, rainy: 10, storm: 2, snow: 6, sandstorm: 0 },
  Desert: { sunny: 85, overcast: 11, showers: 1, rainy: 0, storm: 0, snow: 0, sandstorm: 3 },
  Steppe: { sunny: 60, overcast: 23, showers: 10, rainy: 2, storm: 1, snow: 4, sandstorm: 0 },
}

const HOUR_MS = DAY_NIGHT_CONFIG.dayLengthMs / DAY_NIGHT_CONFIG.hoursPerDay

function between(min: number, max: number, random: RandomFn): number {
  return min + (max - min) * random()
}

function pickKind(biome: EnvironmentId, random: RandomFn): DailyWeatherKind {
  let roll = random() * 100
  for (const [kind, weight] of Object.entries(DAILY_WEIGHTS[biome])) {
    roll -= weight
    if (roll < 0) return kind as DailyWeatherKind
  }
  return 'sunny'
}

function createPlan(seed: number, biome: EnvironmentId, day: number): DailyWeatherPlan {
  const random = createSeededRandom(`${seed}:${biome}:day:${day}`)
  // Adjacent days often share a three-day tendency, without a midnight reroll
  // affecting an episode already in progress. Independent seeds also allow time jumps.
  const tendency = createSeededRandom(`${seed}:${biome}:tendency:${Math.floor(day / 3)}`)
  const kind = pickKind(biome, random() < 0.65 ? tendency : random)
  const background = kind === 'sunny' || kind === 'sandstorm' ? 'sunny' : 'clouding'
  const plan: DailyWeatherPlan = { day, kind, background, periods: [] }
  if (kind === 'sunny' || kind === 'overcast') return plan

  const start = kind === 'rainy' ? between(6, 10, random) : between(8, 21, random)
  const duration = kind === 'rainy' ? between(10, 16, random) : between(3, 6, random)
  const end = start + duration
  plan.periods.push({ startHour: start - 1, endHour: start, phase: 'clouding' })
  if (kind === 'storm') {
    plan.periods.push(
      { startHour: start, endHour: start + 0.75, phase: 'stormBuildUp' },
      { startHour: start + 0.75, endHour: end - 1, phase: 'rainHeavy' },
      { startHour: end - 1, endHour: end, phase: 'rainLight' }
    )
  } else {
    plan.periods.push({
      startHour: start,
      endHour: end,
      phase: kind === 'snow' ? 'snow' : kind === 'sandstorm' ? 'sandstorm' : 'rainLight',
    })
  }
  plan.periods.push({ startHour: end, endHour: end + 1, phase: 'clearing' })
  return plan
}

export class DailyWeatherSchedule {
  private cachedDay: number | null = null
  private plans: DailyWeatherPlan[] = []

  constructor(
    readonly seed: number,
    private biome: EnvironmentId
  ) {}

  sample(elapsedMs: number): { phase: WeatherPhase; endsAt: number; kind: DailyWeatherKind } {
    const absoluteHour = DAY_NIGHT_CONFIG.startHour + Math.max(0, elapsedMs) / HOUR_MS
    const day = Math.floor(absoluteHour / 24)
    if (day !== this.cachedDay) {
      this.cachedDay = day
      this.plans = [createPlan(this.seed, this.biome, day - 1), createPlan(this.seed, this.biome, day)]
    }
    const today = this.plans[1]
    const hour = absoluteHour - day * 24
    // Yesterday's evening rain/snow/sand keeps its own end time after midnight.
    for (const plan of this.plans) {
      const planHour = absoluteHour - plan.day * 24
      const period = plan.periods.find(item => planHour >= item.startHour && planHour < item.endHour)
      if (period) {
        return {
          phase: period.phase,
          endsAt: (plan.day * 24 + period.endHour - DAY_NIGHT_CONFIG.startHour) * HOUR_MS,
          kind: plan.kind,
        }
      }
    }
    const next = today.periods.find(period => period.startHour > hour)
    return {
      phase: today.background,
      endsAt: (day * 24 + (next?.startHour ?? 24) - DAY_NIGHT_CONFIG.startHour) * HOUR_MS,
      kind: today.kind,
    }
  }
}
