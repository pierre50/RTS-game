import { sound, type IMediaInstance } from '@pixi/sound'
import { ZoomBlurFilter } from 'pixi-filters'
import type { Application, Filter } from 'pixi.js'
import { SOUND_CUES } from '../constants'
import type { UnitEntity } from '../types/entities'

const LOW_HEALTH_START_RATIO = 0.35
const LOW_HEALTH_MAX_RATIO = 0.1
const INTENSITY_LERP_PER_SECOND = 1.45
const FILTER_DISABLE_EPSILON = 0.004
const HEARTBEAT_STOP_EPSILON = 0.006
const MAX_BLUR_STRENGTH = 0.028
const MAX_HEARTBEAT_VOLUME = 0.24

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function lerp(current: number, target: number, amount: number): number {
  return current + (target - current) * clamp(amount, 0, 1)
}

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

function getFilters(filters: Filter | readonly Filter[] | null | undefined): readonly Filter[] {
  if (!filters) return []
  if (Array.isArray(filters)) return filters as readonly Filter[]
  return [filters as Filter]
}

function getHealthRatio(hero: UnitEntity | null): number {
  if (!hero || hero.isDead || hero.isDestroyed) return 1
  const totalHitPoints = Math.max(0, hero.totalHitPoints ?? 0)
  if (totalHitPoints <= 0) return 1
  return clamp((hero.hitPoints ?? totalHitPoints) / totalHitPoints, 0, 1)
}

function getTargetIntensity(hero: UnitEntity | null): number {
  const healthRatio = getHealthRatio(hero)
  if (healthRatio >= LOW_HEALTH_START_RATIO) return 0
  const range = LOW_HEALTH_START_RATIO - LOW_HEALTH_MAX_RATIO
  return smoothstep((LOW_HEALTH_START_RATIO - healthRatio) / range)
}

export class HeroCriticalHealthEffects {
  app: Application
  filter: ZoomBlurFilter
  heartbeat: IMediaInstance | null
  heartbeatToken: number
  intensity: number

  constructor(app: Application) {
    this.app = app
    this.filter = new ZoomBlurFilter({
      center: { x: 0.5, y: 0.5 },
      innerRadius: 0.08,
      radius: -1,
      strength: 0,
      maxKernelSize: 18,
    })
    this.heartbeat = null
    this.heartbeatToken = 0
    this.intensity = 0
  }

  update(hero: UnitEntity | null, elapsedMs: number, active = true): void {
    const elapsedSeconds = clamp(elapsedMs, 0, 250) / 1000
    const targetIntensity = active ? getTargetIntensity(hero) : 0
    this.intensity = lerp(this.intensity, targetIntensity, elapsedSeconds * INTENSITY_LERP_PER_SECOND)
    if (this.intensity < FILTER_DISABLE_EPSILON && targetIntensity === 0) this.intensity = 0

    this.updateFilter()
    this.updateHeartbeat()
  }

  updateFilter(): void {
    this.filter.strength = Math.pow(this.intensity, 1.35) * MAX_BLUR_STRENGTH
    const stageFilters = getFilters(this.app.stage.filters).filter(filter => filter !== this.filter)
    if (this.intensity <= FILTER_DISABLE_EPSILON) {
      this.app.stage.filters = stageFilters.length ? [...stageFilters] : null
      return
    }
    this.app.stage.filters = [...stageFilters, this.filter]
  }

  updateHeartbeat(): void {
    if (this.intensity <= HEARTBEAT_STOP_EPSILON) {
      if (this.heartbeat) {
        this.heartbeat.stop()
        this.heartbeat = null
      }
      this.heartbeatToken++
      return
    }

    const volume = Math.pow(this.intensity, 1.15) * MAX_HEARTBEAT_VOLUME
    if (!this.heartbeat) {
      const token = ++this.heartbeatToken
      const result = sound.play(SOUND_CUES.hero.heartbeat, { loop: true, volume: 0 })
      if (result instanceof Promise) {
        result
          .then(instance => {
            if (token !== this.heartbeatToken || this.intensity <= HEARTBEAT_STOP_EPSILON) {
              instance.stop()
              return
            }
            this.heartbeat = instance
            this.heartbeat.volume = volume
          })
          .catch(() => {})
        return
      }
      this.heartbeat = result
    }
    if (this.heartbeat) this.heartbeat.volume = volume
  }

  destroy(): void {
    const stageFilters = getFilters(this.app.stage.filters).filter(filter => filter !== this.filter)
    this.app.stage.filters = stageFilters.length ? [...stageFilters] : null
    this.heartbeat?.stop()
    this.heartbeat = null
    this.heartbeatToken++
    this.intensity = 0
  }
}
