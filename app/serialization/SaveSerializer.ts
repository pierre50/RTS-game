import { filterObject } from '../lib'
import type { GameContextLike } from '../types/context'
import type { RuntimeCell } from '../types/map'
import type { PlayerLike, VisionGridLike } from '../types/player'
import type { RuntimeEntityBase } from '../types/entities'
import type { UnknownRecord } from '../types/common'

type GridPoint = { i: number; j: number }
type Destination = Partial<GridPoint & { x: number; y: number; label: string }>
type SpriteState = { currentFrame?: number; loop?: boolean }
type SerializableEntity = RuntimeEntityBase &
  {
    action?: string | null
    assetAge?: unknown
    assetCiv?: unknown
    assetType?: unknown
    blockedGatherApproach?: { target: { label?: string; i: number; j: number }; action: string } | null
    buildQueue?: { label?: string }[] | null
    currentSheet?: unknown
    degree?: number
    dest?: Destination | null
    direction?: number
    inactif?: boolean
    isBuilt?: boolean
    isUsedBy?: { label?: string } | null
    loadedInTransport?: { label?: string } | null
    loading?: unknown
    loadingType?: unknown
    loop?: boolean
    path?: GridPoint[]
    previousDest?: Destination | null
    previousWork?: string | null
    queue?: unknown[]
    rallyPoint?: unknown
    realDest?: Destination | null
    isFleeing?: boolean
    sprite?: SpriteState | null
    technology?: unknown
    textureName?: string
    work?: string | null
  }
type SerializablePlayer = PlayerLike & {
    aiState?: unknown
    difficulty?: string
    enemyBuildingMemory?: Map<unknown, ThreatMemory>
    enemyUnitMemory?: Map<unknown, ThreatMemory>
    getNow?: () => number
    hasBuilt?: unknown
    lastAttackWaveAt?: number
    phase?: string
    population?: number
    population_max?: number
    threatenedTargets?: Map<unknown, ThreatTargetMemory>
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
type SerializableCell = RuntimeCell & {
  fogSprites: { textureSheet: string; colorName?: string }[]
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

function resourceData(resource: SerializableEntity) {
  return {
    ...filterObject(resource, ['label', 'i', 'j', 'type', 'isDead', 'quantity', 'isDestroyed', 'size', 'hitPoints']),
    textureName: (resource.textureName || '').split('.')[0],
  }
}

function animalData(animal: SerializableEntity) {
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
    dest: animal.dest && [animal.dest.i, animal.dest.j, animal.dest?.label],
    previousDest: animal.previousDest && [animal.previousDest.i, animal.previousDest.j, animal.previousDest?.label],
    path: pathData(animal.path),
    realDest: destinationData(animal.realDest),
  }
}

function unitData(unit: SerializableEntity) {
  return {
    ...filterObject(unit, [
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
      'assetCiv',
      'assetAge',
    ]),
    loadedInTransport: unit.loadedInTransport?.label,
    currentFrame: unit.sprite?.currentFrame,
    loop: unit.sprite?.loop,
    dest: unit.dest && [unit.dest.i, unit.dest.j, unit.dest?.label],
    previousDest: unit.previousDest && [unit.previousDest.i, unit.previousDest.j, unit.previousDest?.label],
    path: pathData(unit.path),
    realDest: destinationData(unit.realDest),
    buildQueue: unit.buildQueue?.length ? unit.buildQueue.map(target => target.label) : undefined,
    blockedGatherApproach: unit.blockedGatherApproach && {
      target: [unit.blockedGatherApproach.target.i, unit.blockedGatherApproach.target.j, unit.blockedGatherApproach.target.label],
      action: unit.blockedGatherApproach.action,
    },
  }
}

function buildingData(building: SerializableEntity) {
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
  const data: UnknownRecord = {
    ...filterObject(player, [
      'label',
      'age',
      'type',
      'wood',
      'food',
      'stone',
      'gold',
      'civ',
      'color',
      'difficulty',
      'team',
      'population',
      'population_max',
      'technologies',
      'cellViewed',
      'isPlayed',
      'hasBuilt',
    ]),
    buildings: player.buildings.map(buildingData),
    units: player.units.map(unitData),
    corpses: player.corpses.map(unitData),
    views: player.views.toJSON(),
    selectedUnitLabels: player.selectedUnits?.length ? player.selectedUnits.map(unit => unit.label) : undefined,
    selectedUnitLabel: player.selectedUnit?.label,
    selectedBuildingLabel: player.selectedBuilding?.label,
    selectedOtherLabel: player.selectedOther?.label,
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

function cellData(cell: SerializableCell) {
  const data: UnknownRecord = { type: cell.type }
  if (cell.z !== 0) data.z = cell.z
  if (cell.viewed) data.viewed = true
  if (cell.inclined) data.inclined = true
  if (cell.border) data.border = true
  if (cell.waterBorder) data.waterBorder = true
  if (cell.has) data.has = cell.has.label
  if (cell.fogSprites.length > 0) {
    const seenFogSprites = new Set()
    data.fogSprites = cell.fogSprites
      .map(({ textureSheet, colorName }) => ({
        textureSheet,
        colorName,
      }))
      .filter(spriteData => {
        const key = `${spriteData.textureSheet}|${spriteData.colorName || ''}`
        if (seenFogSprites.has(key)) return false
        seenFogSprites.add(key)
        return true
      })
  }
  return data
}

export function serializeGame(context: SerializableContext) {
  const world = {
    seed: context.map.seed,
    size: context.map.size,
    mapType: context.map.mapType || 'plain',
    positionsCount: context.map.positionsCount,
    pregeneratedBlueprintId: context.map.pregeneratedBlueprintId ?? null,
  }
  const data: UnknownRecord = {
    version: 2,
    runtime: {
      elapsedMs: context.scheduler?.elapsedMs ?? 0,
    },
    camera: cameraData(context.controls.camera),
    world,
    config: {
      seed: context.map.seed,
      size: context.map.size,
      mapType: context.map.mapType || 'plain',
      instantMode: context.map.instantMode,
      allTechnologies: context.map.allTechnologies,
      startingAge: context.map.startingAge,
      revealEverything: context.map.revealEverything,
      revealTerrain: context.map.revealTerrain,
      startingResources: context.map.startingResources,
      resourceDensity: context.map.resourceDensity,
      difficulty: context.map.difficulty,
    },
    players: (context.players ?? []).map(playerData),
    resources: [...context.map.resources].map(resource => resourceData(resource as SerializableEntity)),
    animals: (context.map.gaia?.units ?? [])
      .filter(animal => !animal.isDestroyed)
      .map(animal => animalData(animal as SerializableEntity)),
  }

  return data
}
