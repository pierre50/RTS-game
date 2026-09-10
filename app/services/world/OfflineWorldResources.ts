import { NATURAL_REGROWTH_CONFIG, NATURAL_RESOURCE_REGROWTH_BY_TYPE } from '../../config/gameplay'
import { RESOURCE_TYPES } from '../../constants/entities'
import type { SaveEntityState, SaveGridPoint, SerializedSave } from '../../types/save'
import { entityKey, isLiving, type OfflineWorldSpatial } from './OfflineWorldSpatial'
import type { OfflineWorldReport } from './OfflineWorldWork'

function respawnPoint(slot: SaveEntityState, day: number, spatial: OfflineWorldSpatial): SaveGridPoint | null {
  const fallback = spatial.naturalCell(slot) ? { i: slot.i, j: slot.j } : null
  if (slot.type !== RESOURCE_TYPES.berrybush) return fallback
  // Stable per resource/day: reopening a save cannot reroll the destination.
  let seed = day
  for (const char of entityKey(slot)) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) | 0
  for (let attempt = 0; attempt < 80; attempt++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0
    const i = slot.i + ((seed >>> 0) % 17) - 8
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0
    const j = slot.j + ((seed >>> 0) % 17) - 8
    const point = { i, j }
    if ((i !== slot.i || j !== slot.j) && spatial.naturalCell(point) && spatial.reachable(slot, point)) return point
  }
  return fallback
}

function respawnResource(slot: SaveEntityState, day: number, spatial: OfflineWorldSpatial): SaveEntityState | null {
  const rules = NATURAL_RESOURCE_REGROWTH_BY_TYPE[slot.type as keyof typeof NATURAL_RESOURCE_REGROWTH_BY_TYPE]
  if (!rules) return null
  slot.depletedDay ??= day
  if (day - slot.depletedDay < rules.respawnDelayDays) return null
  const point = respawnPoint(slot, day, spatial)
  const total = slot.totalQuantity ?? slot.quantity ?? 0
  if (!point || !(total > 0)) return null
  const resource: SaveEntityState = {
    ...slot,
    ...point,
    quantity: Math.max(1, Math.ceil(total * (slot.type === RESOURCE_TYPES.wheat ? 1 : rules.respawnQuantityRatio))),
    isDead: false,
    isDestroyed: false,
  }
  delete resource.depletedDay
  delete resource.x
  delete resource.y
  if (resource.totalHitPoints != null) resource.hitPoints = resource.totalHitPoints
  if (slot.type === RESOURCE_TYPES.wheat) resource.currentFrame = 0
  return resource
}

function growResource(resource: SaveEntityState, wheatMatureFrame: number): void {
  if (!isLiving(resource)) return
  let ratio = 0
  if (resource.type === RESOURCE_TYPES.berrybush) ratio = NATURAL_REGROWTH_CONFIG.berryRegrowRatioPerDay
  if (resource.type === RESOURCE_TYPES.wheat) {
    const frame = resource.currentFrame ?? wheatMatureFrame
    if (frame < wheatMatureFrame) {
      resource.currentFrame = Math.min(wheatMatureFrame, frame + NATURAL_REGROWTH_CONFIG.wheatGrowthFramesPerDay)
      return
    }
    ratio = NATURAL_REGROWTH_CONFIG.wheatRegrowRatioPerDay
  }
  const total = resource.totalQuantity ?? resource.quantity ?? 0
  if (ratio > 0 && total > 0)
    resource.quantity = Math.min(total, (resource.quantity ?? 0) + Math.max(1, Math.ceil(total * ratio)))
}

export function regrowOfflineResources(
  state: SerializedSave,
  day: number,
  spatial: OfflineWorldSpatial,
  wheatMatureFrame: number,
  report: OfflineWorldReport
): void {
  const slots = state.naturalResourceRespawnSlots ?? []
  for (let index = slots.length - 1; index >= 0; index--) {
    const slot = slots[index]
    if (!slot) continue
    const resource = respawnResource(slot, day, spatial)
    if (!resource) continue
    state.resources.push(resource)
    spatial.reserve(resource)
    slots.splice(index, 1)
    report.resourcesRespawned++
  }
  for (const resource of state.resources) growResource(resource, wheatMatureFrame)
}
