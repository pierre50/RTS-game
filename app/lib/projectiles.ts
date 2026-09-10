import type { ContainerChild } from 'pixi.js'
import type { RuntimeMap } from '../types/map'

type PlayerAgeState = {
  age?: number
}

type RuntimeProjectileDisplay = ContainerChild & {
  attachToMapSpace?: () => void
}

const AGE_ARROW_PROJECTILES = ['ArrowCeramic', 'ArrowBronze', 'ArrowIron'] as const

function getAgeArrowProjectile(player?: PlayerAgeState | null): string {
  const age = Math.max(0, Math.floor(player?.age ?? 0))
  return AGE_ARROW_PROJECTILES[Math.min(age, AGE_ARROW_PROJECTILES.length - 1)]
}

export function getEffectiveProjectileType(projectileType: string, player?: PlayerAgeState | null): string {
  return projectileType === 'Arrow' ? getAgeArrowProjectile(player) : projectileType
}

export function attachProjectileToMapSpace(projectile: RuntimeProjectileDisplay, map: RuntimeMap): void {
  if (typeof projectile.attachToMapSpace === 'function') {
    projectile.attachToMapSpace()
    return
  }
  map.addChild(projectile)
}
