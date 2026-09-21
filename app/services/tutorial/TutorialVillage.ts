import { MAX_BUILDING_BY_AGE } from '../../ai/config'
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
        age: 0,
        wheatFields: 5,
        buildings: {
          ...MAX_BUILDING_BY_AGE[0],
          Granary: 2,
          StoragePit: 2,
          TownCenter: 1,
          Barracks: 1,
          ArcheryRange: 1,
          House: 6,
          WatchTower: 2,
          FireCamp: 2,
          CampCrate: 2,
          CampJarLarge: 1,
          CampBucket: 1,
          CampDryingRack: 1,
        },
        units: { Chief: 1, Villager: 12, Fantassin: 4 },
      },
    },
  }
}
