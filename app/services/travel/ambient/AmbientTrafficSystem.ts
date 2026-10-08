import { updateUnitEnergy } from '../../../lib/units/unitEnergy'
import { ambientActivityArea } from '../../world/AmbientActivityArea'
import { getEntitySpaceId } from '../../../lib/mapSpaces'
import { updateInstanceVisibility } from '../../../lib/grid/visibility'
import { campRespawnStates } from '../../../lib/camps/campRespawnState'
import { deferredVillageBuildings } from '../../world/distantVillages/DeferredVillageStore'
import type { CampLeashController } from '../../patrol/CampLeashController'
import { buildTrafficRoutes } from './AmbientTrafficRoutes'
import {
  snapshotTrafficActor,
  advanceTraffic,
  trafficActiveAtHour,
  ambientTrafficState,
  registerAmbientTrafficFlush,
  type TrafficGroup,
} from './AmbientTrafficState'
import type { GameContextLike, SchedulerTaskId } from '../../../types/context'
import type { UnitEntity } from '../../../types/entities'
import type { RuntimeCell } from '../../../types/map'

type LiveGroup = { actors: UnitEntity[]; positions: Map<UnitEntity, number>; retryAt: number }
const distance = (a: { i: number; j: number }, b: { i: number; j: number }) => Math.hypot(a.i - b.i, a.j - b.j)
const busy = (unit: UnitEntity) =>
  Boolean(
    unit.combatMode ||
      unit.action === 'attack' ||
      unit.action === 'flee' ||
      unit.actionLocked ||
      unit.lookingAtHero ||
      unit.followingHero
  )

/** At most two live groups (six actors). Distant groups have no Unit/PIXI instances. */
export class AmbientTrafficSystem {
  private live = new Map<TrafficGroup, LiveGroup>()
  private task: SchedulerTaskId | null = null
  private last: number
  private discoverAt = 0
  private spawnAt = 0
  private spawnRetries = new WeakMap<TrafficGroup, number>()
  private search?: Generator<void>
  constructor(
    private context: GameContextLike,
    private leash: Pick<CampLeashController, 'update'> = { update: () => false }
  ) {
    this.last = context.scheduler.elapsedMs
    if (context.editor) return
    registerAmbientTrafficFlush(context.map, () => this.snapshot())
    this.task = context.scheduler.add(
      () => {
        if (context.performance) context.performance.measure('traffic.update', () => this.update())
        else this.update()
      },
      250,
      'world.ambientTraffic'
    )
  }

  private valid(group: TrafficGroup): boolean {
    if (group.kind === 'bandits')
      return campRespawnStates(this.context.map).some(
        c => c.id === group.campId && c.generation === group.campGeneration && c.clearedAtMs == null
      )
    return [group.from, group.to].every(end => {
      const owner = this.context.players?.find(p => p.label === end.owner)
      return (
        owner &&
        (deferredVillageBuildings(owner) ?? owner.buildings).some(
          b => b.label === end.label && b.isBuilt && !b.isDead && !b.isDestroyed
        )
      )
    })
  }

  update(): void {
    const now = this.context.scheduler.elapsedMs
    const elapsed = Math.max(0, now - this.last)
    this.last = now
    if (!elapsed) return
    const hero = this.context.controls?.heroUnit
    const groups = ambientTrafficState(this.context.map).groups
    if (!this.search && now >= this.discoverAt) {
      this.discoverAt = now + 60000
      this.search = buildTrafficRoutes(this.context, groups)
    }
    const deadline = performance.now() + 2
    for (let n = 0; this.search && n < 32 && performance.now() < deadline; n++)
      if (this.search.next().done) this.search = undefined
    const visible = ambientActivityArea(this.context)
    for (const group of groups) {
      const live = this.live.get(group)
      if (!this.valid(group)) group.retired = true
      if (live) {
        this.snapshotGroup(group, live)
        const living = live.actors.filter(unit => !unit.isDead && !unit.isDestroyed)
        if (!living.length) {
          group.retired = true
          this.live.delete(group)
          continue
        }
        for (const actor of living) updateUnitEnergy(actor, elapsed)
        const observed = living.some(
          unit => visible(unit) || (hero && getEntitySpaceId(hero) === 'outside' && distance(hero, unit) < 125)
        )
        if (!observed && !living.some(busy)) {
          this.dematerialize(group, live)
          advanceTraffic(group, elapsed / 1000)
          continue
        }
        if (group.retired || living.some(busy)) continue
        this.walk(group, live, now, elapsed)
      } else if (!group.retired) {
        // Saved live positions are preserved until restored; distant routes use elapsed time.
        if (!group.materialized && !trafficActiveAtHour(group, this.context.dayNight?.state?.hour ?? 12)) continue
        if (!group.materialized) advanceTraffic(group, elapsed / 1000)
        if (
          this.live.size >= 2 ||
          now < this.spawnAt ||
          now < (this.spawnRetries.get(group) ?? 0) ||
          !hero ||
          getEntitySpaceId(hero) !== 'outside'
        )
          continue
        const point = group.materialized ? group.members.find(m => !m.isDead) : group.route[Math.floor(group.progress)]
        if (!point) continue
        const d = distance(hero, point)
        if (d > 110) {
          if (group.materialized) advanceTraffic(group, elapsed / 1000)
          group.materialized = false
          continue
        }
        if (!group.materialized && (d < 28 || visible(point))) continue
        if (this.materialize(group, visible)) this.spawnAt = now + 12000
      }
    }
  }

