const FIERY_PROJECTILES = {
  Arrow: 'FireArrow',
  Bolt: 'FireBolt',
  Stone: 'FireStone',
}

const BALLISTICS_PROJECTILES = new Set(['Arrow', 'FireArrow', 'Bolt', 'FireBolt', 'Stone', 'FireStone'])

export function getEffectiveProjectileType(projectileType, player) {
  if (!player?.technologies?.includes('Alchemy')) {
    return projectileType
  }

  return FIERY_PROJECTILES[projectileType] ?? projectileType
}

export function projectileTracksTarget(projectileType, player) {
  return player?.technologies?.includes('Ballistics') && BALLISTICS_PROJECTILES.has(projectileType)
}
