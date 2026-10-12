/** Internal tower levels 0 / 1 / 2. Each projectile targets a different enemy. */
export const TOWER_COMBAT_LEVELS = [
  { power: 3, range: 6, targets: 1 },
  { power: 5, range: 7, targets: 2 },
  { power: 7, range: 8, targets: 3 },
] as const
