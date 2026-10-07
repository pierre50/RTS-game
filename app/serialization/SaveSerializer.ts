import { deferredVillageState } from '../services/world/distantVillages/DeferredVillageStore'
import { CompactResourceSet, resourceReadValues } from '../classes/resources/CompactResourceSet'
import { filterObject } from '../lib'
import { serializeCampRespawnStates } from '../lib/camps/campRespawnState'
import { definedProperties } from '../lib/definedProperties'
import { exportTargetKnowledge } from '../lib/units/playerTargetKnowledge'
import { flushVillageSimulation } from '../lib/units/village/villageActivity'
import { summarizeVillagerAssignments } from '../lib/units/autonomy/villagerAssignments'
import { flushNaturalGrowth } from '../services/NaturalGrowthQueue'
import type { GameContextLike } from '../types/context'
import type { PlayerLike, VisionGridLike } from '../types/player'
import type { SavedAIState, SavePlayerState, SerializedSave } from '../types/save'
import type { SerializableEntity } from './entity/EntitySaveData'
import { buildingData, savedAnimals, unitData } from './entity/EntitySaveData'
import { groupPlayersInteriorBuildings, interiorSaveSpaceId } from './InteriorBuildingSave'
import { resourceData } from './ResourceSaveData'
export { serializeWildAnimal } from './entity/EntitySaveData'
const DEFAULT_SERIALIZED_MAP_TYPE = 'world-region'
const SERIALIZED_RESOURCE_NAMES = [
  'wood',
  'food',
  'berry',
  'meat',
  'wheat',
  'stone',
  'gold',
  'copper',
  'tin',
  'iron',
] as const
type SerializablePlayer = PlayerLike & {
  abstractProductionRemainder?: Record<string, number>
  offlineBuildingDecision?: string
  offlineBuildingPlanDay?: number
  aiState?: SavedAIState
  enemyBuildingMemory?: Map<string, ThreatMemory>
  enemyUnitMemory?: Map<string, ThreatMemory>
  getNow?: () => number
  hasBuilt?: string[]
  phase?: string
  population?: number
  populationMax?: number
  threatenedTargets?: Map<string, ThreatTargetMemory>
  views: VisionGridLike
}
type ThreatMemory = {
  instance?: { label?: string } | null
  label?: string
  lastSeenAt?: number
}
type ThreatTargetMemory = {
  attacker?: { label?: string } | null
  attackerFamily?: string | null
  attackerType?: string | null
  count?: number
  lastSeenAt?: number
  target?: { label?: string } | null
}
type SerializableContext = GameContextLike & {
  players?: SerializablePlayer[]
}

function cameraData(camera?: { x?: number; y?: number } | null) {
  return {
    x: camera?.x ?? 0,
    y: camera?.y ?? 0,
  }
}

function playerData(player: SerializablePlayer) {
  const deferred = deferredVillageState(player)
  if (deferred) return deferred
  const data: SavePlayerState = definedProperties({
    targetKnowledge: exportTargetKnowledge(player),
    ...filterObject(player, [
      'label',

      'type',
      ...SERIALIZED_RESOURCE_NAMES,
      'civ',
      'gender',
      'heroAppearance',
      'name',
      'factionId',
      'color',
      'team',
      'diplomacy',
      'population',
      'populationMax',
      'settlementType',
      'developmentMode',
      'rpgRestockDay',
      'offlineBuildingPlanDay',
      'abstractProductionRemainder',
      'offlineBuildingDecision',
      'forgeUpgrades',
      'cellViewed',
      'isPlayed',
      'hasBuilt',
    ]),
    buildings: player.buildings.map(building => {
      const saved = buildingData(building)
      const ownerKey = player.label || player.factionId || player.name || 'owner'
      if (building.context?.map?.spaces?.has(interiorSaveSpaceId(ownerKey, saved))) saved.interiorBuildings = []
      return saved
    }),
    units: player.units.map(unitData),
    corpses: player.corpses.map(unitData),

    villagerAssignments: summarizeVillagerAssignments(player.units),
    views: player.views.toJSON(),
    minimapBuildingMemory: player.minimapBuildingMemory?.map(entry => ({ ...entry })),
    minimapPreferences: player.minimapPreferences
      ? { zoom: player.minimapPreferences.zoom, hiddenMarkers: [...player.minimapPreferences.hiddenMarkers] }
      : undefined,
    selectedUnitLabels: !player.isPlayed
      ? player.selectedUnits?.length
        ? player.selectedUnits.map(unit => unit.label)
        : undefined
      : undefined,
    selectedUnitLabel: !player.isPlayed ? player.selectedUnit?.label : undefined,
    selectedBuildingLabel: !player.isPlayed ? player.selectedBuilding?.label : undefined,
    selectedOtherLabel: !player.isPlayed ? player.selectedOther?.label : undefined,
  })

  if (player.type === 'AI' || player.type === 'Bandits') {
    const savedAt = player.getNow?.() ?? 0
    const serializeMemory = (memory: ThreatMemory) => ({
      instance: memory.instance?.label || memory.label || null,
      lastSeenAgo: Math.max(0, savedAt - (memory.lastSeenAt ?? savedAt)),
    })

    data.aiState = {
      phase: player.phase,
      savedAt,
      enemyUnits: [...(player.enemyUnitMemory?.values?.() || [])].map(serializeMemory),
      enemyBuildings: [...(player.enemyBuildingMemory?.values?.() || [])].map(serializeMemory),
      threatenedTargets: [...(player.threatenedTargets?.values() || [])].map(threat => ({
        target: threat.target?.label || null,
        attacker: threat.attacker?.label || null,
        lastSeenAgo: Math.max(0, savedAt - (threat.lastSeenAt ?? savedAt)),
        count: threat.count ?? 0,
        attackerFamily: threat.attackerFamily ?? null,
        attackerType: threat.attackerType ?? null,
      })),
    }
  }

  return data
}

