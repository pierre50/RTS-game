import { SETTLEMENT_PROFILES } from '../../config/settlementProfiles'
import type { GameConfig } from '../../types/save'

/** New-game setup only: materialize the tutorial through the existing village generator. */
export function tutorialVillageConfig(config: GameConfig): GameConfig {
  const human = config.players?.find(player => player.isHuman) ?? config.players?.[0]
  const civ = human?.civ ?? 'Hellas'
  return {
    ...config,
    heroOnlyStart: true,
    heroStartVillage: civ,
    villageStarts: {
      ...config.villageStarts,
      [civ]: {
        ...SETTLEMENT_PROFILES.village,
        buildings: { ...SETTLEMENT_PROFILES.village.buildings, FireCamp: 1, CampCrate: 1, CampBucket: 1 },
      },
    },
  }
}
