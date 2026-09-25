import { habitatCells, maintainWildlifeHome, outsideWildlifeHome } from './WildlifeHabitat'
import type { DailyWorldEvent } from './DailyWorldEventTypes'
import { CORPSE_TIME, FAMILY_TYPES, SHEET_TYPES } from '../constants'
import { isometricToCartesian } from '../lib'
import { serializeWildAnimal } from '../serialization/SaveSerializer'
import { getWildlifeStore, installWildlifeStore, isWildlife, WILDLIFE_RENEW_DAYS } from './WildlifeStore'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { AnimalEntity } from '../types/entities'
import type { SaveEntityState } from '../types/save'
import type { Gaia } from '../classes/players/GaiaPlayer'

const WAKE_RADIUS = 32
const SLEEP_RADIUS = 48
const BATCH = 16

/** Only nearby wildlife becomes a runtime entity. The registry remains the authoritative dormant state. */
export class WildlifeSystem {
  private active = new Map<string, AnimalEntity>()
  private task: SchedulerTaskId
  private pending: Iterator<string> | undefined
  private renewalDay: number
  constructor(private context: GameContextLike) {
    this.renewalDay = context.dayNight?.state?.day ?? 1
    const animals = (context.map.gaia as Gaia | undefined)?.animals ?? []
    if (!getWildlifeStore(context.map))
      installWildlifeStore(
        context.map,
        animals.map(serializeWildAnimal).filter(isWildlife),
        `wildlife:${context.map.seed ?? 0}`
      )
    for (const animal of animals)
      if (getWildlifeStore(context.map)?.entries.has(animal.label)) {
        animal.wildlife = getWildlifeStore(context.map)!.entries.get(animal.label)!.state.wildlife
        this.active.set(animal.label, animal)
      }

    this.task = context.scheduler.add(() => this.update(), 250, 'wildlife.streaming')
    this.update()
    console.info(`[wildlife] ${JSON.stringify(this.getStats())}`)
  }
  handleDailyWorldEvent(event: DailyWorldEvent): void {
    this.renewalDay = event.day
  }
  getStats(): { records: number; active: number; pendingRenewals: number } {
    const store = getWildlifeStore(this.context.map)
    return { records: store?.entries.size ?? 0, active: this.active.size, pendingRenewals: store?.pending.size ?? 0 }
  }
  private now(): number {
    return this.context.dayNight?.getElapsedMs?.() ?? this.context.scheduler.elapsedMs ?? 0
  }
  private anchors() {
    const result: { i: number; j: number; radius: number; sightRadius: number }[] = []
    for (const player of this.context.players)
      for (const entity of [...player.units, ...player.buildings])
        if (!entity.isDead && !entity.isDestroyed && (!entity.spaceId || entity.spaceId === 'outside'))
          result.push({
            i: entity.i,
            j: entity.j,
            radius: Math.max(WAKE_RADIUS, Number(entity.sight) + 8 || 0),
            sightRadius: Number(entity.sight) || 8,
          })
    const hero = this.context.controls?.heroUnit
    if (hero && (!hero.spaceId || hero.spaceId === 'outside'))
      result.push({ i: hero.i, j: hero.j, radius: WAKE_RADIUS, sightRadius: Number(hero.sight) || 8 })
    const rect = this.context.controls?.getViewportMetrics?.()
    if (rect) {
      const [i, j] = isometricToCartesian(
        rect.visibleLeft + rect.visibleWidth / 2,
        rect.visibleTop + rect.visibleHeight / 2
      )
      const corners = [
        [rect.visibleLeft, rect.visibleTop],
        [rect.visibleLeft + rect.visibleWidth, rect.visibleTop + rect.visibleHeight],
      ].map(([x, y]) => isometricToCartesian(x, y))
      const radius = Math.max(WAKE_RADIUS, ...corners.map(([x, y]) => Math.hypot(x - i, y - j) + 8))
      result.push({ i, j, radius, sightRadius: Math.max(...corners.map(([x, y]) => Math.hypot(x - i, y - j))) })
    }
    return result
  }
  private detach(animal: AnimalEntity): void {
    const { map } = this.context
    animal.stopInterval?.()
    animal.stopTimeout?.()
    map.removeFromInstanceBucket(animal)
    const cell = map.grid[animal.i]?.[animal.j]
    if (cell?.has === animal) {
      cell.has = null
      cell.solid = false
    }
    cell?.corpses?.delete(animal)
    const gaia = map.gaia as Gaia
    const index = gaia.animals.indexOf(animal)
    if (index >= 0) gaia.animals.splice(index, 1)
    if (!animal.isDead && !animal.isDestroyed) gaia.population = Math.max(0, gaia.population - 1)
    const display = animal as AnimalEntity & {
      parent?: { removeChild(child: unknown): void }
      destroy(options: unknown): void
    }
    display.parent?.removeChild(animal)
    display.destroy({ children: true, texture: false, textureSource: false })
  }
  update(): void {
    const store = getWildlifeStore(this.context.map)
    if (!store) return
    const anchors = this.anchors()
    const near = (point: { i: number; j: number }, margin = 0) =>
      anchors.some(a => Math.hypot(a.i - point.i, a.j - point.j) <= a.radius + margin)
    const now = this.now(),
      day = this.context.dayNight?.state?.day ?? 1
    const targets = new Set<object>()
    for (const player of this.context.players)
      for (const unit of player.units) {
        if (unit.dest && typeof unit.dest === 'object') targets.add(unit.dest)
        if (unit.previousDest && typeof unit.previousDest === 'object') targets.add(unit.previousDest)
      }
    for (const [label, animal] of this.active) {
      const entry = store.entries.get(label)
      if (!entry) continue
      if (animal.tamingStatus === 'tamed' || animal.companionOwner) {
        store.remove(label)
        this.active.delete(label)
        continue
      }
      if (animal.isDead || animal.isDestroyed) {
        entry.state.wildlife!.renewDay ??= day + WILDLIFE_RENEW_DAYS
        if (!animal.quantity && animal.isDead)
          entry.state.wildlife!.corpseExpiresMs ??= now + (animal.corpseMaterialDecayRemainingMs ?? CORPSE_TIME * 1000)
        store.pending.add(label)
      }
      const pin =
        animal.selected ||
        (animal as AnimalEntity & { altitude?: number }).altitude ||
        targets.has(animal) ||
        animal.action === 'attack' ||
        animal.isFleeing ||
        (!animal.isDead && outsideWildlifeHome(animal, entry.state.wildlife!)) ||
        (animal.isDead && animal.currentSheet !== SHEET_TYPES.corpse && !animal.isDestroyed)
      if (!animal.isDestroyed && (pin || near(animal, SLEEP_RADIUS - WAKE_RADIUS))) continue
      const state = serializeWildAnimal(animal)
      state.wildlife = { ...entry.state.wildlife!, lastCorpseMs: now }
      if (!state.isDead) {
        state.path = []
        state.dest = null
        state.previousDest = null
        state.realDest = null
        state.action = null
        state.inactif = true
        state.currentSheet = SHEET_TYPES.standing
        delete state.x
        delete state.y
      }
      store.put(state)
      this.active.delete(label)
      if (!animal.isDestroyed) this.detach(animal)
      else {
        const animals = (this.context.map.gaia as Gaia).animals
        const index = animals.indexOf(animal)
        if (index >= 0) animals.splice(index, 1)
      }
    }
    // Amortize overdue habitat and corpse work; never walk the untouched population on a new day.
    this.pending ??= store.pending.values()
    for (let count = 0; count < BATCH; count++) {
      const next = this.pending.next()
      if (next.done) {
        this.pending = undefined
        break
      }
      const label = next.value,
        entry = store.entries.get(label)
      if (!entry || this.active.has(label)) continue
      const state = entry.state,
        meta = state.wildlife!
      meta.renewDay ??= day + WILDLIFE_RENEW_DAYS
      this.decay(state, now)
      if (!state.isDestroyed || this.renewalDay < meta.renewDay || meta.lastRenewAttemptDay === this.renewalDay)
        continue
      meta.lastRenewAttemptDay = this.renewalDay
      maintainWildlifeHome(this.context, meta, this.renewalDay)
      let position: { i: number; j: number } | undefined
      for (const cell of habitatCells(this.context, meta)) {
        const point = { i: cell.i, j: cell.j }
        if (
          !anchors.some(a => Math.hypot(a.i - point.i, a.j - point.j) <= a.sightRadius) &&
          this.available(point, true)
        ) {
          position = point
          break
        }
      }
      if (!position) continue
      const generation = meta.generation + 1
      store.remove(label)
      store.put({
        ...position,
        type: state.type,
        horseColor: state.horseColor,
        label: `${label}:renew:${generation}`,
        wildlife: { homeI: meta.homeI, homeJ: meta.homeJ, originI: meta.originI, originJ: meta.originJ, generation },
      })
    }
    let created = 0
    const candidates = function* () {
      // Loaded displaced survivors must finish returning even when both ends are off screen.
      yield* store.displaced
      for (const anchor of anchors) yield* store.near(anchor.i, anchor.j, anchor.radius)
    }
    for (const label of candidates()) {
      if (created >= BATCH) return
      if (this.active.has(label)) continue
      const state = store.entries.get(label)!.state
      if (state.isDead) this.decay(state, now)
      if (state.isDestroyed || !this.available(state, false)) continue
      const animal = (this.context.map.gaia as Gaia).createAnimal({ ...state })
      animal.wildlife = state.wildlife
      this.active.set(label, animal)
      store.displaced.delete(label)
      created++
    }
  }
  private available(point: { i: number; j: number; label?: string }, renewal: boolean): boolean {
    const store = getWildlifeStore(this.context.map)
    for (const label of store?.near(point.i, point.j, 0) ?? [])
      if (label !== point.label && !store!.entries.get(label)!.state.isDestroyed) return false
    const cell = this.context.map.grid[point.i]?.[point.j]
    if (!cell || cell.solid || cell.has || cell.category === 'Water' || cell.border || cell.inclined) return false
    if (!renewal) return true
    const radius = 6
    for (let i = point.i - radius; i <= point.i + radius; i++)
      for (let j = point.j - radius; j <= point.j + radius; j++)
        if (this.context.map.grid[i]?.[j]?.has?.family === FAMILY_TYPES.building) return false
    return true
  }
  private decay(state: SaveEntityState, now: number): void {
    if (!state.isDead || state.isDestroyed) return
    const meta = state.wildlife!
    const last = meta.lastCorpseMs ?? now
    const ticks = Math.floor(Math.max(0, now - last) / 5000)
    const meat = Math.max(0, state.inventory?.resources?.meat ?? state.quantity ?? 0)
    state.quantity = Math.max(0, meat - ticks)
    if (state.inventory?.resources) state.inventory.resources.meat = state.quantity
    meta.lastCorpseMs = last + ticks * 5000
    if (!state.quantity) {
      meta.corpseExpiresMs ??=
        last + Math.min(ticks, meat) * 5000 + (state.corpseMaterialDecayRemainingMs ?? CORPSE_TIME * 1000)
      if (now >= meta.corpseExpiresMs) {
        state.isDestroyed = true
        delete state.inventory
      } else state.corpseMaterialDecayRemainingMs = meta.corpseExpiresMs - now
    }
  }
  destroy(): void {
    this.context.scheduler.remove(this.task)
    this.active.clear()
  }
}
