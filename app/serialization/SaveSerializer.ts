import { serializeCampRespawnStates } from '../lib/camps/CampRespawnState'
import { flushVillageSimulation } from '../lib/units/villageActivity'
import type { VillageHome } from '../lib/units/villageActivity'
import type { CampBehavior } from '../types/camp'
import { flushNaturalGrowth } from '../services/NaturalGrowthQueue'
import { getWildlifeStore } from '../services/WildlifeStore'
import type { AnimalEntity } from '../types/entities'
import { resourceData } from './ResourceSaveData'
import { CompactResourceSet, resourceReadValues } from '../classes/resources/CompactResourceSet'
import { exportTargetKnowledge } from '../lib/units/playerTargetKnowledge'
import type { CaveDefinition } from '../types/cave'
import { definedProperties } from '../lib/definedProperties'
import { serializeTrainingExtra, serializeTrainingQueue } from './TrainingSave'
import { groupPlayersInteriorBuildings, interiorSaveSpaceId, isDerivedInteriorHorse } from './InteriorBuildingSave'
import type { TrainingEntry } from '../types/training'
import type { UnitCreationExtra, UnitEntity } from '../types/entities'
import { filterObject, getCellMapPoint, getEntityMapSpace, getGaiaAnimals } from '../lib'
import { summarizeVillagerAssignments } from '../lib/units/villagerAssignments'
import type { ResourceAmount } from '../types/common'
import type { GameContextLike } from '../types/context'
import type { PlayerLike, VisionGridLike } from '../types/player'
import type { AssetAge } from '../types/pixi'
import type { RuntimeEntityBase, UnitControlMode } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { SavedAIState, SaveEntityState, SavePlayerState, SaveReference, SerializedSave } from '../types/save'

type GridPoint = { i: number; j: number }
const DEFAULT_SERIALIZED_MAP_TYPE = 'world-region'
const SERIALIZED_RESOURCE_NAMES = ['wood', 'food', 'berry', 'meat', 'wheat', 'stone', 'gold', 'copper', 'iron'] as const
type Destination = Partial<GridPoint & { x: number; y: number; label: string }>
type SpriteState = { currentFrame?: number; loop?: boolean }
type SerializableEntity = RuntimeEntityBase & {
  wildlife?: SaveEntityState['wildlife']
  dailySchedule?: UnitEntity['dailySchedule']
  offlineBuilderJob?: SaveEntityState['offlineBuilderJob']
  resourceDeliveryState?: UnitEntity['resourceDeliveryState']
  cave?: CaveDefinition
  placementMirrored?: boolean
  buildingAge?: number
  interiorBuildings?: SaveEntityState[]
  interiorPortalId?: string
  trainingTargetType?: string | null
  trainingQueue?: TrainingEntry[]
  buildingProduction?: { activeTrainingExtra?: UnitCreationExtra }
  offlineWork?: SaveEntityState['offlineWork']
  shelterState?: { previousWork?: string | null; previousAutonomousJob?: SaveEntityState['autonomousJob'] } | null
  action?: string | null
  assetAge?: AssetAge
  assetCiv?: string
  assetType?: string
  blockedGatherApproach?: { target: { label?: string; i: number; j: number }; action: string } | null
  buildQueue?: { label?: string }[] | null
  controlMode?: UnitControlMode
  currentSheet?: string
  degree?: number
  dest?: Destination | null
  direction?: number
  experience?: Record<string, number>
  gender?: SaveEntityState['gender']
  appearanceVariants?: SaveEntityState['appearanceVariants']
  energy?: number
  totalEnergy?: number
  lastEnergySpentAt?: number
  horseColor?: string
  corpseMaterialDecayRemainingMs?: number
  trapPrey?: boolean
  tamingStatus?: SaveEntityState['tamingStatus']
  companionHorseColor?: string | null
  villageHome?: VillageHome
  campBehavior?: CampBehavior
  campPatrolAnchor?: GridPoint | null
  banditCampAnchor?: GridPoint | null
  containedAnimalType?: string | null
  horseAmount?: number
  stableHorses?: Array<{ horseColor?: string }>
  inventory?: {
    resources?: ResourceAmount
    equipment?: string[]
    equipped?: NonNullable<SaveEntityState['inventory']>['equipped']
    equippedCounts?: NonNullable<SaveEntityState['inventory']>['equippedCounts']
    activeWeapons?: NonNullable<SaveEntityState['inventory']>['activeWeapons']
  }
  marketStock?: string[]
  indestructible?: boolean
  followingHero?: boolean
  pendingRescueThanks?: boolean
  inactif?: boolean
  villagerDeliveriesBlocked?: boolean
  isBuilt?: boolean
  isUsedBy?: string | { label?: string } | null
  loading?: number | null
  trainingStartedDay?: number | null
  trainingCompleteDay?: number | null
  loop?: boolean
  mountedOnHorse?: boolean
  path?: GridPoint[]
  previousDest?: Destination | null
  previousWork?: string | null
  autonomousJob?: SaveEntityState['autonomousJob']
  exploringForAutonomy?: boolean
  berrybushFullTextureName?: string
  queue?: string[]
  realDest?: Destination | null
  isFleeing?: boolean
  isChief?: boolean
  lootEquipment?: string[]
  getVisualSprite?: () => SpriteState | undefined
  currentFrame?: number
  sprite?: SpriteState | null
  textureName?: string
  work?: string | null
}
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
type InteriorSerializableSpace = {
  building?: SerializableEntity | null
  exteriorEntryCell?: RuntimeCell | null
}

