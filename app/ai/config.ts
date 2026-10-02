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

export { BUILDING_TRAINING_CAPACITY as AI_BUILDING_TRAINING_CAPACITY } from '../lib/training/trainingRules'
export const AI_ABSTRACT_DAILY_RECRUITS = 2

export const MAX_VILLAGERS = 50

export const MAX_BUILDINGS = {
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

export const MAX_INFANTRY = 12
export const MAX_ARCHERS = 8
export const MAX_CAVALRY = 5
