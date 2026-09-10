export const AI_DIFFICULTIES = {
  easy: {
    stepDelayBase: 6000,
    popCapMultiplier: 0.7,
    defenderRatio: 0.5,
    econToMilVillagers: 16,
    defenseRecallThreshold: 20,
    defensePowerRatio: 0.7,
    homeThreatRadius: 14,
    villageCoreRadius: 9,
  },
  medium: {
    stepDelayBase: 4000,
    popCapMultiplier: 1.0,
    defenderRatio: 0.3,
    econToMilVillagers: 12,
    defenseRecallThreshold: 17,
    defensePowerRatio: 0.85,
    homeThreatRadius: 15,
    villageCoreRadius: 10,
  },
  hard: {
    stepDelayBase: 2500,
    popCapMultiplier: 1.3,
    defenderRatio: 0.2,
    econToMilVillagers: 8,
    defenseRecallThreshold: 15,
    defensePowerRatio: 1,
    homeThreatRadius: 16,
    villageCoreRadius: 11,
  },
}

export const MAX_VILLAGER_PER_AGE = {
  0: 16,
  1: 40,
  2: 50,
}

export const VILLAGE_TARGET_PERCENTAGE_BY_AGE = {
  0: { wood: 35, food: 50, gold: 0, stone: 15 },
  1: { wood: 30, food: 35, gold: 15, stone: 20 },
  2: { wood: 25, food: 30, gold: 20, stone: 25 },
}

export const MAX_BUILDING_BY_AGE = {
  0: {
    StoragePit: 1,
    Granary: 1,
    Barracks: 1,
    Market: 1,
  },
  1: {
    StoragePit: 3,
    Granary: 3,
    Barracks: 2,
    Market: 1,
    TownCenter: 2,
    ArcheryRange: 1,
    Stable: 1,
    WatchTower: 3,
  },
  2: {
    StoragePit: 4,
    Granary: 4,
    Barracks: 3,
    Market: 1,
    TownCenter: 2,
    ArcheryRange: 2,
    Stable: 1,
    WatchTower: 3,
  },
}

// Utilisé quand AGE_UP_ENABLED est false : l'IA reste bloquée à l'âge 0 pour toujours, donc on lui
// donne le plafond le plus haut défini pour chaque type de bâtiment (tous âges confondus) plutôt que
// de la brider à 1 baraque/1 dépôt/etc. à vie.
const MERGED_MAX_BUILDING_CAPS = Array.from(
  new Set(Object.values(MAX_BUILDING_BY_AGE).flatMap(ageConfig => Object.keys(ageConfig)))
).reduce(
  (acc, type) => {
    acc[type] = Math.max(
      ...Object.values(MAX_BUILDING_BY_AGE).map(ageConfig => (ageConfig as Record<string, number>)[type] || 0)
    )
    return acc
  },
  {} as Record<string, number>
)

export const MAX_BUILDING_BY_AGE_FROZEN = {
  0: MERGED_MAX_BUILDING_CAPS,
  1: MERGED_MAX_BUILDING_CAPS,
  2: MERGED_MAX_BUILDING_CAPS,
}

export const MAX_INFANTRY_BY_AGE = { 0: 8, 1: 10, 2: 12 }
export const MAX_ARCHER_BY_AGE = { 0: 0, 1: 6, 2: 8 }
export const MAX_CAVALRY_BY_AGE = { 0: 0, 1: 4, 2: 5 }
