import type { MapBlueprint } from '../../classes/map/MapGenerationTypes'
import { restoreCampRespawnStates } from '../../lib/camps/campRespawnState'
import { definedProperties } from '../../lib/definedProperties'
import { preloadBakedLpcUnitsForPlayers } from '../../lib/lpc'
import { preparedSettlementState } from '../../serialization/PreparedSettlementState'
import { serializeGame } from '../../serialization/SaveSerializer'
import { placeInitialVillageUnits } from '../../services/world/InitialVillagePlacement'
import { OfflineWorldSpatial } from '../../services/world/offline/OfflineWorldSpatial'
import { populateVillageBase } from '../../services/world/VillageBaseState'
import { applyVillageStartingState, placeStartingHeroInVillage } from '../../services/world/VillageStartingState'
import { materializeInitialEconomy } from '../../services/world/WorldEconomy'
import { economyRulesFor } from '../../services/world/WorldEconomyRuntime'
import type { GameConfig, SavePlayerState, SerializedSave, VillageStartProfile } from '../../types/save'
import type { GameWorldBootHost, RuntimeMapInstance } from './GameBootContext'
import { measure, measureAsync } from './GameBootContext'
import { savedRuntimeState } from './GameStateHelpers'

export async function preloadSavedPlayerAssets(game: GameWorldBootHost, json: SerializedSave): Promise<void> {
  // Saved units need their owner's appearance sheets before their constructors run.
  const players = [
    ...json.players,
    ...(json.runtime?.worldPursuers ?? []).flatMap(entry => (entry.owner ? [entry.owner] : [])),
  ]
    .flatMap(player => [
      player,
      ...[...(player.units ?? []), ...(player.corpses ?? [])]
        .filter(unit => unit.assetCiv)
        .map(unit => ({ ...player, civ: unit.assetCiv })),
    ])
    .map(player =>
      definedProperties({
        civ: player.civ,
        gender: player.gender,
        label: player.label ?? '',
        heroAppearance: player.heroAppearance,
      })
    )
  await measureAsync(game, 'save.preloadPlayerAssets', () =>
    preloadBakedLpcUnitsForPlayers(players, game.context.performance, { preloadEquipment: true })
  )
}

async function applyGeneratedState(
  game: GameWorldBootHost,
  map: RuntimeMapInstance,
  generated: SerializedSave,
  measureName: string
): Promise<void> {
  await preloadSavedPlayerAssets(game, generated)
  measure(game, measureName, () => map.mapGeneration.applySavedStateToGeneratedMap(savedRuntimeState(generated)))
}

export async function restorePreparedSettlements(
  game: GameWorldBootHost,
  map: RuntimeMapInstance,
  blueprint: MapBlueprint,
  config: GameConfig
): Promise<void> {
  const generated = preparedSettlementState(
    serializeGame(game._gameContext()),
    blueprint,
    { ...config, heroOnlyStart: map.heroOnlyStart },
    Number(game.context.player?.config?.units?.Hero?.totalHitPoints) || 18
  )
  await applyGeneratedState(game, map, generated, 'boot.restorePreparedSettlements')
  restoreCampRespawnStates(map, generated.runtime?.banditCamps ?? [])
}

function needsVillageBase(player: SavePlayerState, economy: SerializedSave | undefined): boolean {
  if (player.type !== 'AI' && !player.isPlayed) return false
  if (player.units?.length || player.buildings?.length) return false
  return !economy?.players.some(p => p.factionId && p.factionId === player.factionId)
}

function createInitialVillageState(
  game: GameWorldBootHost,
  map: RuntimeMapInstance,
  economy: SerializedSave | undefined
): SerializedSave {
  const initial = measure(game, 'boot.serializeInitialVillage', () => serializeGame(game._gameContext()))
  const rules = economyRulesFor(initial)
  const spatial = measure(
    game,
    'boot.createVillageSpatial',
    () => new OfflineWorldSpatial(map.grid, initial, (b, i) => Number(rules.buildingConfig(i, b.type).size) || 2)
  )
  initial.players.forEach((player, index) => {
    if (!needsVillageBase(player, economy)) return
    const runtime = game.context.players.find(p => p.label === player.label)
    if (!runtime) throw new Error('Missing starting player anchor')
    measure(game, `boot.populateVillage.${index}`, () =>
      populateVillageBase(player, index, runtime, spatial, rules, map.startingResources, {
        heroOnly: player.isPlayed && map.heroOnlyStart,
        workers: map.startingUnits,
      })
    )
  })
  return initial
}

function factionIds(state: SerializedSave): Set<string> {
  return new Set(state.players.flatMap(p => (p.factionId ? [p.factionId] : [])))
}

export async function seedStartingVillages(
  game: GameWorldBootHost,
  map: RuntimeMapInstance,
  config: GameConfig,
  profiles: Record<string, VillageStartProfile>,
  economy: SerializedSave | undefined
): Promise<void> {
  const initial = createInitialVillageState(game, map, economy)
  const rules = economyRulesFor(initial)
  const generated = measure(game, 'boot.applyVillageStartingState', () =>
    applyVillageStartingState(initial, profiles, map.grid, rules, { skipPlayed: Boolean(config.heroStartVillage) })
  )
  measure(game, 'boot.placeInitialVillageUnits', () =>
    placeInitialVillageUnits(generated, factionIds(generated), map.grid, rules, { includePlayed: true })
  )
  const heroStartVillage = config.heroStartVillage
  if (heroStartVillage) {
    measure(game, 'boot.placeStartingHero', () =>
      placeStartingHeroInVillage(generated, heroStartVillage, map.grid, rules)
    )
  }
  await applyGeneratedState(game, map, generated, 'boot.applyGeneratedState')
}

export async function materializeCampaignRegionEconomy(
  game: GameWorldBootHost,
  map: RuntimeMapInstance,
  previousCampaign: GameWorldBootHost['_campaignSave'],
  villageEconomy: SerializedSave | undefined,
  dayNightElapsedMs: number | null | undefined
): Promise<void> {
  if (!previousCampaign?.economy || !map.worldRegionId) return
  const economy = previousCampaign.economy.regions[map.worldRegionId]?.initialState
  if (!economy) return
  const generated = measure(game, 'boot.materializeInitialEconomy', () =>
    materializeInitialEconomy(createInitialVillageState(game, map, villageEconomy), economy, dayNightElapsedMs ?? 0)
  )
  placeInitialVillageUnits(generated, factionIds(economy), map.grid, economyRulesFor(generated))
  await applyGeneratedState(game, map, generated, 'boot.applyGeneratedState')
}
