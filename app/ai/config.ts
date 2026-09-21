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

export const AI_BUILDING_TRAINING_CAPACITY = 5
export const AI_ABSTRACT_DAILY_RECRUITS = 2

export const MAX_VILLAGER_PER_AGE = {
  0: 50,
  1: 50,
  2: 50,
}

export const VILLAGE_TARGET_PERCENTAGE_BY_AGE = {
  0: { wood: 35, food: 50, gold: 0, stone: 15 },
  1: { wood: 30, food: 35, gold: 15, stone: 20 },
  2: { wood: 25, food: 30, gold: 20, stone: 25 },
}

const BUILDING_CAPS = {
  StoragePit: 4,
  Granary: 4,
  Barracks: 3,
  Market: 1,
  Forge: 1,
  TownCenter: 2,
  ArcheryRange: 2,
  Stable: 1,
  WatchTower: 3,
  Temple: 1,
}
export const MAX_BUILDING_BY_AGE = { 0: BUILDING_CAPS, 1: BUILDING_CAPS, 2: BUILDING_CAPS }
export const MAX_BUILDING_BY_AGE_FROZEN = MAX_BUILDING_BY_AGE

export const MAX_INFANTRY_BY_AGE = { 0: 12, 1: 12, 2: 12 }
export const MAX_ARCHER_BY_AGE = { 0: 8, 1: 8, 2: 8 }
export const MAX_CAVALRY_BY_AGE = { 0: 5, 1: 5, 2: 5 }
