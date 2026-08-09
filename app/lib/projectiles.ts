type PlayerTechnologyState = {
  age?: number
  technologies?: string[]
}

const FIERY_PROJECTILES: Record<string, string> = {
  Arrow: 'FireArrow',
  ArrowCeramic: 'FireArrow',
  ArrowCopper: 'FireArrow',
  ArrowBronze: 'FireArrow',
  ArrowIron: 'FireArrow',
  Bolt: 'FireBolt',
  Stone: 'FireStone',
}

const AGE_ARROW_PROJECTILES = ['ArrowCeramic', 'ArrowCopper', 'ArrowBronze', 'ArrowIron'] as const

const BALLISTICS_PROJECTILES = new Set([
  'Arrow',
  'ArrowCeramic',
  'ArrowCopper',
  'ArrowBronze',
  'ArrowIron',
  'FireArrow',
  'Bolt',
  'FireBolt',
  'Stone',
  'FireStone',
])

function getAgeArrowProjectile(player?: PlayerTechnologyState | null): string {
  const age = Math.max(0, Math.floor(player?.age ?? 0))
  return AGE_ARROW_PROJECTILES[Math.min(age, AGE_ARROW_PROJECTILES.length - 1)]
}

export function getEffectiveProjectileType(projectileType: string, player?: PlayerTechnologyState | null): string {
  if (!player?.technologies?.includes('Alchemy')) {
    return projectileType === 'Arrow' ? getAgeArrowProjectile(player) : projectileType
  }

  const agedProjectileType = projectileType === 'Arrow' ? getAgeArrowProjectile(player) : projectileType
  return FIERY_PROJECTILES[agedProjectileType] ?? agedProjectileType
}

export function projectileTracksTarget(projectileType: string, player?: PlayerTechnologyState | null): boolean {
  return !!player?.technologies?.includes('Ballistics') && BALLISTICS_PROJECTILES.has(projectileType)
}
