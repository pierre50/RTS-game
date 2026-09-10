import { DEFAULT_ENVIRONMENT_ID, ENVIRONMENT_IDS, type EnvironmentId } from '../../constants'
import { type RandomFn, type WeatherColor, type WeatherParticleTargets } from './WeatherProfiles'

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

export function seconds(ms: number): number {
  return Math.round(ms / 1000)
}
