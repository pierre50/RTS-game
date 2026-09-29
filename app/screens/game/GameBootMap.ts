import { ensureNeutralPlayer } from '../../classes/players/GaiaPlayer'
import { CIVILIZATIONS } from '../../config/civilizations'
import { isContinentWorld } from '../../config/continentWorlds'
import { isLargeMapIsolationTest, isolateLargeMapBlueprint, isolateLargeMapConfig } from '../../config/largeMapTest'
import { DEFAULT_WORLD_ID } from '../../config/worlds'
import { assignContinentVillages } from '../../lib/campaign/continentVillagePlacement'
import { preloadBakedLpcUnitsForPlayers } from '../../lib/lpc'
import type { GameConfig } from '../../types/save'
import type { GameWorldBootHost, NewGameBootOptions } from './GameBootContext'
import { measure, measureAsync, reportProgress } from './GameBootContext'
import { recordLoadedMapBlueprint } from './GameMapBlueprintRuntime'
import { buildWorldRegionPlayerConfigs, humanPlayerConfig, selectActivePlayer } from './WorldRegionPlayers'

export async function prepareBootMap(game: GameWorldBootHost, config: GameConfig, options: NewGameBootOptions) {
  config = isolateLargeMapConfig(config)
  const isolationTest = isLargeMapIsolationTest(config.worldId)
  game.context.performance?.setPhase?.('load')
  measure(game, 'boot.createRuntime', () => game._createRuntime())
  if (options.startPaused) game.context.paused = true
  const map = game._map()
  measure(game, 'boot.applyMapConfig', () =>
    game._applyMapConfig(map, config.heroStartVillage ? { ...config, heroOnlyStart: true } : config)
  )
  if (isolationTest) map.noAI = true
  measure(game, 'boot.createUiRuntime', () => game._createUiRuntime())

  const mapGenerationStartedAt = performance.now()
  const human = humanPlayerConfig(config)
  const worldId = config.worldId ?? DEFAULT_WORLD_ID
  await game._updateLoading('readingMap', 0.03)
  const loadedBlueprint = await measureAsync(game, 'boot.loadMapBlueprint', () =>
    game._loadRequiredWorldMapBlueprint({
      size: map.size,
      playerCiv: config.heroStartVillage ?? human.civ,
      worldId,
      worldRegionId: config.worldRegionId ?? undefined,
    })
  )
  const blueprint = isolateLargeMapBlueprint(
    isContinentWorld(config.worldId) ? assignContinentVillages(loadedBlueprint) : loadedBlueprint,
    config
  )
  if (isolationTest)
    console.info('[load] Continent isolation test: hero with authored camps and wildlife, no rival civilizations')
  if (blueprint.environment) map.environment = blueprint.environment
  await measureAsync(game, 'boot.generateFromBlueprint', () =>
    map.generateFromBlueprint(blueprint, { onProgress: reportProgress(game) })
  )
  recordLoadedMapBlueprint(map, blueprint, 'pregenerated-blueprint', mapGenerationStartedAt)
  await measureAsync(game, 'boot.preloadUnits', () =>
    preloadBakedLpcUnitsForPlayers(
      buildWorldRegionPlayerConfigs(config, blueprint, game._campaignSave?.factions).map(player => ({
        civ: player.civ ?? human.civ ?? 'Hellas',
        label: player.factionId ?? player.civ ?? 'preload',
        gender: player.gender,
        heroAppearance: player.heroAppearance,
      })),
      game.context.performance,
      {
        villagerCivilizations: CIVILIZATIONS.map(civilization => civilization.value),
        preloadEquipment: true,
      }
    )
  )
  if (options.startingSetup) {
    config = { ...config, ...(await measureAsync(game, 'boot.waitForStartingSetup', () => options.startingSetup!)) }
    config = isolateLargeMapConfig(config)
    map.heroOnlyStart = Boolean(config.heroOnlyStart)
  }
  await game._updateLoading('generatingPlayers', 0.27)
  game.context.players = measure(game, 'boot.generatePlayers', () =>
    map.generatePlayers(buildWorldRegionPlayerConfigs(config, blueprint, game._campaignSave?.factions))
  )
  game.context.player = selectActivePlayer(game.context.players)
  if (!isolationTest) ensureNeutralPlayer(game._gameContext())
  measure(game, 'boot.menuInit', () => game.context.menu?.init?.())

  return { config, map, blueprint, isolationTest, human, worldId }
}
