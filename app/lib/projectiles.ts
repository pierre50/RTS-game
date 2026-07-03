type PlayerTechnologyState = {
  technologies?: string[]
}

const FIERY_PROJECTILES: Record<string, string> = {
  Arrow: 'FireArrow',
  Bolt: 'FireBolt',
  Stone: 'FireStone',
}

const BALLISTICS_PROJECTILES = new Set(['Arrow', 'FireArrow', 'Bolt', 'FireBolt', 'Stone', 'FireStone'])

export function getEffectiveProjectileType(projectileType: string, player?: PlayerTechnologyState | null): string {
  if (!player?.technologies?.includes('Alchemy')) {
    return projectileType
  }

  return FIERY_PROJECTILES[projectileType] ?? projectileType
}

export function projectileTracksTarget(projectileType: string, player?: PlayerTechnologyState | null): boolean {
  return !!player?.technologies?.includes('Ballistics') && BALLISTICS_PROJECTILES.has(projectileType)
}