  private freeCell(
    point: { i: number; j: number },
    visible?: (p: { i: number; j: number }) => boolean,
    reserved = new Set<RuntimeCell>()
  ): RuntimeCell | undefined {
    for (let radius = 0; radius <= 3; radius++)
      for (let di = -radius; di <= radius; di++)
        for (let dj = -radius; dj <= radius; dj++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== radius) continue
          const cell = this.context.map.grid[point.i + di]?.[point.j + dj]
          if (cell && !cell.solid && cell.category !== 'Water' && !reserved.has(cell) && !visible?.(cell)) return cell
        }
    return undefined
  }

  private materialize(group: TrafficGroup, visible: (p: { i: number; j: number }) => boolean): boolean {
    const owner = this.context.players?.find(p => p.label === group.owner)
    if (!owner?.createUnit) return false
    const members = group.members.filter(m => !m.isDead && !m.isDestroyed)
    if (!members.length) {
      group.retired = true
      return false
    }
    const cells: RuntimeCell[] = [],
      reserved = new Set<RuntimeCell>()
    for (let n = 0; n < members.length; n++) {
      const index = Math.max(
        0,
        Math.min(group.route.length - 1, Math.floor(group.progress) + (group.reverse ? 1 : -1) * n * 2)
      )
      const point = group.materialized ? members[n] : group.route[index]
      // New travelers occupy the planned route, never a random roadside square.
      const cell = group.materialized
        ? this.freeCell(point, undefined, reserved)
        : Array.from({ length: 7 }, (_, offset) => index + (offset % 2 ? -1 : 1) * Math.ceil(offset / 2))
            .map(candidate => group.route[candidate])
            .filter(Boolean)
            .map(candidate => this.context.map.grid[candidate.i]?.[candidate.j])
            .find(
              candidate =>
                candidate &&
                !candidate.solid &&
                candidate.category !== 'Water' &&
                !reserved.has(candidate) &&
                !visible(candidate)
            )
      if (!cell) return false
      cells.push(cell)
      reserved.add(cell)
    }
    const actors: UnitEntity[] = []
    try {
      for (let n = 0; n < members.length; n++) {
        const saved = members[n]
        const actor = owner.createUnit(
          {
            ...saved,
            i: cells[n].i,
            j: cells[n].j,
            type: saved.type,
            ambientRoadGroup: group.id,
            providesVision: !owner.isPlayed,
            action: null,
            dest: null,
            path: [],
            work: null,
            autonomousJob: null,
            inventory: saved.inventory ?? { resources: {} },
            suppressCreateSound: true,
            ...(group.kind === 'bandits' ? { banditCampAnchor: { i: group.from.i, j: group.from.j } } : {}),
          },
          { preserveType: true }
        )
        // Decorative actors belong to their faction for diplomacy/appearance, not its workforce.
        const index = owner.units.indexOf(actor)
        if (index >= 0) owner.units.splice(index, 1)
        actors.push(actor)
        updateInstanceVisibility(actor)
      }
    } catch (error) {
      for (const actor of actors) this.removeActor(actor)
      this.spawnRetries.set(group, this.context.scheduler.elapsedMs + 60000)
      console.warn('[ambient-traffic-spawn]', group.id, error)
      return false
    }
    group.materialized = true
    const positions = new Map(actors.map(actor => [actor, this.routePosition(group, actor)]))
    actors.sort((a, b) => (positions.get(b)! - positions.get(a)!) * (group.reverse ? -1 : 1))
    this.live.set(group, { actors, positions, retryAt: 0 })
    this.snapshotGroup(group, this.live.get(group)!)
    return true
  }

  private routePosition(group: TrafficGroup, actor: UnitEntity, previous?: number): number {
    let best = previous ?? 0
    const start = previous == null ? 0 : Math.max(0, previous - 12)
    const end = previous == null ? group.route.length - 1 : Math.min(group.route.length - 1, previous + 12)
    for (let index = start; index <= end; index++)
      if (distance(actor, group.route[index]) < distance(actor, group.route[best])) best = index
    return best
  }

  private walk(group: TrafficGroup, live: LiveGroup, now: number, elapsed: number): void {
    const actors = live.actors.filter(unit => !unit.isDead && !unit.isDestroyed)
    if (group.kind === 'bandits' && actors.some(unit => this.leash.update(unit))) return
    if (group.pauseMs > 0) {
      group.pauseMs = Math.max(0, group.pauseMs - elapsed)
      return
    }
    if (now < live.retryAt) return
    live.retryAt = now + 250
    for (const actor of actors) live.positions.set(actor, this.routePosition(group, actor, live.positions.get(actor)))
    const step = group.reverse ? -1 : 1
    const leader = actors[0]
    const front = live.positions.get(leader)!
    group.progress = front
    const end = group.reverse ? 0 : group.route.length - 1
    if (
      front === end &&
      actors.every((actor, n) => !actor.path?.length && Math.abs(live.positions.get(actor)! - end) <= n * 2)
    ) {
      group.reverse = !group.reverse
      group.pauseMs = group.kind === 'bandits' ? 45000 : 30000
      // The rear becomes the front on the return leg, avoiding units crossing each other.
      live.actors.reverse()
      return
    }
    for (let n = 0; n < actors.length; n++) {
      const actor = actors[n]
      if (actor.path?.length || busy(actor)) continue
      const index = live.positions.get(actor)!
      // Each member waits for the next: a slow or blocked villager cannot be abandoned.
      if (actors[n + 1] && (index - live.positions.get(actors[n + 1])!) * step >= 3) continue
      if (n && (live.positions.get(actors[n - 1])! - index) * step <= 2) continue
      const onRoute = distance(actor, group.route[index]) === 0
      const next = onRoute ? index + step : index
      const point = group.route[next]
      if (!point) continue
      const cell = this.context.map.grid[point.i]?.[point.j]
      if (!cell || cell.solid || cell.category === 'Water') continue
      // Consecutive route cells preserve bends; never chase the leader across a field.
      actor.sendToEvt?.(cell, null, { allowPassageStop: true })
    }
  }

  private snapshotGroup(group: TrafficGroup, live: LiveGroup): void {
    for (const actor of live.actors) {
      const index = group.members.findIndex(m => m.label === actor.label)
      if (index >= 0) group.members[index] = snapshotTrafficActor(actor)
    }
  }
  snapshot(): void {
    for (const [group, live] of this.live) this.snapshotGroup(group, live)
  }
  private removeActor(actor: UnitEntity): void {
    if (actor.isDead || actor.isDestroyed) return // Let real deaths keep their corpse/loot lifecycle.
    actor.stop?.()
    actor.stopInterval?.()
    actor.stopTimeout?.()
    const cell = this.context.map.grid[actor.i]?.[actor.j]
    if (cell?.has === actor) {
      cell.has = null
      cell.solid = false
    }
    this.context.map.removeFromInstanceBucket?.(actor)
    actor.isDead = true
    updateInstanceVisibility(actor) // Release visibility viewers without triggering death/rewards.
    actor.clear?.()
  }
  private dematerialize(group: TrafficGroup, live: LiveGroup): void {
    this.snapshotGroup(group, live)
    const leader = live.actors.find(actor => !actor.isDead && !actor.isDestroyed)
    if (leader) {
      let best = Math.floor(group.progress)
      for (let n = Math.max(0, best - 12); n <= Math.min(group.route.length - 1, group.progress + 12); n++)
        if (distance(leader, group.route[n]) < distance(leader, group.route[best])) best = n
      group.progress = best
    }
    for (const actor of live.actors) this.removeActor(actor)
    group.materialized = false
    this.live.delete(group)
  }
  destroy(): void {
    this.snapshot()
    if (this.task != null) this.context.scheduler.remove(this.task)
    for (const live of this.live.values()) for (const actor of live.actors) this.removeActor(actor)
    this.live.clear()
    registerAmbientTrafficFlush(this.context.map)
  }
}
