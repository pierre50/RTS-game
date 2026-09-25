import { CompactResourceSet, materializedResources } from '../classes/resources/CompactResourceSet'
import { RESOURCE_TYPES, UNIT_TYPES } from '../constants'
import { isWheatMature } from '../lib'
import { naturalGrowthFor, registerGrowthFlush, ResourceRenewalQueue } from './NaturalGrowthQueue'
import { isVillagerSleepTime } from '../lib/units/villagerSchedule'
import { resumeStrictVillagerAutonomy } from '../lib/units/villagerTaskRecovery'
import { villagerAutonomySuspension } from '../lib/units/autonomy/villagerAutonomyAvailability'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { ResourceEntity } from '../types/entities'
import type { SaveEntityState } from '../types/save'
import { NATURAL_REGROWTH_CONFIG, NATURAL_RESOURCE_REGROWTH_BY_TYPE } from '../config/gameplay'
import type { DailyWorldEvent, DailyWorldEventHandler } from './DailyWorldEventTypes'

function resumeIdleAutonomousVillagersAfterRegrowth(context: GameContextLike): void {
  if (isVillagerSleepTime(context)) return
  for (const player of context.players ?? []) {
    for (const unit of player.units ?? []) {
      if (unit.type !== UNIT_TYPES.villager || unit.isDead || unit.isDestroyed) continue
      if (!unit.autonomousJob || unit.dest || unit.action || unit.path?.length) continue
      if (villagerAutonomySuspension(unit)) continue
      resumeStrictVillagerAutonomy(unit, unit.autonomousJob, { exploreWhenNoTarget: false })
    }
  }
}

export class NaturalRegrowthSystem implements DailyWorldEventHandler {
  private queue = new ResourceRenewalQueue()
  private slots: SaveEntityState[] | undefined
  private readSlots = 0
  private jobs: (() => void)[] = []
  private cursor = 0
  private task?: SchedulerTaskId
  private unregister: () => void
  private changed = false
  constructor(private context: GameContextLike) {
    const resources = context.map.resources
    const initial =
      resources instanceof CompactResourceSet ? resources.initialGrowthValues() : materializedResources(resources)
    for (const resource of initial)
      if (resource.type === RESOURCE_TYPES.berrybush || resource.type === RESOURCE_TYPES.wheat)
        naturalGrowthFor(context.map).add(resource)
    this.unregister = registerGrowthFlush(context.map, () => this.flush())
  }
  handleDailyWorldEvent(event: DailyWorldEvent): void {
    this.enqueue(event)
    if (this.task == null && this.context.scheduler)
      this.task = this.context.scheduler.add(() => this.flush(32), 50, 'resources.renewal')
    if (!this.context.scheduler) this.flush()
  }
  applyDailyRegrowth(event?: DailyWorldEvent): void {
    this.enqueue(event)
    this.flush()
  }
  private enqueue(event?: DailyWorldEvent): void {
    const map = this.context.map,
      day = event?.day ?? this.context.dayNight?.state?.day ?? 1
    const slots = map.naturalResourceRespawnSlots ?? []
    if (slots !== this.slots) {
      this.slots = slots
      this.readSlots = 0
      this.queue = new ResourceRenewalQueue()
    }
    for (; this.readSlots < slots.length; this.readSlots++) {
      const slot = slots[this.readSlots]
      const config = NATURAL_RESOURCE_REGROWTH_BY_TYPE[slot.type as keyof typeof NATURAL_RESOURCE_REGROWTH_BY_TYPE]
      if (!config) continue
      slot.depletedDay ??= day
      this.queue.add(slot, slot.depletedDay + config.respawnDelayDays)
    }
    for (const slot of this.queue.due(day))
      this.jobs.push(() => {
        if (map.respawnNaturalResource?.(slot)) {
          const index = slots.indexOf(slot)
          if (index >= 0) {
            slots.splice(index, 1)
            this.readSlots--
          }
          this.changed = true
        } else this.queue.add(slot, day + 1)
      })
    for (const resource of [...naturalGrowthFor(map)]) this.jobs.push(() => this.grow(resource))
  }
  private grow(resource: ResourceEntity): void {
    const growing = naturalGrowthFor(this.context.map)
    if (resource.isDead || resource.isDestroyed) {
      growing.delete(resource)
      return
    }
    if (resource.type === RESOURCE_TYPES.wheat && !isWheatMature(resource)) {
      this.changed =
        Boolean(resource.advanceWheatGrowth?.(NATURAL_REGROWTH_CONFIG.wheatGrowthFramesPerDay)) || this.changed
      return
    }
    const total = Math.max(0, resource.totalQuantity ?? 0),
      quantity = Math.max(0, resource.quantity ?? 0)
    const ratio =
      resource.type === RESOURCE_TYPES.wheat
        ? NATURAL_REGROWTH_CONFIG.wheatRegrowRatioPerDay
        : NATURAL_REGROWTH_CONFIG.berryRegrowRatioPerDay
    const next = Math.min(total, quantity + Math.max(1, Math.ceil(total * ratio)))
    if (next !== quantity) {
      resource.quantity = next
      resource.updateTexture?.()
      this.changed = true
    }
    if (next >= total) growing.delete(resource)
  }
  private flush(limit = Infinity): void {
    let count = 0
    while (this.cursor < this.jobs.length && count++ < limit) this.jobs[this.cursor++]()
    if (this.cursor < this.jobs.length) return
    this.jobs = []
    this.cursor = 0
    if (this.task != null) {
      this.context.scheduler.remove(this.task)
      this.task = undefined
    }
    if (this.changed) {
      if (this.context.menu?.isMiniMapActive?.() !== false) this.context.menu?.updateResourcesMiniMap?.()
      resumeIdleAutonomousVillagersAfterRegrowth(this.context)
      this.changed = false
    }
  }
  destroy(): void {
    if (this.task != null) this.context.scheduler.remove(this.task)
    this.unregister()
    this.jobs = []
  }
}