function cameraData(camera?: { x?: number; y?: number } | null) {
  return {
    x: camera?.x ?? 0,
    y: camera?.y ?? 0,
  }
}

function pathData(path: GridPoint[] = []) {
  return path.map(({ i, j }) => ({ i, j }))
}

function destinationData(dest?: Destination | null) {
  if (!dest) return dest
  return {
    i: dest.i,
    j: dest.j,
    x: dest.x,
    y: dest.y,
    label: dest.label,
  }
}

function referenceData(dest?: Destination | null): SaveReference | null | undefined {
  if (!dest) return dest
  return [dest.i ?? 0, dest.j ?? 0, dest.label]
}

function getInteriorWorldSaveCell(entity: SerializableEntity): RuntimeCell | null {
  if (!entity.spaceId) return null
  const map = entity.context?.map
  const space = getEntityMapSpace(entity)
  if (!map || space?.kind !== 'interior') return null
  const interiorSpace = space as InteriorSerializableSpace
  if (interiorSpace.exteriorEntryCell) return interiorSpace.exteriorEntryCell
  const building = interiorSpace.building
  return building ? (map.grid[building.i]?.[building.j] ?? null) : null
}

function projectInteriorEntityToWorld(entity: SerializableEntity, data: SaveEntityState): SaveEntityState {
  const cell = getInteriorWorldSaveCell(entity)
  if (!cell) return data
  const space = getEntityMapSpace(entity) as InteriorSerializableSpace | null
  const caveId = (space?.building as { cave?: { id: string } } | undefined)?.cave?.id
  if (caveId) {
    data.cavePosition = { caveId, i: entity.i, j: entity.j }
    data.caveOrders = {
      action: data.action,
      dest: data.dest,
      previousDest: data.previousDest,
      path: data.path,
      realDest: data.realDest,
    }
  }
  const point = getCellMapPoint(cell, entity.context?.map)
  data.i = cell.i
  data.j = cell.j
  data.x = point.x
  data.y = point.y
  data.z = cell.z
  data.action = null
  data.dest = null
  data.path = []
  data.realDest = null
  delete data.currentFrame
  delete data.currentSheet
  delete data.loop
  return data
}

function animalData(animal: SerializableEntity): SaveEntityState {
  if (animal.isDestroyed) {
    return {
      ...filterObject(animal, ['label', 'type', 'i', 'j', 'horseColor', 'totalHitPoints', 'totalQuantity']),
      isDead: true,
      isDestroyed: true,
      hitPoints: 0,
      quantity: 0,
    } as SaveEntityState
  }
  const data = filterObject(animal, [
    'label',
    'name',
    'type',
    'i',
    'j',
    'x',
    'y',
    'z',
    'hitPoints',
    'totalHitPoints',
    'energy',
    'totalEnergy',
    'lastEnergySpentAt',
    'horseColor',
    'trapPrey',
    'tamingStatus',
    'path',
    'work',
    'realDest',
    'zIndex',
    'degree',
    'action',
    'direction',
    'currentSheet',
    'size',
    'inactif',
    'isDead',
    'isDestroyed',
    'quantity',
    'totalQuantity',
    'isFleeing',
    'wildlife',
    'corpseMaterialDecayRemainingMs',
    'inventory',
  ]) as Partial<SaveEntityState>
  return {
    ...data,
    currentFrame:
      (animal.getVisualSprite ? animal.getVisualSprite() : animal.sprite)?.currentFrame ?? animal.currentFrame,
    loop: (animal.getVisualSprite ? animal.getVisualSprite() : animal.sprite)?.loop ?? animal.loop,
    dest: referenceData(animal.dest),
    previousDest: referenceData(animal.previousDest),
    path: pathData(animal.path),
    realDest: destinationData(animal.realDest),
  } as SaveEntityState
}

