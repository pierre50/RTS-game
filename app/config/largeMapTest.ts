import { CONTINENT_WORLD_PRESETS } from './continentWorlds'
import type { MapBlueprint } from '../classes/map/MapGenerationTypes'
import type { GameConfig } from '../types/save'

// Optional performance diagnostic. Normal continent games include all civilizations.
const LARGE_MAP_ISOLATION_TEST = false
export function isLargeMapIsolationTest(worldId?: string | null): boolean {
  return LARGE_MAP_ISOLATION_TEST && CONTINENT_WORLD_PRESETS.some(preset => preset.worldId === worldId)
}

export function isolateLargeMapConfig(config: GameConfig): GameConfig {
  if (!isLargeMapIsolationTest(config.worldId)) return config
  const human = config.players?.find(player => player.isHuman) ?? config.players?.[0] ?? { civ: 'Hellas' }
  return {
    ...config,
    players: [{ ...human, isHuman: true, civilizationLevel: 0 }],
    bots: 0,
    heroOnlyStart: true,
    heroStartVillage: undefined,
    villageStarts: undefined,
  }
}

export function isolateLargeMapBlueprint<T extends MapBlueprint>(blueprint: T, config: GameConfig): T {
  if (!isLargeMapIsolationTest(config.worldId)) return blueprint
  const civ = config.players?.find(player => player.isHuman)?.civ ?? config.players?.[0]?.civ ?? 'Hellas'
  // Keep the selected civilization's starting anchor without mutating the cached blueprint.
  return {
    ...blueprint,
    settlements: blueprint.settlements?.filter(
      settlement =>
        settlement.kind === 'banditCamp' ||
        (settlement.civ === civ && (settlement.kind === 'village' || settlement.kind === 'city'))
    ),
    banditCampPositions: blueprint.banditCampPositions,
  }
}
