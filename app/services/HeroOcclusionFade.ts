import { FAMILY_TYPES } from '../constants'
import { OCCLUSION_FADE_ALPHA } from '../constants/occlusion'
import { getInstanceZIndex } from '../lib/maths'
import { sameMapSpace } from '../lib/mapSpaces'
import { texturesHaveOpaqueOverlap } from '../lib/graphics/alphaMask'
import { boundsIntersect } from '../lib/graphics/chunkCulling'
import { findInstancesInSight, getInstanceScreenBounds, type RenderableInstance } from '../lib/grid/visibility'
import type { BuildingEntity, ResourceEntity, RuntimeEntity, UnitEntity } from '../types/entities'

const FADE_SPEED_PER_MS = 1 / 150
const SEARCH_RADIUS = 6
const ZINDEX_EPSILON = 0.01

function isFadeableHeroOccluder(target: RuntimeEntity): boolean {
  if (!target || target.isDead || target.isDestroyed || !target.sprite) return false
  if (target.occlusionFade === false) return false
  if (target.family === FAMILY_TYPES.building) return (target as BuildingEntity).isBuilt === true
  if (target.family !== FAMILY_TYPES.resource) return false
  return !(target as ResourceEntity).isCutOrFallenTree?.()
}

function drawsInFrontOfHero(entity: RuntimeEntity, hero: UnitEntity): boolean {
  const heroZIndex = hero.zIndex ?? getInstanceZIndex(hero)
  const entityZIndex = entity.zIndex ?? getInstanceZIndex(entity)
  return entityZIndex > heroZIndex + ZINDEX_EPSILON
}

// Fades obstacles hiding hero team units, once per frame even when several
// units overlap the same obstacle.
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
      entity.alpha = Math.max(OCCLUSION_FADE_ALPHA, (entity.alpha ?? 1) - step)
    }

    for (const entity of this.faded) {
      if (occluding.has(entity)) continue
      if (entity.isDestroyed) {
        this.faded.delete(entity)
        continue
      }
      const restored = Math.min(1, (entity.alpha ?? OCCLUSION_FADE_ALPHA) + step)
      entity.alpha = restored
      if (restored >= 1) this.faded.delete(entity)
    }
  }

  findOccluders(hero: UnitEntity | null): Set<RuntimeEntity> {
    const occluding = new Set<RuntimeEntity>()
    if (!hero || hero.isDead || hero.isDestroyed || !hero.context) return occluding

    this.collectOccluders(hero, occluding)
    const heroOwner = hero.owner
    if (!heroOwner) return occluding
    const owners = new Set([heroOwner, ...(hero.context.players ?? [])])
    for (const owner of owners) {
      const sameTeam =
        owner === heroOwner ||
        (owner.label && owner.label === heroOwner.label) ||
        (owner.team != null && owner.team === heroOwner.team)
      if (!sameTeam) continue
      for (const unit of owner.units ?? []) {
        if (unit === hero || !sameMapSpace(unit, hero)) continue
        this.collectOccluders(unit, occluding)
      }
    }
    return occluding
  }

  private collectOccluders(unit: UnitEntity, occluding: Set<RuntimeEntity>): void {
    if (unit.isDead || unit.isDestroyed || unit.visible === false || !unit.sprite || !unit.context) return
    const unitBounds = getInstanceScreenBounds(unit)
    if (!unitBounds) return

    const sightOrigin: RenderableInstance = {
      i: unit.i,
      j: unit.j,
      x: unit.x,
      y: unit.y,
      label: unit.label,
      spaceId: unit.spaceId,
      sight: SEARCH_RADIUS,
      context: unit.context,
    }

    const candidates = findInstancesInSight(sightOrigin, instance =>
      isFadeableHeroOccluder(instance as RuntimeEntity)
    ) as RuntimeEntity[]

    for (const candidate of candidates) {
      if (occluding.has(candidate) || candidate === unit || !drawsInFrontOfHero(candidate, unit)) continue
      const candidateBounds = getInstanceScreenBounds(candidate)
      if (
        candidateBounds &&
        boundsIntersect(unitBounds, candidateBounds) &&
        texturesHaveOpaqueOverlap(
          candidate.sprite!.texture,
          candidateBounds,
          unit.sprite.texture,
          unitBounds,
          unit.context.app.renderer
        )
      ) {
        occluding.add(candidate)
      }
    }
  }

  destroy(): void {
    for (const entity of this.faded) {
      if (!entity.isDestroyed) entity.alpha = 1
    }
    this.faded.clear()
  }
}