export function serializeWildAnimal(animal: AnimalEntity): SaveEntityState {
  return structuredClone(animalData(animal as SerializableEntity))
}
function savedAnimals(context: GameContextLike): SaveEntityState[] {
  const records = new Map<string, SaveEntityState>()
  for (const [label, entry] of getWildlifeStore(context.map)?.entries ?? [])
    records.set(label, structuredClone(entry.state))
  for (const animal of getGaiaAnimals(context.map.gaia)) {
    if (isDerivedInteriorHorse(animal, context.players)) continue
    const state = animalData(animal as SerializableEntity)
    const existing = records.get(state.label!)
    if (existing?.wildlife)
      state.wildlife = {
        ...existing.wildlife,
        lastCorpseMs: context.dayNight?.getElapsedMs?.() ?? context.scheduler?.elapsedMs ?? 0,
      }
    if (!animal.isDestroyed || existing || (animal.isDead && !('trapPrey' in animal && animal.trapPrey)))
      records.set(state.label ?? `unlabelled:${records.size}`, state)
  }
  return [...records.values()]
}

function unitData(unit: SerializableEntity): SaveEntityState {
  return projectInteriorEntityToWorld(unit, {
    factionExpedition: structuredClone(
      (unit as SerializableEntity & { factionExpedition?: SaveEntityState['factionExpedition'] }).factionExpedition
    ),
    resourceDelivery: unit.resourceDeliveryState
      ? {
          building: referenceData(unit.resourceDeliveryState.building),
          returnTask: unit.resourceDeliveryState.returnTask
            ? {
                action: unit.resourceDeliveryState.returnTask.action,
                autonomousJob: unit.resourceDeliveryState.returnTask.autonomousJob,
                work: unit.resourceDeliveryState.returnTask.work,
                dest: referenceData(unit.resourceDeliveryState.returnTask.dest),
              }
            : null,
        }
      : undefined,
    ...filterObject(unit, [
      'label',
      'name',
      'type',
      'i',
      'j',
      'x',
      'y',
      'z',
      'hitPoints',
      'totalHitPoints',
      'energy',
      'totalEnergy',
      'lastEnergySpentAt',
      'dailySchedule',
      'path',
      'work',
      'previousWork',
      'autonomousJob',
      'offlineBuilderJob',
      'exploringForAutonomy',
      'realDest',
      'degree',
      'action',
      'direction',
      'currentSheet',
      'controlMode',
      'size',
      'inactif',
      'isDead',
      'isDestroyed',
      'isChief',
      'inventory',
      'lootEquipment',
      'followingHero',
      'pendingRescueThanks',
      'assetCiv',
      'assetAge',
      'assetType',
      'mountedOnHorse',
      'horseColor',
      'companionHorseColor',
      'villageHome',
      'campBehavior',
      'campPatrolAnchor',
      'banditCampAnchor',
      'experience',
      'offlineWork',
      'trainingTargetType',
      'gender',
      'appearanceVariants',
    ]),
    work: unit.shelterState?.previousWork ?? unit.work,
    autonomousJob: unit.shelterState?.previousAutonomousJob ?? unit.autonomousJob,
    currentFrame: unit.sprite?.currentFrame,
    loop: unit.sprite?.loop,
    dest: referenceData(unit.dest),
    previousDest: referenceData(unit.previousDest),
    path: pathData(unit.path),
    realDest: destinationData(unit.realDest),
    buildQueue: unit.buildQueue?.length
      ? unit.buildQueue.map(target => target.label).filter((label): label is string => typeof label === 'string')
      : undefined,
    blockedGatherApproach: unit.blockedGatherApproach && {
      target: [
        unit.blockedGatherApproach.target.i,
        unit.blockedGatherApproach.target.j,
        unit.blockedGatherApproach.target.label,
      ],
      action: unit.blockedGatherApproach.action,
    },
  })
}

function buildingData(building: SerializableEntity): SaveEntityState {
  return definedProperties({
    ...filterObject(building, [
      'label',
      'i',
      'j',
      'type',
      'spaceId',
      'interiorBuildings',
      'interiorPortalId',
      'cave',
      'queue',
      'loading',
      'trainingStartedDay',
      'trainingCompleteDay',
      'isDead',
      'isDestroyed',
      'isBuilt',
      'villagerDeliveriesBlocked',
      'hitPoints',
      'quantity',
      'assetCiv',
      'assetAge',
      'buildingAge',
      'placementMirrored',
      'totalHitPoints',
      'assetType',
      'horseAmount',
      'stableHorses',
      'containedAnimalType',
      'inventory',
      'marketStock',
      'indestructible',
    ] as const),
    inventory: building.inventory ? definedProperties(building.inventory) : undefined,
    trainingQueue: serializeTrainingQueue(building.trainingQueue),
    trainingExtra: serializeTrainingExtra(building.buildingProduction?.activeTrainingExtra),
    isUsedBy: typeof building.isUsedBy === 'string' ? building.isUsedBy : building.isUsedBy?.label,
  })
}

function playerData(player: SerializablePlayer) {
  const data: SavePlayerState = definedProperties({
    targetKnowledge: exportTargetKnowledge(player),
    ...filterObject(player, [
      'label',
      'age',
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
      'offlineBuildingPlanDay',
      'abstractProductionRemainder',
      'offlineBuildingDecision',
      'completedObjectives',
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
    ageRulesVersion: 1,
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
      startingAge: context.map.startingAge,
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
