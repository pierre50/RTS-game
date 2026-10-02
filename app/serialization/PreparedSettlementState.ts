import { migrateLegacyProgression } from './LegacyProgressionMigration'
import type { MapBlueprint } from '../classes/map/MapGenerationTypes'
import type { GameConfig, SavePlayerState, SerializedSave } from '../types/save'

/** Materialize authored entities verbatim. No placement, resource transfer or AI orders. */
export function preparedSettlementState(
  initial: SerializedSave,
  blueprint: MapBlueprint,
  config: GameConfig,
  heroHitPoints: number
): SerializedSave {
  const prepared = blueprint.preparedSettlements
  if (!prepared) throw new Error('Missing prepared settlements')
  const state = structuredClone(initial)
  const data = structuredClone(prepared)
  data.players.forEach(migrateLegacyProgression)
  delete state.resourceDelta
  const activeCivilizations = new Set(initial.players.filter(player => player.type === 'AI').map(player => player.civ))
  const excludedFields = new Set(
    data.settlements.filter(site => !activeCivilizations.has(site.civ)).flatMap(site => site.resourceLabels ?? [])
  )
  state.resources = data.resources.filter(resource => !resource.label || !excludedFields.has(resource.label))
  state.animals = data.animals
  state.players = state.players.map(player => {
    if (player.type !== 'AI' && !player.isPlayed) return player
    const site = data.settlements.find(site => site.id === player.label)
    const candidates = data.players.filter(p => p.type === 'AI' && p.civ === player.civ)
    const village = site
      ? candidates.find(p => p.label === site.ownerLabel)
      : candidates.length === 1
        ? candidates[0]
        : undefined
    const heroOnly = player.isPlayed && (config.heroOnlyStart || config.heroStartVillage)
    if (!village && !heroOnly) throw new Error(`Missing prepared settlement for ${player.civ}`)
    const result: SavePlayerState = heroOnly
      ? { ...player, buildings: [], units: [] }
      : {
          ...player,
          forgeUpgrades: village!.forgeUpgrades,
          settlementType: village!.settlementType,
          developmentMode: village!.developmentMode,
          buildings: village!.buildings,
          units: village!.units,
          population: village!.population,
          populationMax: village!.populationMax,
        }
    if (player.isPlayed) {
      const spawn = data.heroSpawns.find(p => p.civ === (config.heroStartVillage || player.civ))
      if (!spawn) throw new Error(`Missing prepared hero spawn for ${player.civ}`)
      result.units ??= []
      result.units.push({
        i: spawn.i,
        j: spawn.j,
        type: 'Hero',
        label: `${player.label}:hero`,
        gender: player.gender,
        inactif: true,
        hitPoints: heroHitPoints,
        totalHitPoints: heroHitPoints,
      })
      result.population = result.units.length
    }
    return result
  })
  const bandits: SavePlayerState = {
    label: `prepared-bandits:${prepared.mapId}`,
    factionId: 'bandits',
    name: 'Bandits',
    type: 'Bandits',
    civ: 'Hellas',
    color: 'black',
    isPlayed: false,
    buildings: data.players.filter(p => p.type === 'Bandits').flatMap(p => p.buildings ?? []),
    units: data.players.filter(p => p.type === 'Bandits').flatMap(p => p.units ?? []),
  }
  bandits.population = bandits.units!.length
  if (data.banditCamps.length) state.players.push(bandits)
  if (blueprint.caves?.length) {
    let neutral = state.players.find(p => p.label === 'neutral')
    if (!neutral) {
      neutral = {
        label: 'neutral',
        name: 'Neutral',
        type: 'Gaia',
        civ: 'Hellas',
        color: 'grey',
        diplomacy: 'neutral',
        buildings: [],
        units: [],
      }
      state.players.push(neutral)
    }
    neutral.buildings ??= []
    for (const placement of blueprint.caves) {
      const { i, j, ...cave } = placement
      const campIndex = data.banditCamps.findIndex(camp => camp.caveContent?.caveId === cave.id)
      neutral.buildings.push({
        i,
        j,
        label: `prepared-cave:${cave.id}`,
        type: 'Cave',
        isBuilt: true,
        cave: {
          ...cave,
          ...(campIndex < 0
            ? {}
            : {
                banditContent: {
                  ownerLabel: bandits.label!,
                  campIndex,
                  inventory: data.banditCamps[campIndex]!.caveContent!.inventory ?? {},
                },
              }),
        },
      })
    }
  }
  state.runtime = {
    ...state.runtime,
    banditCamps: data.banditCamps.map(camp => ({
      id: `camp:${camp.i}:${camp.j}`,
      i: camp.i,
      j: camp.j,
      unitTypes: camp.unitTypes,
      generation: 0,
      ...(camp.caveId ? { caveId: camp.caveId } : {}),
    })),
  }
  return state
}
