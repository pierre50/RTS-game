import { DEFAULT_ENVIRONMENT_ID, ENVIRONMENT_IDS, type EnvironmentId } from '../constants'
import {
  BASE_PHASE_DURATIONS_SECONDS,
  BASE_WEATHER_TRANSITIONS,
  BIOME_DURATION_OVERRIDES,
  BIOME_TRANSITION_OVERRIDES,
  type RandomFn,
  type WeatherColor,
  type WeatherParticleTargets,
  type WeatherPhase,
} from './WeatherProfiles'

export function randomBetween(min: number, max: number, random: RandomFn): number {
  return min + random() * (max - min)
}

export function randomDuration(minSeconds: number, maxSeconds: number, random: RandomFn): number {
  return randomBetween(minSeconds, maxSeconds, random) * 1000
}

export function lerp(current: number, target: number, amount: number): number {
  return current + (target - current) * Math.max(0, Math.min(1, amount))
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function combineColor(base: WeatherColor, weather: WeatherColor): WeatherColor {
  return {
    gamma: base.gamma * weather.gamma,
    contrast: base.contrast * weather.contrast,
    saturation: base.saturation * weather.saturation,
    brightness: base.brightness * weather.brightness,
    red: base.red * weather.red,
    green: base.green * weather.green,
    blue: base.blue * weather.blue,
  }
}

export function scaleParticleTarget(targets: WeatherParticleTargets, multiplier: number): WeatherParticleTargets {
  return {
    rain: clamp(targets.rain * multiplier, 0, 1),
    sand: clamp(targets.sand, 0, 1),
    snow: clamp(targets.snow * multiplier, 0, 1),
  }
}

export function addParticleDrift(target: number, elapsedMs: number): number {
  return target > 0 ? clamp(target + Math.sin(elapsedMs * 0.0009) * 0.045, 0, 1) : 0
}

export function crossfadeVolumes(intensity: number, mid: number): { high: number; low: number } {
  const low = intensity <= mid ? intensity / mid : 1 - (intensity - mid) / (1 - mid)
  const high = intensity <= mid ? 0 : (intensity - mid) / (1 - mid)
  return { low: clamp(low, 0, 1), high: clamp(high, 0, 1) }
}

export function biomeKeyFromEnvironment(environment?: string | null): EnvironmentId {
  return ENVIRONMENT_IDS.includes(environment as EnvironmentId)
    ? (environment as EnvironmentId)
    : DEFAULT_ENVIRONMENT_ID
}

export function nextPhase(phase: WeatherPhase, random: RandomFn, biome: EnvironmentId): WeatherPhase {
  if (phase === 'night') return 'night'
  const overrides = BIOME_TRANSITION_OVERRIDES[biome]
  const environmentTransitions = { ...BASE_WEATHER_TRANSITIONS, ...(overrides ?? {}) }
  const transitions = environmentTransitions[phase]
  if (!transitions || transitions.length === 0) return 'sunny'
  const roll = random()
  for (const option of transitions) {
    if (roll < option.chance) return option.phase
  }
  return transitions[transitions.length - 1].phase
}

export function phaseDuration(phase: WeatherPhase, random: RandomFn, biome: EnvironmentId): number {
  const overrides = BIOME_DURATION_OVERRIDES[biome] ?? {}
  const range = overrides[phase] ?? BASE_PHASE_DURATIONS_SECONDS[phase]
  return randomDuration(range[0], range[1], random)
}

export function seconds(ms: number): number {
  return Math.round(ms / 1000)
}
