import { BUILDING_TYPES, UNIT_TYPES } from '../constants'

export const AI_DIFFICULTIES = {
  easy: {
    stepDelayBase: 6000,
    popCapMultiplier: 0.7,
    attackThreshold: 8,
    defenderRatio: 0.5,
    econToMilVillagers: 16,
    raidThreshold: 0,
    raidSize: 0,
    attackCooldownMs: 35000,
    assaultRecallThreshold: 20,
    assaultRecallPowerRatio: 0.7,
    assaultRecallMaxRatio: 0.4,
    homeThreatRadius: 14,
    villageCoreRadius: 9,
  },
  medium: {
    stepDelayBase: 4000,
    popCapMultiplier: 1.0,
    attackThreshold: 5,
    defenderRatio: 0.3,
    econToMilVillagers: 12,
    raidThreshold: 0,
    raidSize: 0,
    attackCooldownMs: 24000,
    assaultRecallThreshold: 17,
    assaultRecallPowerRatio: 0.85,
    assaultRecallMaxRatio: 0.5,
    homeThreatRadius: 15,
    villageCoreRadius: 10,
  },
  hard: {
    stepDelayBase: 2500,
    popCapMultiplier: 1.3,
    attackThreshold: 3,
    defenderRatio: 0.2,
    econToMilVillagers: 8,
    raidThreshold: 4,
    raidSize: 3,
    attackCooldownMs: 16000,
    assaultRecallThreshold: 15,
    assaultRecallPowerRatio: 1,
    assaultRecallMaxRatio: 0.6,
    homeThreatRadius: 16,
    villageCoreRadius: 11,
  },
}

export const NEXT_AGE = {
  1: 'ToolAge',
  2: 'BronzeAge',
  3: 'IronAge',
}

export const AGE_UP_COSTS = {
  1: { food: 500 },
  2: { food: 800 },
  3: { food: 1000, gold: 800 },
}

export const AGE_UP_BUFFERS = {
  1: { food: 200 },
  2: { food: 200 },
  3: { food: 200, gold: 200 },
}

export const MAX_VILLAGER_PER_AGE = {
  0: 16,
  1: 24,
  2: 40,
  3: 50,
}

export const VILLAGE_TARGET_PERCENTAGE_BY_AGE = {
  0: { wood: 40, food: 60, gold: 0, stone: 0 },
  1: { wood: 45, food: 45, gold: 10, stone: 0 },
  2: { wood: 35, food: 35, gold: 20, stone: 10 },
  3: { wood: 30, food: 30, gold: 25, stone: 15 },
}

export const MAX_BUILDING_BY_AGE = {
  0: {
    StoragePit: 1,
    Granary: 1,
    Barracks: 1,
    Market: 1,
  },
  1: {
    StoragePit: 2,
    Granary: 2,
    Farm: 4,
    Barracks: 1,
    Market: 1,
    ArcheryRange: 1,
    Stable: 1,
    WatchTower: 2,
  },
  2: {
    StoragePit: 3,
    Granary: 3,
    Farm: 6,
    Barracks: 2,
    Market: 1,
    GovernmentCenter: 1,
    TownCenter: 2,
    ArcheryRange: 1,
    Stable: 1,
    Academy: 1,
    WatchTower: 3,
    SentryTower: 2,
  },
  3: {
    StoragePit: 4,
    Granary: 4,
    Farm: 10,
    Barracks: 2,
    Market: 1,
    GovernmentCenter: 1,
    TownCenter: 2,
    ArcheryRange: 2,
    Stable: 1,
    Academy: 1,
    WatchTower: 3,
    SentryTower: 3,
  },
}

export const MAX_INFANTRY_BY_AGE = { 0: 8, 1: 8, 2: 10, 3: 12 }
export const MAX_ARCHER_BY_AGE = { 0: 0, 1: 4, 2: 6, 3: 8 }
export const MAX_CAVALRY_BY_AGE = { 0: 0, 1: 3, 2: 4, 3: 5 }
export const MAX_HOPLITE_BY_AGE = { 0: 0, 1: 0, 2: 2, 3: 4 }

export const TECH_PRIORITY_BY_BUILDING = {
  [BUILDING_TYPES.barracks]: ['BattleAxe', 'ShortSword', 'BroadSword', 'LongSword'],
  [BUILDING_TYPES.archeryRange]: ['ImprovedBow', 'CompositeBow'],
  [BUILDING_TYPES.storagePit]: [
    'Toolworking',
    'LeatherArmorInfantry',
    'Metalworking',
    'ScaleArmorInfantry',
    'Metallurgy',
    'ChainmailInfantry',
    'BronzeShield',
    'IronShield',
  ],
  [BUILDING_TYPES.market]: ['Woodworking', 'GoldMining', 'StoneMining', 'Domestication'],
  [BUILDING_TYPES.granary]: ['ResearchWatchTower', 'ResearchSentryTower'],
}

export const MILITARY_CAPS_BY_GROUP = {
  infantry: MAX_INFANTRY_BY_AGE,
  archer: MAX_ARCHER_BY_AGE,
  cavalry: MAX_CAVALRY_BY_AGE,
  hoplite: MAX_HOPLITE_BY_AGE,
}

export const BASE_TARGET_VALUE_BY_TYPE = {
  [UNIT_TYPES.villager]: 10,
  [BUILDING_TYPES.townCenter]: 14,
  [BUILDING_TYPES.archeryRange]: 9,
  [BUILDING_TYPES.barracks]: 8,
  [BUILDING_TYPES.stable]: 8,
  [BUILDING_TYPES.academy]: 8,
  [BUILDING_TYPES.market]: 7,
  [BUILDING_TYPES.granary]: 6,
  [BUILDING_TYPES.storagePit]: 6,
  [BUILDING_TYPES.watchTower]: 4,
  [BUILDING_TYPES.sentryTower]: 5,
}
