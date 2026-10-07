import { assignSettlementNames } from '../../../lib/settlements/settlementNames'
import { reconcileHouseholds } from '../../../lib/housing/households'
import { installDeferredVillages, canDeferVillage } from '../../../services/world/distantVillages/DeferredVillageStore'
import { advanceDeferredVillage } from '../../../services/world/distantVillages/DeferredVillageEconomy'
import type { SavePlayerState } from '../../../types/save'
import { restoredResourceState } from '../../../serialization/ResourceSaveData'
import { getPopulationCapacityFromBuildings } from '../../../lib/buildings/buildingOccupancy'
import { FAMILY_TYPES, PASSABLE_RESOURCE_TYPES, PLAYER_TYPES } from '../../../constants'
import { getGaiaAnimals } from '../../../lib'
import { migrateLegacyProgression } from '../../../serialization/LegacyProgressionMigration'

import { rehydrateAIKnowledge } from '../../../services/visibility/UnitPerception'
import { installWildlifeStore, isWildlife } from '../../../services/wildlife/WildlifeStore'
import type { GameContextLike } from '../../../types/context'
import type { ResourceEntity } from '../../../types/entities'
import type { PlayerLike } from '../../../types/player'
import type { SaveEntityState } from '../../../types/save'
import { getPackedCellStore } from '../../cell/PackedCellRegistry'
import { AI, Gaia, Human, Player } from '../../players'
import type { ResourceOptions } from '../../Resource'
import { Resource } from '../../Resource'
import { CompactResourceSet } from '../../resources/CompactResourceSet'
import { getResourceConfig } from '../../ResourceTexture'
import type { GaiaRespawnSlot, MapGenerationMap, SavedGameData } from '../MapGenerationTypes'
import {
  processUnit,
  restoreAIState,
  restoreBuildingAssignments,
  restoreCaveOccupants,
  restorePlayerEntitiesFromSave,
  restorePlayerInteriors,
  restorePlayerViews,
  restoreSelection,
} from '../MapSaveRestore'
import type { SavedPlayer } from '../MapSaveRestoreTypes'

export function runtimeContext(map: MapGenerationMap): GameContextLike {
  const { context } = map
  if (!context.app || !context.gamebox || !context.map || !context.scheduler) {
    throw new Error('Map generation requires a runtime context')
  }
  return context as GameContextLike
}

function createGaiaRespawnSlot(animal: SaveEntityState, context: GameContextLike, owner: PlayerLike): GaiaRespawnSlot {
  return {
    ...animal,
    context,
    family: FAMILY_TYPES.animal,
    isDestroyed: true,
    owner,
  }
}

function createResourceFromState(
  resource: ResourceOptions & { isDead?: boolean; isDestroyed?: boolean },
  map: MapGenerationMap
): ResourceEntity {
  return Resource.spawn(restoredResourceState(resource), runtimeContext(map))
}

export function restoreSavedPlayers(
  map: MapGenerationMap,
  players: SavedPlayer[],
  runtime?: SavedGameData['runtime']
): void {
  const classMap: Record<string, typeof Human | typeof AI | typeof Player> = {
    Human,
    AI,
    [PLAYER_TYPES.bandits]: AI,
  }
  const context = runtimeContext(map)
  map.context.players = players.map((player: SavedPlayer) => {
    if (player.type === PLAYER_TYPES.ai) player.developmentMode ??= 'static'
    migrateLegacyProgression(player)
    const PlayerClass = classMap[player.type] ?? Player
    const restoredPlayer = new PlayerClass(
      {
        ...player,
        corpses: [],
        buildings: [],
        units: [],
        ...(player.type === PLAYER_TYPES.ai || player.type === PLAYER_TYPES.bandits
          ? { difficulty: map.difficulty }
          : {}),
      },
      context
    )
    if (
      !map.instantMode &&
      player.settlementType !== 'outpost' &&
      [PLAYER_TYPES.human, PLAYER_TYPES.ai].includes(player.type)
    ) {
      reconcileHouseholds(player)
      player.populationMax = getPopulationCapacityFromBuildings(player.buildings ?? [], player)
      restoredPlayer.populationMax = player.populationMax
    }
    if (player.isPlayed) map.context.player = restoredPlayer
    return restoredPlayer
  })
  if (Number.isFinite(runtime?.elapsedMs) && map.context.scheduler) {
    map.context.scheduler.elapsedMs = Math.max(0, runtime?.elapsedMs ?? 0)
  }
}

export function restoreSavedResources(
  map: MapGenerationMap,
  resources: SaveEntityState[],
  naturalResourceRespawnSlots?: SaveEntityState[]
): void {
  const packed = !map.context.editor && getPackedCellStore(map.grid)
  if (packed) {
    const collection = new CompactResourceSet(
      resources.length,
      packed.stride,
      `resource:${map.worldId ?? 'local'}:${map.worldRegionId ?? 'outside'}:${map.seed ?? 0}`,
      type => getResourceConfig().resources[type],
      state => createResourceFromState(state, map),
      runtimeContext(map)
    )
    map.resources = collection
    packed.resourceAt = index => collection.atCell(index)
    for (const resource of resources) {
      if (collection.canPack(resource)) {
        collection.addState(resource)
        const index = resource.i * packed.stride + resource.j
        const extra = packed.extras.get(index)
        if (extra?.has == null && extra) delete extra.has
        if (!PASSABLE_RESOURCE_TYPES.has(resource.type)) packed.flags[index] |= 1
      } else collection.add(createResourceFromState(resource, map))
    }
  } else map.resources = new Set(resources.map(resource => createResourceFromState(resource, map)))

  map.naturalResourceRespawnSlots = [...(naturalResourceRespawnSlots ?? [])]
}

