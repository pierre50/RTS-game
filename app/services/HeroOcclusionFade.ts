import { FAMILY_TYPES, RESOURCE_TYPES } from '../constants'
import { getInstanceZIndex } from '../lib/maths'
import { boundsIntersect } from '../lib/graphics/chunkCulling'
import { findInstancesInSight, getInstanceScreenBounds, type RenderableInstance } from '../lib/grid/visibility'
import type { RuntimeEntity, UnitEntity } from '../types/entities'

const FADE_ALPHA = 0.35
const FADE_SPEED_PER_MS = 1 / 150
const SEARCH_RADIUS = 6
const ZINDEX_EPSILON = 0.01

function isFadeableOccluder(target: RuntimeEntity): boolean {
  if (!target || target.isDead || target.isDestroyed || !target.sprite) return false
  if (target.family === FAMILY_TYPES.building) return true
  return (
    target.family === FAMILY_TYPES.resource &&
    [RESOURCE_TYPES.tree, RESOURCE_TYPES.berrybush, RESOURCE_TYPES.wheat].includes(target.type)
  )
}

// Fades trees/buildings that visually overlap the hero on screen while drawing in front of it
// (higher iso zIndex), so the player doesn't lose sight of the hero behind foliage/walls.
export class HeroOcclusionFade {
  faded: Set<RuntimeEntity>

  constructor() {
    this.faded = new Set()
  }

  update(hero: UnitEntity | null, elapsedMs: number): void {
    const step = FADE_SPEED_PER_MS * Math.max(0, elapsedMs)
    const occluding = this.findOccluders(hero)

    for (const entity of occluding) {
      this.faded.add(entity)
      entity.alpha = Math.max(FADE_ALPHA, (entity.alpha ?? 1) - step)
    }

    for (const entity of this.faded) {
      if (occluding.has(entity)) continue
      if (entity.isDestroyed) {
        this.faded.delete(entity)
        continue
      }
      const restored = Math.min(1, (entity.alpha ?? FADE_ALPHA) + step)
      entity.alpha = restored
      if (restored >= 1) this.faded.delete(entity)
    }
  }

  findOccluders(hero: UnitEntity | null): Set<RuntimeEntity> {
    const occluding = new Set<RuntimeEntity>()
    if (!hero || hero.isDead || hero.isDestroyed || !hero.context) return occluding

    const heroBounds = getInstanceScreenBounds(hero)
    if (!heroBounds) return occluding
    const heroZIndex = hero.zIndex ?? getInstanceZIndex(hero)

    const sightOrigin: RenderableInstance = {
      i: hero.i,
      j: hero.j,
      x: hero.x,
      y: hero.y,
      label: hero.label,
      sight: SEARCH_RADIUS,
      context: hero.context,
    }

    const candidates = findInstancesInSight(sightOrigin, instance =>
      isFadeableOccluder(instance as RuntimeEntity)
    ) as RuntimeEntity[]

    for (const candidate of candidates) {
      const candidateZIndex = candidate.zIndex ?? getInstanceZIndex(candidate)
      if (candidateZIndex <= heroZIndex + ZINDEX_EPSILON) continue
      const candidateBounds = getInstanceScreenBounds(candidate)
      if (candidateBounds && boundsIntersect(heroBounds, candidateBounds)) occluding.add(candidate)
    }

    return occluding
  }

  destroy(): void {
    for (const entity of this.faded) {
      if (!entity.isDestroyed) entity.alpha = 1
    }
    this.faded.clear()
  }
}
