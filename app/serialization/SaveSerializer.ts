import { filterObject, getGaiaAnimals } from '../lib'
import type { GameContextLike } from '../types/context'
import type { PlayerLike, VisionGridLike } from '../types/player'
import type { AssetAge } from '../types/pixi'
import type { RuntimeEntityBase } from '../types/entities'
import type {
  SavedAIState,
  SaveEntityState,
  SavePlayerState,
  SaveRallyPoint,
  SaveReference,
  SaveTechnologyState,
  SerializedSave,
} from '../types/save'

type GridPoint = { i: number; j: number }
const DEFAULT_SERIALIZED_MAP_TYPE = 'continent'
type Destination = Partial<GridPoint & { x: number; y: number; label: string }>
type SpriteState = { currentFrame?: number; loop?: boolean }
type SerializableEntity = RuntimeEntityBase & {
  action?: string | null
  assetAge?: AssetAge
  assetCiv?: string
  assetType?: string
  blockedGatherApproach?: { target: { label?: string; i: number; j: number }; action: string } | null
  buildQueue?: { label?: string }[] | null
  currentSheet?: string
  degree?: number
  dest?: Destination | null
  direction?: number
  experience?: Record<string, number>
  energy?: number
  totalEnergy?: number
  lastEnergySpentAt?: number
  healthRegenRate?: number
  healthRegenDelay?: number
  healthRegenMultiplier?: number
  lastHealthDamagedAt?: number
  followingHero?: boolean
  inactif?: boolean
  isBuilt?: boolean
  isUsedBy?: { label?: string } | null
  loading?: number | null
  loadingType?: string | null
  loop?: boolean
  mountedOnHorse?: boolean
  path?: GridPoint[]
  previousDest?: Destination | null
  previousWork?: string | null
  queue?: string[]
  rallyPoint?: SaveRallyPoint | null
  realDest?: Destination | null
  isFleeing?: boolean
  isChief?: boolean
  sprite?: SpriteState | null
  technology?: SaveTechnologyState
  textureName?: string
  work?: string | null
}
type SerializablePlayer = PlayerLike & {
  aiState?: SavedAIState
  enemyBuildingMemory?: Map<string, ThreatMemory>
  enemyUnitMemory?: Map<string, ThreatMemory>
  getNow?: () => number
  hasBuilt?: string[]
  lastAttackWaveAt?: number
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

function resourceData(resource: SerializableEntity): SaveEntityState {
  return {
    ...filterObject(resource, ['label', 'i', 'j', 'type', 'isDead', 'quantity', 'isDestroyed', 'size', 'hitPoints']),
    textureName: (resource.textureName || '').split('.')[0],
  }
}

function animalData(animal: SerializableEntity): SaveEntityState {
  return {
    ...filterObject(animal, [
      'label',
      'type',
      'i',
      'j',
      'x',
      'y',
      'z',
      'hitPoints',
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
      'isFleeing',
    ]),
    currentFrame: animal.sprite?.currentFrame,
    loop: animal.sprite?.loop,
    dest: referenceData(animal.dest),
    previousDest: referenceData(animal.previousDest),
    path: pathData(animal.path),
    realDest: destinationData(animal.realDest),
  }
}

function unitData(unit: SerializableEntity): SaveEntityState {
  return {
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
      'realDest',
      'degree',
      'action',
      'loading',
      'loadingType',
      'direction',
      'currentSheet',
      'size',
      'inactif',
      'isDead',
      'isDestroyed',
      'isChief',
      'followingHero',
      'assetCiv',
      'assetAge',
      'mountedOnHorse',
      'experience',
    ]),
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
  }
}

function buildingData(building: SerializableEntity): SaveEntityState {
  return {
    ...filterObject(building, [
      'label',
      'i',
      'j',
      'type',
      'queue',
      'technology',
      'loading',
      'isDead',
      'isDestroyed',
      'isBuilt',
      'hitPoints',
      'quantity',
      'rallyPoint',
      'assetCiv',
      'assetAge',
      'assetType',
    ]),
    isUsedBy: building.isUsedBy?.label,
  }
}

function playerData(player: SerializablePlayer) {
  const data: SavePlayerState = {
    ...filterObject(player, [
      'label',
      'age',
      'type',
      'wood',
      'food',
      'stone',
      'gold',
      'civ',
      'gender',
      'name',
      'color',
      'team',
      'population',
      'populationMax',
      'technologies',
      'researchTechnology',
      'researchLoading',
      'cellViewed',
      'isPlayed',
      'hasBuilt',
    ]),
    buildings: player.buildings.map(buildingData),
    units: player.units.map(unitData),
    corpses: player.corpses.map(unitData),
    views: player.views.toJSON(),
    selectedUnitLabels: !player.isPlayed
      ? player.selectedUnits?.length
        ? player.selectedUnits.map(unit => unit.label)
        : undefined
      : undefined,
    selectedUnitLabel: !player.isPlayed ? player.selectedUnit?.label : undefined,
    selectedBuildingLabel: !player.isPlayed ? player.selectedBuilding?.label : undefined,
    selectedOtherLabel: !player.isPlayed ? player.selectedOther?.label : undefined,
  }

  if (player.type === 'AI') {
    const savedAt = player.getNow?.() ?? 0
    const serializeMemory = (memory: ThreatMemory) => ({
      instance: memory.instance?.label || memory.label || null,
      lastSeenAgo: Math.max(0, savedAt - (memory.lastSeenAt ?? savedAt)),
    })

    data.aiState = {
      phase: player.phase,
      savedAt,
      lastAttackWaveAgo:
        typeof player.lastAttackWaveAt === 'number' && Number.isFinite(player.lastAttackWaveAt)
          ? Math.max(0, savedAt - player.lastAttackWaveAt)
          : null,
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
  const world = {
    seed: context.map.seed,
    size: context.map.size,
    mapType: DEFAULT_SERIALIZED_MAP_TYPE,
    positionsCount: context.map.positionsCount,
    pregeneratedBlueprintId: context.map.pregeneratedBlueprintId ?? null,
  }
  const data: SerializedSave = {
    version: 2,
    runtime: {
      elapsedMs: context.scheduler?.elapsedMs ?? 0,
    },
    camera: cameraData(context.controls.camera),
    world,
    config: {
      seed: context.map.seed,
      size: context.map.size,
      mapType: DEFAULT_SERIALIZED_MAP_TYPE,
      instantMode: context.map.instantMode,
      allTechnologies: context.map.allTechnologies,
      humanStartsWithoutBase: context.map.humanStartsWithoutBase,
      startingAge: context.map.startingAge,
      revealEverything: context.map.revealEverything,
      revealTerrain: context.map.revealTerrain,
      startingResources: context.map.startingResources,
      resourceDensity: context.map.resourceDensity,
      difficulty: context.map.difficulty,
    },
    players: (context.players ?? []).map(player => playerData(player)),
    resources: [...context.map.resources].map(resource => resourceData(resource as SerializableEntity)),
    animals: getGaiaAnimals(context.map.gaia)
      .filter(animal => !animal.isDestroyed)
      .map(animal => animalData(animal as SerializableEntity)),
  }

  return data
}
