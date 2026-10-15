import { Container } from 'pixi.js'
import type { Projectile } from '../../classes/Projectile'
import {
  applyEmbeddedMask,
  createImpactEffect,
  createShadowSprite,
  createSprite,
  updateShadowVisual,
  updateTrajectoryVisual,
  type EmbeddedMaskKind,
  type ProjectileSprite,
} from './PixiProjectileVisuals'
import type { ProjectileTrajectoryFrame } from '../../classes/ProjectileTrajectory'

/** The projectile's Pixi container; flight and collision remain on the logical object. */
export class PixiProjectileView {
  readonly container = new Container()

  constructor(private readonly projectile: Projectile) {
    this.container.label = projectile.label
    Object.assign(this.container, { family: projectile.family, runtimeEntity: projectile, spaceId: projectile.spaceId })
  }

  createSprite(degree: number): ProjectileSprite { return createSprite(this.projectile, degree) }
  createShadowSprite(source: ProjectileSprite): ProjectileSprite { return createShadowSprite(this.projectile, source) }
  updateTrajectory(frame: ProjectileTrajectoryFrame): void { updateTrajectoryVisual(this.projectile, frame) }
  updateShadow(progress: number): void { updateShadowVisual(this.projectile, progress) }
  createImpactEffect(x: number, y: number): void { createImpactEffect(this.projectile, x, y) }
  applyEmbeddedMask(kind: EmbeddedMaskKind): void { applyEmbeddedMask(this.projectile, kind) }
}
