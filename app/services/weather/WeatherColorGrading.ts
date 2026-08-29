import { Rectangle, type Container, type Filter } from 'pixi.js'
import { getActiveMapSpace } from '../../lib/mapSpaces'
import type { GameContextLike } from '../../types/context'
import type { RuntimeMap } from '../../types/map'
import type { ScreenRect } from './WeatherProfiles'

type ColorFilterTarget = Container & {
  destroyed?: boolean
  filterArea?: Rectangle | null
  filters?: readonly Filter[] | null
  label?: string
}

export type WeatherColorMap = RuntimeMap & {
  filterArea?: Rectangle | null
  filters?: readonly Filter[] | null
}

function isColorFilterTarget(value: unknown): value is ColorFilterTarget {
  return Boolean(value && typeof value === 'object' && 'addChild' in value)
}

function addWeatherColorTarget(targets: Set<ColorFilterTarget>, value: unknown): void {
  if (!isColorFilterTarget(value) || value.destroyed) return
  targets.add(value)
}

export class WeatherColorGrading {
  area: Rectangle
  context: GameContextLike
  getScreenRect: () => ScreenRect
  map: WeatherColorMap
  previousFilterAreas: Map<ColorFilterTarget, Rectangle | null | undefined>
  targets: Set<ColorFilterTarget>
  tintFilter: Filter

  constructor(
    context: GameContextLike,
    map: WeatherColorMap,
    tintFilter: Filter,
    getScreenRect: () => ScreenRect
  ) {
    this.area = new Rectangle()
    this.context = context
    this.getScreenRect = getScreenRect
    this.map = map
    this.previousFilterAreas = new Map()
    this.targets = new Set()
    this.tintFilter = tintFilter
  }

  shouldRender(): boolean {
    return getActiveMapSpace(this.map)?.kind !== 'interior'
  }

  sync(enabled = this.shouldRender()): void {
    const nextTargets = enabled ? this.collectTargets() : new Set<ColorFilterTarget>()
    for (const target of [...this.targets]) {
      if (target.destroyed || !nextTargets.has(target)) this.removeTarget(target)
    }
    for (const target of nextTargets) this.addTarget(target)
    this.updateArea(enabled)
  }

  destroy(): void {
    this.sync(false)
  }

  private collectTargets(): Set<ColorFilterTarget> {
    const targets = new Set<ColorFilterTarget>()
    addWeatherColorTarget(targets, this.map)
    return targets
  }

  private addTarget(target: ColorFilterTarget): void {
    if (!this.targets.has(target)) this.previousFilterAreas.set(target, target.filterArea)
    const filters = target.filters ?? []
    if (!filters.includes(this.tintFilter)) target.filters = [...filters, this.tintFilter]
    target.filterArea = this.area
    this.targets.add(target)
  }

  private removeTarget(target: ColorFilterTarget): void {
    const filters = target.filters ?? []
    const withoutWeatherFilter = filters.filter(filter => filter !== this.tintFilter)
    target.filters = withoutWeatherFilter.length ? withoutWeatherFilter : null
    if (this.previousFilterAreas.has(target)) {
      target.filterArea = this.previousFilterAreas.get(target) ?? undefined
      this.previousFilterAreas.delete(target)
    } else if (target.filterArea === this.area) {
      target.filterArea = undefined
    }
    this.targets.delete(target)
  }

  private updateArea(enabled: boolean): void {
    if (!enabled) return
    const viewport = this.context.controls?.getViewportMetrics?.()
    const screenRect = this.getScreenRect()
    this.area.x = viewport?.visibleLeft ?? screenRect.x - this.map.x
    this.area.y = viewport?.visibleTop ?? screenRect.y - this.map.y
    this.area.width = viewport?.visibleWidth ?? screenRect.width
    this.area.height = viewport?.visibleHeight ?? screenRect.height
    for (const target of this.targets) target.filterArea = this.area
  }
}
