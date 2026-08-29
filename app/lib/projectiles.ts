import type { ContainerChild } from 'pixi.js'
import type { RuntimeMap } from '../types/map'

type PlayerTechnologyState = {
  age?: number
  technologies?: string[]
}

type RuntimeProjectileDisplay = ContainerChild & {
  attachToMapSpace?: () => void
}

const AGE_ARROW_PROJECTILES = ['ArrowCeramic', 'ArrowCopper', 'ArrowBronze', 'ArrowIron'] as const

const BALLISTICS_PROJECTILES = new Set([
  'Arrow',
  'ArrowCeramic',
  'ArrowCopper',
  'ArrowBronze',
  'ArrowIron',
])

function getAgeArrowProjectile(player?: PlayerTechnologyState | null): string {
  const age = Math.max(0, Math.floor(player?.age ?? 0))
  return AGE_ARROW_PROJECTILES[Math.min(age, AGE_ARROW_PROJECTILES.length - 1)]
}

export function getEffectiveProjectileType(projectileType: string, player?: PlayerTechnologyState | null): string {
  return projectileType === 'Arrow' ? getAgeArrowProjectile(player) : projectileType
}

export function projectileTracksTarget(projectileType: string, player?: PlayerTechnologyState | null): boolean {
  return !!player?.technologies?.includes('Ballistics') && BALLISTICS_PROJECTILES.has(projectileType)
}

export function attachProjectileToMapSpace(projectile: RuntimeProjectileDisplay, map: RuntimeMap): void {
  if (typeof projectile.attachToMapSpace === 'function') {
    projectile.attachToMapSpace()
    return
  }
  map.addChild(projectile)
}