export function serializeGame(context: SerializableContext): SerializedSave {
  flushVillageSimulation(context)
  return serializeGameData(context, true)
}

export function serializeGameForPersistence(context: SerializableContext): SerializedSave {
  flushVillageSimulation(context)
  return serializeGameData(context, true, true)
}

/** Temporary campaign bootstrap only. Must be replaced by a full snapshot before persistence. */
export function serializeCampaignBootstrap(context: SerializableContext): SerializedSave {
  return serializeGameData(context, false)
}

function serializeGameData(
  context: SerializableContext,
  includeWorldEntities: boolean,
  useResourceDelta = false
): SerializedSave {
  flushNaturalGrowth(context.map)
  const delta =
    useResourceDelta &&
    context.map.pregeneratedBlueprintId != null &&
    context.map.resources instanceof CompactResourceSet
      ? context.map.resources.saveDelta(resource => resourceData(resource as SerializableEntity))
      : null
  if (delta)
    console.info('[save-resources]', {
      blueprintResources: delta.resourceDelta.count,
      modified: delta.resourceDelta.updated.length,
      removed: delta.resourceDelta.removed.length,
      dynamicOrAdded: delta.resources.length,
    })
  const sourceSize = context.map.localGridLayout
    ? context.map.worldManifest?.maps?.find(entry => entry.id === context.map.worldRegionId)?.size
    : undefined
  const world = definedProperties({
    roads: context.map.roads,
    seed: context.map.seed,
    size: context.map.size,
    mapType: context.map.mapType || DEFAULT_SERIALIZED_MAP_TYPE,
    environment: context.map.environment,
    pregeneratedBlueprintId: context.map.pregeneratedBlueprintId ?? null,
    worldId: context.map.worldId ?? null,
    worldRegionId: context.map.worldRegionId ?? null,
    ...(context.map.localGridLayout ? { localGridLayout: { ...context.map.localGridLayout } } : {}),
    ...(sourceSize != null ? { sourceSize } : {}),
  })
  const data: SerializedSave = {
    version: 2,
    runtime: {
      banditCamps: serializeCampRespawnStates(context.map),
      heroEquippedItem: context.controls.equippedItem ?? null,
      dayNightElapsedMs: context.dayNight?.getElapsedMs?.() ?? 0,
      elapsedMs: context.scheduler?.elapsedMs ?? 0,
      savedAt: Date.now(),
      weather: context.weather?.serializeState?.() ?? null,
    },
    camera: cameraData(context.controls.camera),
    world,
    config: definedProperties({
      seed: context.map.seed,
      size: sourceSize ?? context.map.size,
      mapType: context.map.mapType || DEFAULT_SERIALIZED_MAP_TYPE,
      environment: context.map.environment,
      instantMode: context.map.instantMode,
      heroOnlyStart: context.map.heroOnlyStart,
      revealEverything: context.map.revealEverything,
      revealTerrain: context.map.revealTerrain,
      startingResources: context.map.startingResources,
      resourceDensity: context.map.resourceDensity,
      difficulty: context.map.difficulty,
      worldId: context.map.worldId ?? undefined,
      worldRegionId: context.map.worldRegionId ?? undefined,
      ...(context.map.localGridLayout ? { localGridLayout: { ...context.map.localGridLayout } } : {}),
    }),
    players: groupPlayersInteriorBuildings((context.players ?? []).map(player => playerData(player))),
    ...(delta ? { resourceDelta: delta.resourceDelta } : {}),
    resources: delta
      ? delta.resources
      : includeWorldEntities
        ? context.map.resources instanceof CompactResourceSet
          ? context.map.resources.saveValues(resource => resourceData(resource as SerializableEntity))
          : Array.from(resourceReadValues(context.map.resources), resource =>
              resourceData(resource as SerializableEntity)
            )
        : [],
    naturalResourceRespawnSlots: includeWorldEntities
      ? (context.map.naturalResourceRespawnSlots ?? []).map(slot => ({ ...slot }))
      : [],
    animals: includeWorldEntities ? savedAnimals(context) : [],
  }

  return data
}
