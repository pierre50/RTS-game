import type { LoadedGameConfig } from '../types/save'
import { validateWorldPursuers } from './SaveEntityValidators'
import { fail, isObject, validateOptionalFiniteNumber } from './SaveValidationPrimitives'

export function validateRuntimeState(runtime: unknown, size: number, config: LoadedGameConfig): void {
  if (runtime != null) {
    if (!isObject(runtime)) fail('Invalid save file: runtime is invalid.')
    if (
      runtime.heroEquippedItem != null &&
      (typeof runtime.heroEquippedItem !== 'string' || !['interact', 'sword', 'bow'].includes(runtime.heroEquippedItem))
    ) {
      fail('Invalid save file: runtime heroEquippedItem is invalid.')
    }
    validateOptionalFiniteNumber(runtime.dayNightElapsedMs, 'runtime dayNightElapsedMs')
    validateOptionalFiniteNumber(runtime.offlineFromElapsedMs, 'runtime offlineFromElapsedMs')
    validateOptionalFiniteNumber(runtime.elapsedMs, 'runtime elapsedMs')
    validateOptionalFiniteNumber(runtime.savedAt, 'runtime savedAt')
    validateWorldPursuers(runtime.worldPursuers, size, config)
    if (runtime.weather != null) {
      if (!isObject(runtime.weather)) fail('Invalid save file: runtime weather is invalid.')
      if (runtime.weather.phase != null && typeof runtime.weather.phase !== 'string') {
        fail('Invalid save file: runtime weather phase is invalid.')
      }
      validateOptionalFiniteNumber(runtime.weather.dailyWeatherSeed, 'runtime weather dailyWeatherSeed')
      validateOptionalFiniteNumber(runtime.weather.forcedUntilMs, 'runtime weather forcedUntilMs')
      validateOptionalFiniteNumber(runtime.weather.elapsedMs, 'runtime weather elapsedMs')
      validateOptionalFiniteNumber(runtime.weather.flashCooldownMs, 'runtime weather flashCooldownMs')
      validateOptionalFiniteNumber(runtime.weather.lightningBursts, 'runtime weather lightningBursts')
      validateOptionalFiniteNumber(runtime.weather.lightningNextBurstMs, 'runtime weather lightningNextBurstMs')
      validateOptionalFiniteNumber(runtime.weather.phaseEndsAt, 'runtime weather phaseEndsAt')
      validateOptionalFiniteNumber(runtime.weather.precipIntensity, 'runtime weather precipIntensity')
      validateOptionalFiniteNumber(runtime.weather.rainIntensity, 'runtime weather rainIntensity')
      validateOptionalFiniteNumber(runtime.weather.sandIntensity, 'runtime weather sandIntensity')
      validateOptionalFiniteNumber(runtime.weather.snowIntensity, 'runtime weather snowIntensity')
      validateOptionalFiniteNumber(runtime.weather.windIntensity, 'runtime weather windIntensity')
      validateOptionalFiniteNumber(runtime.weather.windTargetX, 'runtime weather windTargetX')
      validateOptionalFiniteNumber(runtime.weather.windX, 'runtime weather windX')
    }
  }
}
