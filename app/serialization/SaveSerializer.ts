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
import type {
  SavedAIState,
  SaveEntityState,
  SavePlayerState,
  SaveRallyPoint,
  SaveReference,
  SerializedSave,
} from '../types/save'

type GridPoint = { i: number; j: number }
const DEFAULT_SERIALIZED_MAP_TYPE = 'world-region'
const SERIALIZED_RESOURCE_NAMES = ['wood', 'food', 'berry', 'meat', 'wheat', 'stone', 'gold', 'copper', 'iron'] as const
type Destination = Partial<GridPoint & { x: number; y: number; label: string }>
type SpriteState = { currentFrame?: number; loop?: boolean }
type SerializableEntity = RuntimeEntityBase & {
  resourceDeliveryState?: UnitEntity['resourceDeliveryState']
  cave?: CaveDefinition
  buildingAge?: number
  interiorBuildings?: SaveEntityState[]
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
  healthRegenRate?: number
  healthRegenDelay?: number
  healthRegenMultiplier?: number
  lastHealthDamagedAt?: number
  horseColor?: string
  trapPrey?: boolean
  tamingStatus?: SaveEntityState['tamingStatus']
  companionHorseColor?: string | null
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
  inactif?: boolean
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
  rallyPoint?: SaveRallyPoint | null
  realDest?: Destination | null
  isFleeing?: boolean
  isChief?: boolean
  lootEquipment?: string[]
  sprite?: SpriteState | null
  textureName?: string
  work?: string | null
}
type SerializablePlayer = PlayerLike & {
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

function resourceData(resource: SerializableEntity): SaveEntityState {
  const data: SaveEntityState = {
    ...filterObject(resource, [
      'label',
      'i',
      'j',
      'type',
      'isDead',
      'quantity',
      'totalQuantity',
      'isDestroyed',
      'isNaturalResource',
      'size',
      'hitPoints',
    ]),
    textureName: (resource.textureName || '').split('.')[0] ?? '',
  }
  if (!('deferredSpriteBounds' in resource && resource.deferredSpriteBounds) && resource.sprite?.currentFrame != null)
    data.currentFrame = resource.sprite.currentFrame
  if (resource.berrybushFullTextureName != null) data.berrybushFullTextureName = resource.berrybushFullTextureName
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
    'healthRegenRate',
    'healthRegenDelay',
    'healthRegenMultiplier',
    'lastHealthDamagedAt',
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
  ]) as Partial<SaveEntityState>
  return {
    ...data,
    currentFrame: animal.sprite?.currentFrame,
    loop: animal.sprite?.loop,
    dest: referenceData(animal.dest),
    previousDest: referenceData(animal.previousDest),
    path: pathData(animal.path),
    realDest: destinationData(animal.realDest),
  } as SaveEntityState
}

function unitData(unit: SerializableEntity): SaveEntityState {
  return projectInteriorEntityToWorld(unit, {
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
      'healthRegenRate',
      'healthRegenDelay',
      'healthRegenMultiplier',
      'lastHealthDamagedAt',
      'energy',
      'totalEnergy',
      'lastEnergySpentAt',
      'path',
      'work',
      'previousWork',
      'autonomousJob',
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
      'assetCiv',
      'assetAge',
      'assetType',
      'mountedOnHorse',
      'horseColor',
      'companionHorseColor',
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
      'cave',
      'queue',
      'loading',
      'trainingStartedDay',
      'trainingCompleteDay',
      'isDead',
      'isDestroyed',
      'isBuilt',
      'hitPoints',
      'quantity',
      'rallyPoint',
      'assetCiv',
      'assetAge',
      'buildingAge',
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
      heroEquippedItem: context.controls.equippedItem ?? null,
      worldPursuers: context.worldPursuit?.serializeState(),
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
    resources: [...context.map.resources].map(resource => resourceData(resource as SerializableEntity)),
    naturalResourceRespawnSlots: (context.map.naturalResourceRespawnSlots ?? []).map(slot => ({ ...slot })),
    animals: getGaiaAnimals(context.map.gaia)
      .filter(animal => !isDerivedInteriorHorse(animal, context.players))
      .filter(animal => !animal.isDestroyed || (animal.isDead && !('trapPrey' in animal && animal.trapPrey)))
      .map(animal => animalData(animal as SerializableEntity)),
  }

  return data
}