export function restoreSavedEntities(
  map: MapGenerationMap,
  players: SavedPlayer[],
  animals: SaveEntityState[],
  context: GameContextLike,
  elapsedMs?: number
): void {
  assignSettlementNames(players)
  const deferred = installDeferredVillages(context, elapsedMs)
  const deferredOwners = new Set<PlayerLike>()
  // Register every owner before resolving any saved cross-reference.
  map.context.players.forEach((player, index) => {
    const saved = players[index] as SavePlayerState
    if (canDeferVillage(context, saved)) {
      deferredOwners.add(player)
      deferred.add(
        player,
        saved,
        state => {
          Object.assign(
            player,
            Object.fromEntries(
              Object.entries(state).filter(
                ([key]) => !['units', 'buildings', 'corpses', 'views', 'aiState', 'targetKnowledge'].includes(key)
              )
            )
          )
          restorePlayerEntitiesFromSave(player, state as SavedPlayer, true)
          restorePlayerInteriors(player)
          restorePlayerViews(player, map)
          restoreBuildingAssignments(player, state.buildings ?? [], map)
          rehydrateAIKnowledge(player, map)
          restoreAIState(player, state as SavedPlayer, map)
          const units = new Map(state.units?.map(unit => [unit.label, unit]))
          player.units.forEach(unit => processUnit(unit, map, units.get(unit.label), { resume: false }))
          const alreadyResting = new Set(player.units.filter(unit => unit.shelterState))
          context.unitRest?.synchronizeVillageRest?.(player.units)
          player.units.forEach(unit => {
            if (!unit.shelterState && !alreadyResting.has(unit)) processUnit(unit, map, units.get(unit.label))
          })
        },
        (state, from, to) =>
          advanceDeferredVillage(context, player, state, from, to, resource => {
            map.resources.add(createResourceFromState(resource, map))
          })
      )
    }
  })
  map.context.players.forEach((player, index) => {
    if (!deferredOwners.has(player)) restorePlayerEntitiesFromSave(player, players[index], true)
  })
  map.context.players.forEach(restorePlayerInteriors)
  const gaia = map.gaia instanceof Gaia ? map.gaia : null
  const wildlife = installWildlifeStore(map, animals.filter(isWildlife), `wildlife:${map.seed ?? 0}`)
  const interacting = new Set<string>()
  for (const player of players)
    for (const unit of player.units ?? []) {
      for (const ref of [unit.dest, unit.previousDest, unit.realDest]) {
        const label = typeof ref === 'string' ? ref : Array.isArray(ref) ? ref[2] : ref?.label
        if (label) interacting.add(label)
      }
    }
  // Restore encounter participants before resolving unit destinations and combat references.
  for (const animal of animals) {
    if (!isWildlife(animal) || animal.isDestroyed || !gaia) continue
    if (!animal.isFleeing && animal.action !== 'attack' && !interacting.has(animal.label ?? '')) continue
    const cell = map.grid[animal.i]?.[animal.j]
    if (!cell || cell.has) continue
    const saved = wildlife.entries.get(animal.label ?? '')?.state ?? animal
    gaia.createAnimal({ ...saved, ...animal })
  }
  animals
    .filter(animal => !isWildlife(animal))
    .forEach(animal => {
      if (!gaia) return
      if (animal.isDestroyed)
        (gaia.animals as unknown as GaiaRespawnSlot[]).push(createGaiaRespawnSlot(animal, context, gaia))
      else gaia.createAnimal(animal)
    })

  getGaiaAnimals(gaia)
    .filter(animal => !animal.isDestroyed)
    .forEach(animal => processUnit(animal, map))

  restoreCaveOccupants(
    context,
    players.map((saved, index) =>
      deferred.has(map.context.players[index]) ? { ...saved, units: [], buildings: [], corpses: [] } : saved
    )
  )
  map.context.players.forEach((player, index) => {
    if (deferred.has(player)) return
    const savedPlayer = players[index]
    restorePlayerViews(player, map)
    restoreBuildingAssignments(player, savedPlayer?.buildings || [], map)
    rehydrateAIKnowledge(player, map)
    restoreAIState(player, savedPlayer, map)
    const savedUnitsByLabel = new Map(savedPlayer?.units?.map(saved => [saved.label, saved]))
    player.units.forEach(unit => processUnit(unit, map, savedUnitsByLabel.get(unit.label)))
    restoreSelection(player, savedPlayer, map)
  })
  let remaining: number
  do {
    remaining = deferred.size
    deferred.update()
  } while (deferred.size < remaining)
  context.performance?.markEvent?.('village.deferred', { owners: deferred.size })
}
