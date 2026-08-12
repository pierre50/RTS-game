import { Assets, Sprite, type ContainerChild } from 'pixi.js'
import { Resource } from '../Resource'
import { Human, AI, Gaia } from '../players'
import {
  colors,
  getZoneInGridWithCondition,
  updateInstanceVisibility,
  getGaiaAnimals,
  getTextureByFrame,
  getPositionInGridAroundInstance,
  canPlaceBuildingAt,
  hasWaterBorderWithin,
  getBuildingFootprintRadius,
  getPlainCellsAroundPoint,
} from '../../lib'
import { rehydrateAIKnowledge } from '../../services/FogOfWar'
import { MAX_BUILDING_BY_AGE, MAX_INFANTRY_BY_AGE, MAX_ARCHER_BY_AGE } from '../../ai/config'
import { getBestUnitFromTechs, ARCHER_TECH_UPGRADES } from '../../ai/unitGroups'
import { CIVILIZATION_LEVEL_RESOURCE_BONUS } from '../../config/resourcePresets'
import { getIdealSpawnRangeForMapSize } from '../../config/mapSizes'
import {
  BUILDING_TYPES,
  FAMILY_TYPES,
  LABEL_TYPES,
  PLAYER_TYPES,
  POPULATION_MAX,
  UNIT_TYPES,
  FLOOR_SETS_GRASS,
  FLOOR_SETS_DESERT,
  FLOOR_SETS_JUNGLE,
  FLOOR_SET_CHANCE,
  GROUND_SETS,
  WATER_SETS,
  WATER_SETS_DEEP,
  WATER_SET_CHANCE,
  WATER_SET_DEEP_LAND_MIN_DIST,
  ANIMAL_PLAYER_SAFE_DIST,
  AMBIENT_ANIMAL_CHANCE,
  WATER_BORDER_PLACEMENT_CLEARANCE,
  getEnvironmentTerrainParams,
} from '../../constants'
import type { EnvironmentTerrainParams } from '../../constants'
import { Cell, GenerationCell } from '../cell'
import { MapBlueprintGeneration } from './MapBlueprintGeneration'
import type { GridPosition } from '../../types/grid'
import type { RuntimeCell, RuntimeMap } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import type { PlayerOptions } from '../players/Player'
import type { ResourceOptions } from '../Resource'
import type { AnimalOptions } from '../animal'
import type { RuntimeEntity, ResourceEntity, BuildingEntity } from '../../types/entities'
import type { GameContextLike } from '../../types/context'
import type { MapEditorControlsLike } from '../../types/mapEditor'
import type { AnimalConfig } from '../../types/config'
import type { TextureRef } from '../../lib'
import {
  processUnit,
  restoreAIState,
  restoreBuildingAssignments,
  restorePlayerEntitiesFromSave,
  restorePlayerViewsAndFog,
  restoreSelection,
  type SavedPlayer,
} from './MapSaveRestore'
import type { SaveCellState, SaveEntityState, SerializedSave } from '../../types/save'

type TerrainValue = 0 | 1 | 2 | 3 | 4 | 5
type BlueprintTerrainValue = TerrainValue | string
export type TerrainGrid = TerrainValue[][]
type GeneratedPosition = GridPosition | null

// Unowned, indestructible landmark: exactly one is placed per map, never tied to any player.
const PORTAL_RESOURCE_TYPE = 'Portal'
const PORTAL_FOOTPRINT_SIZE = 3
const STARTING_CIVILIAN_GENDERS: Array<'male' | 'female'> = ['male', 'male', 'female', 'female']

// Outline (not filled) cells of a diamond at exactly `radius` tiles from the origin - used to lay a
// one-tile-wide wall perimeter around a Town Center without a full path-finding/drafting system.
function getDiamondRingOffsets(radius: number): Array<[number, number]> {
  const offsets: Array<[number, number]> = []
  for (let di = -radius; di <= radius; di++) {
    const djAbs = radius - Math.abs(di)
    if (djAbs === 0) {
      offsets.push([di, 0])
    } else {
      offsets.push([di, djAbs], [di, -djAbs])
    }
  }
  return offsets
}
export type MapGenerationContext = Omit<
  Partial<GameContextLike>,
  'controls' | 'map' | 'menu' | 'performance' | 'player' | 'players' | 'scheduler'
> & {
  controls?: GameContextLike['controls'] | MapEditorControlsLike | null
  map?: GameContextLike['map'] | null
  menu?: GameContextLike['menu'] | null
  performance?: GameContextLike['performance'] | null
  player?: PlayerLike | null
  players: PlayerLike[]
  scheduler?: GameContextLike['scheduler'] | null
}
// Mirrors the subset of the concrete `Map` class (app/classes/map/index.ts) API
// that MapGeneration relies on. Map can't be imported directly here: it imports
// MapGeneration itself, so importing it back would create a circular dependency.
export type MapGenerationMap = RuntimeMap & {
  context: MapGenerationContext
  playersPos: GeneratedPosition[]
  positionsCount: number
  noAI?: boolean
  humanStartsWithoutBase?: boolean
  startingUnits: number
  generationTimings?: Record<string, number>
  difficulty: string
  chanceOfSets: number
  allTechnologies: boolean
  startingAge: number
  instanceBuckets: Array<Array<Set<RuntimeEntity>>> | null
  pregeneratedBlueprintId?: string | null
  pregeneratedResourcesLoaded?: boolean
  blueprintDestroyMs?: number
  blueprintCellCreationMs?: number
  blueprintFillWaterGapsMs?: number
  blueprintNormalizeWaterMs?: number
  blueprintInitialWaterBorderMs?: number
  blueprintWaterBorderReady?: boolean
  blueprintResourceLoadMs?: number
  _fogInitComplete?: boolean
  terrainChunkManager?: { destroy(): void }
  mapFog?: { destroyFogResources(): void }
  children: GeneratedMapChild[]
  removeChildren(): GeneratedMapChild[]
  getChildByLabel(label: string): ContainerChild | null
  clearRenderChunks(): void
  resetRandom(stream?: number | string): void
  findPlayerPlaces(): GeneratedPosition[]
  generateCells(): void
  generateTerrain(gridSize?: number, seed?: number, params?: Partial<EnvironmentTerrainParams>): TerrainGrid
  fillWaterGaps(level?: number | null): Set<RuntimeCell>
  normalizeWaterTopology(
    level?: number | null,
    seeds?: Set<RuntimeCell> | null,
    protectedCells?: Set<RuntimeCell>
  ): Set<RuntimeCell>
  formatCellsWaterBorder(): void
  rebuildTerrainAppearance(protectedReliefCells?: Set<RuntimeCell>): void
  classifyDeepWater(): void
  generateMapRelief(): void
  generateResourcesAroundPlayersAsync(playersPos: GeneratedPosition[]): Promise<void>
  generateNeutralResourceGroupsAsync(playersPos: GeneratedPosition[]): Promise<void>
  generateBiomeTreesAsync(playersPos: GeneratedPosition[]): Promise<void>
  placePlayers(): void
  _initFogChunks(): void
  _indexFogChunkCells(): void
  _flushFogQueue(): void
  bakeTerrainToChunks(): void
  getChildByLabel(label: string): ContainerChild | null
  removeChild(child: ContainerChild): ContainerChild
}
type SetSprite = Sprite & {
  updateAnchor?: boolean
}
type AmbientAnimalProfile = {
  weight: number
  groupChance: number
  groupSize: [min: number, max: number]
  radius: number
}
type ResourceDefinition = {
  category?: string
  habitat?: string
}
type GameConfig = {
  animals: Record<string, AnimalConfig>
  resources: Record<string, ResourceDefinition>
  cells: Record<string, CellDefinition>
}
export type CellDefinition = {
  assets: TextureRef[]
  [key: string]: string | TextureRef[] | number | boolean | undefined
}
export type GenerateMapOptions = {
  onProgress?: ProgressCallback
  terrain?: TerrainGrid | null
}
type BlueprintResource = {
  i: number
  j: number
  type: string
  textureName?: string
}
export type MapBlueprint = {
  seed?: string | number
  size: number
  mapType?: string
  spawns?: GeneratedPosition[]
  terrain: BlueprintTerrainValue[][]
  relief?: number[][]
  resources?: BlueprintResource[]
}
export type SavedGameData = Omit<SerializedSave, 'map' | 'players' | 'resources' | 'animals'> & {
  map: SaveCellState[][]
  players: SavedPlayer[]
  camera: { x: number; y: number }
  resources: SaveEntityState[]
  animals: SaveEntityState[]
}
type ProgressCallback = (stage: string, progress: number) => Promise<void> | void
const DEFAULT_AMBIENT_ANIMAL_PROFILE: AmbientAnimalProfile = {
  weight: 1,
  groupChance: 0.35,
  groupSize: [1, 2],
  radius: 2,
}
const AMBIENT_ANIMAL_PROFILES: Record<string, AmbientAnimalProfile> = {
  Deer: { weight: 4, groupChance: 0.9, groupSize: [3, 6], radius: 3 },
  Hare: { weight: 3, groupChance: 0.55, groupSize: [1, 4], radius: 2 },
  BlackGrouse: { weight: 3, groupChance: 0.75, groupSize: [2, 5], radius: 2 },
  Fox: { weight: 1, groupChance: 0.2, groupSize: [1, 2], radius: 3 },
  Boar: { weight: 0.7, groupChance: 0.15, groupSize: [1, 2], radius: 2 },
  Horse: { weight: 1.4, groupChance: 0.65, groupSize: [2, 4], radius: 3 },
}
// Multipliers applied on top of the base weight above, per terrain biome (cell.type).
// Biome patches can be smaller than a camp's ambient-spawn radius, so multipliers are kept
// close to 1 (never below ~0.45) - a lean per biome, never a hard species cutoff at the border.
const ANIMAL_HABITAT_WEIGHTS: Record<string, Record<string, number>> = {
  Grass: { Deer: 1.15, Hare: 1.1, BlackGrouse: 1.15, Fox: 0.85, Boar: 0.75, Horse: 1.25 },
  DarkForest: { Deer: 1.1, Hare: 0.85, BlackGrouse: 0.8, Fox: 1.2, Boar: 1.4, Horse: 0.75 },
  Jungle: { Deer: 0.85, Hare: 0.85, BlackGrouse: 0.75, Fox: 1.05, Boar: 1.15, Horse: 0.65 },
  Desert: { Deer: 0.5, Hare: 1.05, BlackGrouse: 0.5, Fox: 1.1, Boar: 0.45, Horse: 0.9 },
}
function pickWeightedItem<T>(random: () => number, entries: Array<[T, number]>): T {
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(weight, 0), 0)
  if (total <= 0) return entries[0][0]
  let roll = random() * total
  for (const [item, weight] of entries) {
    roll -= Math.max(weight, 0)
    if (roll <= 0) return item
  }
  return entries[entries.length - 1][0]
}
function createSpawnSearchCell(i: number, j: number, terrainType: TerrainValue): RuntimeCell {
  return {
    i,
    j,
    x: 0,
    y: 0,
    z: 0,
    type: terrainType === 2 ? 'Water' : 'Land',
    category: terrainType === 2 ? 'Water' : 'Land',
    border: false,
    waterBorder: false,
    solid: false,
    visible: false,
    inclined: false,
    has: null,
    corpses: new Set(),
    fogSprites: [],
    viewBy: new Set(),
    updateVisible() {},
    place(entity: RuntimeEntity) {
      this.has = entity
    },
    setFog() {},
    removeFog() {},
  }
}

// Local view of the AI-only bookkeeping fields used while restoring saved games.
// These live on the concrete AI player instance but are not part of the shared
// PlayerLike contract, so we narrow to this shape only where we know (via the
// `player.type === PLAYER_TYPES.ai` guard) that we are dealing with an AI player.
type GeneratedMapChild = ContainerChild & Partial<RuntimeEntity>

function gameContext(context: MapGenerationContext): GameContextLike {
  if (!context.app || !context.gamebox || !context.map || !context.menu || !context.controls || !context.scheduler) {
    throw new Error('Map generation requires a complete game context')
  }
  if (!context.player) {
    throw new Error('Map generation requires an active player')
  }
  return context as GameContextLike
}

function runtimeContext(context: MapGenerationContext): GameContextLike {
  if (!context.app || !context.gamebox || !context.map || !context.scheduler) {
    throw new Error('Map generation requires a runtime context')
  }
  return context as GameContextLike
}

function gameConfig(): GameConfig {
  return Assets.cache.get('config') as GameConfig
}

function createResourceFromState(resource: ResourceOptions, map: MapGenerationMap): ResourceEntity {
  const instance = map.addChild(new Resource(resource, runtimeContext(map.context)))
  if (instance.type === PORTAL_RESOURCE_TYPE) {
    const footprintRadius = getBuildingFootprintRadius(instance.size || PORTAL_FOOTPRINT_SIZE)
    getPlainCellsAroundPoint(instance.i, instance.j, map.grid, footprintRadius, cell => {
      cell.solid = true
      cell.has = instance
      return true
    })
  }
  return instance
}

export class MapGeneration {
  map: MapGenerationMap
  mapBlueprintGeneration: MapBlueprintGeneration

  constructor(map: MapGenerationMap) {
    this.map = map
    this.mapBlueprintGeneration = new MapBlueprintGeneration(
      map,
      () => this.yieldToBrowser(),
      () => this.destroyGeneratedChildren()
    )
  }

  destroyGeneratedChildren(): void {
    this.map.terrainChunkManager?.destroy()
    this.map.mapFog?.destroyFogResources()
    for (const row of this.map.grid) {
      for (const cell of row || []) {
        if (!cell?.isGenerationCell) continue
        for (const child of cell.children || []) {
          child.destroy?.({ children: true, texture: false, textureSource: false })
        }
      }
    }
    for (const child of this.map.removeChildren()) {
      child.destroy?.({ children: true, texture: false, textureSource: false })
    }
    this.map.grid = []
    this.map.resources = new Set()
    this.map.instanceBuckets = null
    this.map.clearRenderChunks()
  }

  yieldToBrowser(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(() => resolve()))
  }

  generateTerrainInWorker(
    gridSize: number,
    seed: number,
    params: Partial<EnvironmentTerrainParams> = {}
  ): Promise<TerrainGrid> {
    if (typeof Worker === 'undefined') {
      return Promise.resolve(this.generateTerrain(gridSize, seed, params))
    }
    const source = this.generateTerrain.toString()
    const functionSource = source.startsWith('function') ? `(${source})` : `(function ${source})`
    const workerSource = `
      const generateTerrain = ${functionSource};
      self.onmessage = ({ data }) => {
        try {
          const scope = { map: { seed: data.seed, positionsCount: data.positionsCount } };
          const terrain = generateTerrain.call(scope, data.gridSize, data.seed, data.params);
          self.postMessage({ terrain, seed: scope.map.seed });
        } catch (error) {
          self.postMessage({ error: error?.stack || error?.message || String(error) });
        }
      };
    `
    const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }))
    return new Promise((resolve, reject) => {
      const worker = new Worker(url)
      const cleanup = () => {
        worker.terminate()
        URL.revokeObjectURL(url)
      }
      worker.onmessage = ({ data }) => {
        cleanup()
        if (data.error) {
          reject(new Error(data.error))
          return
        }
        this.map.seed = data.seed
        resolve(data.terrain)
      }
      worker.onerror = error => {
        cleanup()
        reject(error)
      }
      worker.postMessage({
        gridSize,
        seed,
        positionsCount: this.map.positionsCount,
        params,
      })
    })
  }

  isInPlayerStartSafeZone(i: number, j: number, radius: number = 20): boolean {
    const safeDistanceSq = radius ** 2
    return this.map.playersPos.some(pos => Boolean(pos && (pos.i - i) ** 2 + (pos.j - j) ** 2 < safeDistanceSq))
  }

  pickAmbientAnimalType(i: number, j: number): string {
    const animals = gameConfig().animals
    const excludedGeneratedAnimalTypes = new Set(['Wolf'])
    const dangerousAnimalTypes = new Set(['Boar'])
    const safeZoneRadius = 20
    const availableTypes = Object.keys(animals).filter(type => {
      if (excludedGeneratedAnimalTypes.has(type)) return false
      return !dangerousAnimalTypes.has(type) || !this.isInPlayerStartSafeZone(i, j, safeZoneRadius)
    })
    const types = availableTypes.length ? availableTypes : Object.keys(animals)
    const biome = this.map.grid[i]?.[j]?.type ?? ''
    const habitatMultipliers = ANIMAL_HABITAT_WEIGHTS[biome] ?? {}
    const weightedEntries: Array<[string, number]> = types.map(type => [
      type,
      (AMBIENT_ANIMAL_PROFILES[type] ?? DEFAULT_AMBIENT_ANIMAL_PROFILE).weight * (habitatMultipliers[type] ?? 1),
    ])

    return pickWeightedItem(() => this.map.random(), weightedEntries)
  }

  getAmbientAnimalProfile(type: string): AmbientAnimalProfile {
    return AMBIENT_ANIMAL_PROFILES[type] ?? DEFAULT_AMBIENT_ANIMAL_PROFILE
  }

  canPlaceAmbientAnimalAt(i: number, j: number): boolean {
    const cell = this.map.grid[i]?.[j]
    return Boolean(
      cell &&
        !cell.solid &&
        !cell.has &&
        !cell.border &&
        !cell.waterBorder &&
        !hasWaterBorderWithin(this.map.grid, i, j, WATER_BORDER_PLACEMENT_CLEARANCE) &&
        !cell.inclined &&
        cell.category !== 'Water' &&
        !this._hasWaterNeighbor(i, j) &&
        !this.isInPlayerStartSafeZone(i, j, ANIMAL_PLAYER_SAFE_DIST)
    )
  }

  placeAmbientAnimalGroup(i: number, j: number, type: string): void {
    if (!this.canPlaceAmbientAnimalAt(i, j)) return

    const profile = this.getAmbientAnimalProfile(type)
    const shouldGroup = this.map.random() < profile.groupChance
    const targetSize = shouldGroup ? this.map.randomRange(profile.groupSize[0], profile.groupSize[1]) : 1
    const candidates: GridPosition[] = [{ i, j }]

    for (let di = -profile.radius; di <= profile.radius; di++) {
      for (let dj = -profile.radius; dj <= profile.radius; dj++) {
        if (di === 0 && dj === 0) continue
        if (di * di + dj * dj > profile.radius * profile.radius) continue
        const ni = i + di
        const nj = j + dj
        if (this.canPlaceAmbientAnimalAt(ni, nj)) candidates.push({ i: ni, j: nj })
      }
    }

    const toPlace = Math.min(targetSize, candidates.length)
    for (let index = 0; index < toPlace; index++) {
      const candidateIndex = index === 0 ? 0 : this.map.randomRange(0, candidates.length - 1)
      const cell = candidates.splice(candidateIndex, 1)[0]
      this._gaiaCreateAnimal({ i: cell.i, j: cell.j, type })
    }
  }

  isShoreWaterCell(i: number, j: number): boolean {
    const cell = this.map.grid[i]?.[j]
    return Boolean(cell?.category === 'Water' && cell.type !== 'DeepWater' && this._hasLandNeighborInRange(i, j, 1))
  }

  generateFromJSON(data: SavedGameData): void {
    const { map, players, camera, resources, animals, runtime } = data
    const classMap: Record<string, typeof Human | typeof AI> = { Human, AI }
    const context = runtimeContext(this.map.context)
    const { menu, controls } = context
    this.map.removeChildren()
    this.map.clearRenderChunks()
    this.map.resetRandom()
    this.map.size = map.length - 1
    this.map.invalidateReliefCoastDistances()

    this.map.context.players = players.map((player: SavedPlayer) => {
      const p = new classMap[player.type](
        {
          ...player,
          corpses: [],
          buildings: [],
          units: [],
          ...(player.type === PLAYER_TYPES.ai ? { difficulty: this.map.difficulty } : {}),
        },
        context
      )
      if (player.isPlayed) {
        this.map.context.player = p
      }
      return p
    })
    if (Number.isFinite(runtime?.elapsedMs) && this.map.context.scheduler) {
      this.map.context.scheduler.elapsedMs = Math.max(0, runtime?.elapsedMs ?? 0)
    }

    this.map._initFogChunks()
    const gaia = new Gaia(context)
    this.map.gaia = gaia

    for (let i = 0; i <= this.map.size; i++) {
      const line = map[i]
      for (let j = 0; j <= this.map.size; j++) {
        if (!this.map.grid[i]) {
          this.map.grid[i] = []
        }
        const cell = line[j]
        const newCell = new Cell({ i, j, z: cell.z ?? 0, type: cell.type, fogSprites: cell.fogSprites ?? [] }, context)
        this.map.addChild(newCell)
        this.map.grid[i][j] = newCell
      }
    }
    this.map._indexFogChunkCells()

    this.map.fillWaterGaps()
    this.map.normalizeWaterTopology()
    this.map.resources = new Set(resources.map(resource => createResourceFromState(resource, this.map)))

    this.map.rebuildTerrainAppearance()

    if (!this.map.revealEverything) {
      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          this.map.grid[i][j].setFog()
        }
      }
    }

    controls?.setCamera?.(camera.x, camera.y, true)
    menu?.init?.()
    menu?.updateResourcesMiniMap()

    this.map.context.players.forEach((player, index) => restorePlayerEntitiesFromSave(player, players[index]))
    animals.filter(animal => !animal.isDestroyed).forEach(animal => gaia.createAnimal(animal))

    getGaiaAnimals(gaia).forEach(animal => processUnit(animal, this.map))

    this.map.context.players.forEach((player, index) => {
      const savedPlayer = players[index]
      restorePlayerViewsAndFog(player, this.map)
      restoreBuildingAssignments(player, savedPlayer?.buildings || [], this.map)
      rehydrateAIKnowledge(player, this.map)
      restoreAIState(player, savedPlayer, this.map)
      player.units.forEach(unit => processUnit(unit, this.map))
      restoreSelection(player, savedPlayer, this.map)
    })

    this.map._fogInitComplete = true
    this.map._flushFogQueue()
    this.map.bakeTerrainToChunks()
    this.map.ready = true
  }

  clearGeneratedGameplayState(): void {
    const dynamicFamilies = new Set([
      FAMILY_TYPES.animal,
      FAMILY_TYPES.building,
      FAMILY_TYPES.projectile,
      FAMILY_TYPES.resource,
      FAMILY_TYPES.unit,
    ])
    for (const child of [...(this.map.children || [])]) {
      if (!child.family || !dynamicFamilies.has(child.family)) continue
      child.stopInterval?.()
      child.stopTimeout?.()
      child.animalBehavior?.stop?.()
      child.isDestroyed = true
      this.map.removeChild(child)
      child.destroy?.({ children: true, texture: false, textureSource: false })
    }
    for (const row of this.map.grid || []) {
      for (const cell of row || []) {
        cell.has = null
        cell.solid = false
        cell.corpses?.clear?.()
      }
    }
    this.map.resources = new Set()
    this.map.instanceBuckets = null
    this.map.context.players = []
    this.map.context.player = null
    this.map.gaia = new Gaia(runtimeContext(this.map.context))
  }

  applySavedStateToGeneratedMap(data: SavedGameData): void {
    const { players, camera, resources, animals, runtime } = data
    const classMap: Record<string, typeof Human | typeof AI> = { Human, AI }
    const context = runtimeContext(this.map.context)
    const { menu, controls } = context

    this.clearGeneratedGameplayState()

    this.map.context.players = players.map((player: SavedPlayer) => {
      const p = new classMap[player.type](
        {
          ...player,
          corpses: [],
          buildings: [],
          units: [],
          ...(player.type === PLAYER_TYPES.ai ? { difficulty: this.map.difficulty } : {}),
        },
        context
      )
      if (player.isPlayed) {
        this.map.context.player = p
      }
      return p
    })
    if (Number.isFinite(runtime?.elapsedMs) && this.map.context.scheduler) {
      this.map.context.scheduler.elapsedMs = Math.max(0, runtime?.elapsedMs ?? 0)
    }

    this.map.resources = new Set(resources.map(resource => createResourceFromState(resource, this.map)))

    controls?.setCamera?.(camera.x, camera.y, true)
    menu?.init?.()
    menu?.updateResourcesMiniMap()

    this.map.context.players.forEach((player, index) => restorePlayerEntitiesFromSave(player, players[index]))
    const gaia = this.map.gaia instanceof Gaia ? this.map.gaia : null
    animals.filter(animal => !animal.isDestroyed).forEach(animal => gaia?.createAnimal(animal))

    getGaiaAnimals(gaia).forEach(animal => processUnit(animal, this.map))

    this.map.context.players.forEach((player, index) => {
      const savedPlayer = players[index]
      restorePlayerViewsAndFog(player, this.map)
      restoreBuildingAssignments(player, savedPlayer?.buildings || [], this.map)
      rehydrateAIKnowledge(player, this.map)
      restoreAIState(player, savedPlayer, this.map)
      player.units.forEach(unit => processUnit(unit, this.map))
      restoreSelection(player, savedPlayer, this.map)
    })

    this.map._fogInitComplete = true
    this.map._flushFogQueue()
    this.map.ready = true
  }

  async generateMapAsync(
    positionsCountOverride: number | null = null,
    repeat: number = 0,
    options: GenerateMapOptions = {}
  ): Promise<void> {
    this.destroyGeneratedChildren()
    if (!Number.isFinite(this.map.seed)) this.map.seed = Math.random() * 9999
    this.map.resetRandom('ideal-spawns')
    const [minIdealSpawns, maxIdealSpawns] = getIdealSpawnRangeForMapSize(this.map.size)
    this.map.positionsCount =
      positionsCountOverride ??
      this.map.randomRange(Math.min(minIdealSpawns, maxIdealSpawns), Math.max(minIdealSpawns, maxIdealSpawns))

    const terrain = await this.generateTerrainDataAsync()
    this.map.size = terrain.length - 1
    // Lightweight placeholder grid used only for the findPlayerPlaces() spawn search below;
    // generateCellsAsync() replaces it with real GenerationCell instances further down.
    this.map.grid = terrain.map((row: TerrainValue[], i: number) =>
      row.map((terrainType: TerrainValue, j: number) => createSpawnSearchCell(i, j, terrainType))
    )

    let validSpawns = false
    for (let attempt = repeat; attempt <= 10; attempt++) {
      this.map.resetRandom(attempt)
      this.map.playersPos = this.map.findPlayerPlaces()
      if (this.map.playersPos.length >= this.map.positionsCount) {
        this.map.resetRandom(attempt)
        validSpawns = true
        break
      }
      await this.yieldToBrowser()
    }

    if (!validSpawns) {
      this.map.grid = []
      alert('Error while generating the map')
      return
    }

    await this.generateCellsAsync({ ...options, terrain })
  }

  async stylishMap({
    onProgress = async (_stage: string, _progress: number) => {},
  }: GenerateMapOptions = {}): Promise<void> {
    const context = gameContext(this.map.context)
    const { menu, player } = context

    const timings: Record<string, number> = this.map.generationTimings || {}
    const measure = <T>(name: string, callback: () => T): T => {
      const startedAt = performance.now()
      const result = callback()
      timings[name] = performance.now() - startedAt
      return result
    }
    const measureAsync = async <T>(name: string, callback: () => Promise<T> | T): Promise<T> => {
      const startedAt = performance.now()
      const result = await callback()
      timings[name] = performance.now() - startedAt
      return result
    }

    this.map.gaia = new Gaia(context)
    if (this.map.pregeneratedBlueprintId) {
      timings.relief = 0
    } else {
      await onProgress('generatingRelief', 0.28)
      measure('relief', () => this.map.generateMapRelief())
    }
    await this.yieldToBrowser()
    measure('deepWater', () => this.map.classifyDeepWater())
    measure('terrainRendering', () => this.map.rebuildTerrainAppearance())
    await onProgress('generatingPlayers', 0.48)
    measure('playerPlacement', () => this.map.placePlayers())
    await onProgress('generatingResources', 0.58)
    if (this.map.pregeneratedResourcesLoaded) {
      timings.playerResources = 0
      timings.neutralResources = 0
      timings.biomeTrees = 0
    } else {
      await measureAsync('playerResources', () => this.map.generateResourcesAroundPlayersAsync(this.map.playersPos))
      await measureAsync('neutralResources', () => this.map.generateNeutralResourceGroupsAsync(this.map.playersPos))
      await measureAsync('biomeTrees', () => this.map.generateBiomeTreesAsync(this.map.playersPos))
    }
    measure('portalPlacement', () => this.placePortal())
    await onProgress('generatingDecorations', 0.74)
    await measureAsync('decorations', () => this.generateSetsAsync())
    for (const viewer of this.map.context.players || []) {
      rehydrateAIKnowledge(viewer, this.map)
    }
    await onProgress('generatingFog', 0.86)
    measure('fogInit', () => this.map._initFogChunks())

    if (!this.map.revealEverything) {
      const fogCellsStartedAt = performance.now()
      const yieldEvery = this.map.pregeneratedBlueprintId ? 32 : 12
      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          this.map.grid[i][j].setFog()
        }
        if (i % yieldEvery === 0) await this.yieldToBrowser()
      }
      for (let i = 0; i < player.buildings.length; i++) {
        const building = player.buildings[i]
        building.visibleCells = new Set()
        updateInstanceVisibility(building)
      }
      for (let i = 0; i < player.units.length; i++) {
        const unit = player.units[i]
        unit.visibleCells = new Set()
        updateInstanceVisibility(unit)
      }
      timings.fogCells = performance.now() - fogCellsStartedAt
    }

    this.map._fogInitComplete = true
    this.map._flushFogQueue()
    await onProgress('finalizingWorld', 0.93)
    await measureAsync('terrainBake', () => this.map.bakeTerrainToChunks())
    this.map.ready = true
    this.map.generationTimings = timings
    console.table(
      Object.fromEntries(Object.entries(timings).map(([name, duration]) => [name, `${duration.toFixed(1)} ms`]))
    )
    menu.updateResourcesMiniMap()
  }

  async prepareTerrainForSavedState({
    onProgress = async (_stage: string, _progress: number) => {},
  }: GenerateMapOptions = {}): Promise<void> {
    const context = runtimeContext(this.map.context)
    const timings: Record<string, number> = this.map.generationTimings || {}
    const measure = <T>(name: string, callback: () => T): T => {
      const startedAt = performance.now()
      const result = callback()
      timings[name] = performance.now() - startedAt
      return result
    }
    const measureAsync = async <T>(name: string, callback: () => Promise<T> | T): Promise<T> => {
      const startedAt = performance.now()
      const result = await callback()
      timings[name] = performance.now() - startedAt
      return result
    }

    this.map.gaia = new Gaia(context)
    if (this.map.pregeneratedBlueprintId) {
      timings.relief = 0
    } else {
      await onProgress('generatingRelief', 0.28)
      measure('relief', () => this.map.generateMapRelief())
    }
    await this.yieldToBrowser()
    measure('deepWater', () => this.map.classifyDeepWater())
    measure('terrainRendering', () => this.map.rebuildTerrainAppearance())
    await onProgress('generatingFog', 0.72)
    measure('fogInit', () => this.map._initFogChunks())

    if (!this.map.revealEverything) {
      const fogCellsStartedAt = performance.now()
      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          this.map.grid[i][j].setFog()
        }
        if (i % 16 === 0) await this.yieldToBrowser()
      }
      timings.fogCells = performance.now() - fogCellsStartedAt
    }

    this.map._fogInitComplete = true
    this.map._flushFogQueue()
    await onProgress('finalizingWorld', 0.92)
    await measureAsync('terrainBake', () => this.map.bakeTerrainToChunks())
    this.map.ready = true
    this.map.generationTimings = timings
  }

  applyStartingBonuses(player: PlayerLike, configuredAge: number | null = null): void {
    const age = configuredAge == null ? this.map.startingAge : configuredAge
    const startingAge = Math.max(0, Math.min(Number(age) || 0, 1))
    player.age = startingAge

    if (!this.map.allTechnologies) return

    player.autoTechnologyByAge = true
    player.applyEligibleTechnologies?.()
  }

  generatePlayers(playersConfig: Array<PlayerOptions> | null = null): PlayerLike[] {
    const context = runtimeContext(this.map.context)

    const players: PlayerLike[] = []
    const poses: number[] = []
    const randoms = Array.from(Array(this.map.playersPos.length).keys())

    for (let i = 0; i < this.map.playersPos.length; i++) {
      const pos = this.map.randomItem(randoms)
      poses.push(pos)
      randoms.splice(randoms.indexOf(pos), 1)
    }

    const playerCount = Math.min(playersConfig?.length || 1, this.map.playersPos.length)
    for (let i = 0; i < playerCount; i++) {
      const posI = this.map.playersPos[poses[i]]?.i
      const posJ = this.map.playersPos[poses[i]]?.j
      if (posI != null && posJ != null) {
        const color = playersConfig?.[i]?.color ?? colors[i]
        const civ = playersConfig?.[i]?.civ ?? 'Greek'
        const factionId = playersConfig?.[i]?.factionId ?? null
        const gender = playersConfig?.[i]?.gender
        const team = playersConfig?.[i]?.team ?? null
        const diplomacy = playersConfig?.[i]?.diplomacy ?? null
        const name = playersConfig?.[i]?.name
        const difficulty = this.map.difficulty
        const civilizationLevel = Math.max(0, Math.min(Number(playersConfig?.[i]?.civilizationLevel) || 0, 3))
        if (!i) {
          players.push(
            new Human(
              {
                i: posI,
                j: posJ,
                age: 0,
                civ,
                color,
                diplomacy,
                factionId,
                gender,
                team,
                name,
                isPlayed: true,
                civilizationLevel,
              },
              context
            )
          )
        } else if (!this.map.noAI) {
          players.push(
            new AI(
              {
                i: posI,
                j: posJ,
                age: 0,
                civ,
                color,
                diplomacy,
                factionId,
                gender,
                team,
                name,
                difficulty,
                civilizationLevel,
              },
              context
            )
          )
        }
      }
    }

    players.forEach((player, index) =>
      this.applyStartingBonuses(
        player,
        playersConfig?.[index]?.age ?? playersConfig?.[index]?.civilizationLevel ?? null
      )
    )

    return players
  }

  placePlayers(): void {
    const {
      context: { players },
    } = this.map

    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      if (player.isPlayed && this.map.humanStartsWithoutBase) {
        player.createUnit?.({ i: player.i, j: player.j, type: UNIT_TYPES.hero })
        continue
      }
      const towncenter = player.spawnBuilding?.({
        i: player.i,
        j: player.j,
        type: BUILDING_TYPES.townCenter,
        isBuilt: true,
      })
      if (!towncenter) continue
      const hasStartingLeader = player.type === PLAYER_TYPES.ai || player.isPlayed
      const startingCivilianCount = Math.max(this.map.startingUnits, STARTING_CIVILIAN_GENDERS.length)
      const requiredStartingPopulation = startingCivilianCount + (hasStartingLeader ? 1 : 0)
      player.populationMax = Math.max(player.populationMax, Math.min(POPULATION_MAX, requiredStartingPopulation))
      if (player.type === PLAYER_TYPES.ai) {
        towncenter.placeUnit?.(UNIT_TYPES.chief)
      } else if (player.isPlayed) {
        towncenter.placeUnit?.(UNIT_TYPES.villager)
      }
      for (let i = 0; i < startingCivilianCount; i++) {
        const gender = STARTING_CIVILIAN_GENDERS[i % STARTING_CIVILIAN_GENDERS.length]
        towncenter.placeUnit?.(UNIT_TYPES.villager, { gender, appearanceVariants: { gender } })
      }
      if (player.civilizationLevel) {
        this.applyCivilizationLevelStartingKit(player, player.civilizationLevel, towncenter)
      }
    }
  }

  // Spawns a player already at an advanced stage: extra economy/military buildings, a static wall
  // perimeter, consistent technologies, a resource cushion and a few soldiers stationed near home.
  // Building/unit counts are read straight from the AI's own long-term per-age targets
  // (MAX_BUILDING_BY_AGE, MAX_*_BY_AGE) so no new tuning numbers are invented here.
  applyCivilizationLevelStartingKit(player: PlayerLike, level: number, townCenter: BuildingEntity): void {
    const { map } = this
    player.hasBuilt = player.hasBuilt || []

    const markBuilt = (type: string) => {
      if (!player.hasBuilt!.includes(type)) player.hasBuilt!.push(type)
    }

    const placementSpaceFor = (type: string): [number, number] => {
      if (type === BUILDING_TYPES.townCenter) return [14, 32]
      if (type === BUILDING_TYPES.house) return [6, 12]
      return [6, 22]
    }
    const placementSizeFor = (type: string): number => {
      if (type === BUILDING_TYPES.townCenter || type === BUILDING_TYPES.farm) return 2
      if (type === BUILDING_TYPES.house) return 0
      return 1
    }

    // Buildings placed earlier by this method reduce free space for the ones that come after, so a
    // single search attempt can spuriously fail once the base gets crowded - retry progressively
    // further out before giving up, instead of undershooting the target (e.g. too few Houses).
    const placeExtraBuilding = (type: string): boolean => {
      const config = player.config.buildings[type]
      if (!config) return false
      // MAX_BUILDING_BY_AGE still lists buildings gated behind an age this player can never reach
      // (e.g. SentryTower, sentinel-disabled) - skip those instead of crashing on a missing asset.
      if (player.isBuildingEligible && !player.isBuildingEligible(type)) return false
      const placementConfig = { ...config, type }
      const [minSpace, maxSpace] = placementSpaceFor(type)
      const size = placementSizeFor(type)
      for (const spaceMultiplier of [1, 2, 3, 4]) {
        const position = getPositionInGridAroundInstance(
          townCenter,
          map.grid,
          [minSpace, maxSpace * spaceMultiplier],
          size
        )
        if (position && canPlaceBuildingAt(map.grid, position.i, position.j, placementConfig)) {
          player.createBuilding({ i: position.i, j: position.j, type, isBuilt: true })
          markBuilt(type)
          return true
        }
      }
      return false
    }

    // 1. Houses first, sized for the population this kit is about to reach - placed before the base
    // gets crowded by everything else below so population capacity isn't left short by congestion.
    const infantryType = UNIT_TYPES.infantry
    const archerType = getBestUnitFromTechs(player.technologies, ARCHER_TECH_UPGRADES, UNIT_TYPES.bowman)
    const maxByAge = (table: Record<number, number>) => table[level] || 0
    const unitTargets: Array<[string, number]> = [
      [infantryType, maxByAge(MAX_INFANTRY_BY_AGE)],
      [archerType, maxByAge(MAX_ARCHER_BY_AGE)],
    ]

    let populationTarget = player.population
    for (const [, count] of unitTargets) populationTarget += count

    const houseConfig = player.config.buildings[BUILDING_TYPES.house]
    const houseCapacity = Number(houseConfig?.increasePopulation) || 0
    if (houseCapacity > 0) {
      let guard = 0
      while (player.populationMax < populationTarget && guard++ < 20) {
        if (!placeExtraBuilding(BUILDING_TYPES.house)) break
      }
    }

    // 2. Economy/military buildings up to this level's own long-term targets.
    const buildingTargets = (MAX_BUILDING_BY_AGE as Record<number, Record<string, number>>)[level] || {}
    for (const [type, targetCount] of Object.entries(buildingTargets)) {
      const existing = player.buildings.filter(building => building.type === type).length
      for (let n = existing; n < targetCount; n++) {
        if (!placeExtraBuilding(type)) break
      }
    }

    // 3. Wall perimeter for established/imperial levels only - static, never repaired/extended by the AI.
    if (level >= 2) {
      const wallConfig = player.config.buildings[BUILDING_TYPES.smallWall]
      if (wallConfig) {
        for (const [di, dj] of getDiamondRingOffsets(22)) {
          const i = townCenter.i + di
          const j = townCenter.j + dj
          const placementConfig = { ...wallConfig, type: BUILDING_TYPES.smallWall }
          if (!canPlaceBuildingAt(map.grid, i, j, placementConfig)) continue
          player.createBuilding({ i, j, type: BUILDING_TYPES.smallWall, isBuilt: true })
          markBuilt(BUILDING_TYPES.smallWall)
        }
      }
    }

    // 4. Technologies consistent with the age/buildings just granted - also retextures the walls/towers
    // above to the right tier via the 'refreshWalls'/'refreshTowers' actions already wired on unlock.
    player.applyEligibleTechnologies?.()

    // 5. Resource cushion.
    const resourceBonus = CIVILIZATION_LEVEL_RESOURCE_BONUS[level]
    if (resourceBonus) {
      player.wood += resourceBonus.wood ?? 0
      player.food += resourceBonus.food ?? 0
      player.gold += resourceBonus.gold ?? 0
      player.stone += resourceBonus.stone ?? 0
      player.copper += resourceBonus.copper ?? 0
      player.iron += resourceBonus.iron ?? 0
    }

    // 6. Military units, stationed near the Town Center (the game has no true garrison mechanic).
    for (const [type, count] of unitTargets) {
      if (!type || !count || !player.config.units[type]) continue
      for (let n = 0; n < count; n++) {
        const position = getPositionInGridAroundInstance(townCenter, map.grid, [2, 10], 0)
        if (!position) continue
        player.createUnit?.({ i: position.i, j: position.j, type, owner: player })
        player.population = (player.population ?? 0) + 1
      }
    }
  }

  generateCells(): void {
    const context = runtimeContext(this.map.context)
    const z = 0
    this.map.grid = []
    this.map.invalidateReliefCoastDistances()
    const terrain = this.map.generateTerrain(
      this.map.size ? this.map.size + 1 : 121,
      this.map.seed == null ? undefined : Number(this.map.seed),
      getEnvironmentTerrainParams(this.map.environment)
    )
    this.map.size = terrain.length - 1

    const terrainMap: Record<TerrainValue, string> = {
      0: 'Grass',
      1: 'Desert',
      2: 'Water',
      3: 'Jungle',
      4: 'DarkForest',
      5: 'Dirt',
    }

    for (let i = 0; i <= this.map.size; i++) {
      if (!this.map.grid[i]) this.map.grid[i] = []
      for (let j = 0; j <= this.map.size; j++) {
        const type = terrainMap[terrain[i][j]]
        const cell = new Cell({ i, j, z, type }, context)
        this.map.addChild(cell)
        this.map.grid[i][j] = cell
      }
    }

    this.map.fillWaterGaps()
    this.map.normalizeWaterTopology()
    this.map.formatCellsWaterBorder()
  }

  async generateTerrainDataAsync(): Promise<TerrainGrid> {
    const terrainStartedAt = performance.now()
    const gridSize = this.map.size ? this.map.size + 1 : 121
    const seed = this.map.seed == null ? Math.random() * 9999 : Number(this.map.seed)
    const params = getEnvironmentTerrainParams(this.map.environment)
    let terrain: TerrainGrid
    try {
      terrain = await this.generateTerrainInWorker(gridSize, seed, params)
    } catch (error) {
      console.warn('Terrain worker unavailable, falling back to main thread', error)
      terrain = this.map.generateTerrain(gridSize, seed, params)
    }
    this.map.context.performance?.record('terrainData', performance.now() - terrainStartedAt)
    return terrain
  }

  async generateCellsAsync({
    onProgress = async (_stage: string, _progress: number) => {},
    terrain: preparedTerrain = null,
  }: GenerateMapOptions = {}): Promise<void> {
    const context = runtimeContext(this.map.context)
    const z = 0
    this.map.grid = []
    this.map.invalidateReliefCoastDistances()
    const terrain: TerrainGrid = preparedTerrain || (await this.generateTerrainDataAsync())
    this.map.size = terrain.length - 1

    const terrainMap: Record<number, string> = {
      0: 'Grass',
      1: 'Desert',
      2: 'Water',
      3: 'Jungle',
      4: 'DarkForest',
      5: 'Dirt',
    }
    const startedAt = performance.now()
    for (let i = 0; i <= this.map.size; i++) {
      const row: RuntimeCell[] = []
      this.map.grid[i] = row
      for (let j = 0; j <= this.map.size; j++) {
        const cell = new GenerationCell({ i, j, z, type: terrainMap[terrain[i][j]] }, context)
        row[j] = cell
      }
      if (i % 8 === 0) {
        await onProgress('loadingPregeneratedMap', 0.03 + (i / this.map.size) * 0.14)
        await this.yieldToBrowser()
      }
    }
    this.map.context.performance?.record('cellCreation', performance.now() - startedAt)

    this.map.fillWaterGaps()
    await this.yieldToBrowser()
    this.map.normalizeWaterTopology()
    await this.yieldToBrowser()
    this.map.formatCellsWaterBorder()
  }

  async generateFromBlueprint(
    blueprintData: MapBlueprint,
    options: { onProgress?: ProgressCallback } = {}
  ): Promise<void> {
    return this.mapBlueprintGeneration.generateFromBlueprint(blueprintData, options)
  }

  generateEditableFromBlueprint(blueprintData: MapBlueprint): void {
    return this.mapBlueprintGeneration.generateEditableFromBlueprint(blueprintData)
  }

  generateTerrain(gridSize: number = 120, seed?: number, params: Partial<EnvironmentTerrainParams> = {}): TerrainGrid {
    let resolvedSeed = seed
    if (resolvedSeed == null) resolvedSeed = Math.random() * 9999
    this.map.seed = resolvedSeed

    function hash(x: number, y: number): number {
      const n = Math.sin(x * 127.1 + y * 311.7 + resolvedSeed! * 3.7) * 43758.5453
      return n - Math.floor(n)
    }

    function noise(x: number, y: number): number {
      const xi = Math.floor(x),
        yi = Math.floor(y)
      const xf = x - xi,
        yf = y - yi
      const smooth = (t: number) => t * t * (3 - 2 * t)
      const u = smooth(xf),
        v = smooth(yf)
      const a = hash(xi, yi),
        b = hash(xi + 1, yi)
      const c = hash(xi, yi + 1),
        d = hash(xi + 1, yi + 1)
      return a + (b - a) * u + (c - a) * v + (d + a - b - c) * u * v
    }

    function fbm(x: number, y: number, octaves: number = 5): number {
      let val = 0,
        amp = 0.5,
        freq = 1,
        sum = 0
      for (let o = 0; o < octaves; o++) {
        val += noise(x * freq, y * freq) * amp
        sum += amp
        amp *= 0.5
        freq *= 2
      }
      return val / sum
    }

    const scale = 4 / gridSize
    const half = gridSize / 2

    // Plateau + narrow falloff: the inner 85% radius (~72% of the map's area) is fully
    // land-biased and untouched by edge proximity, so the coastline forms from a thin band
    // near the border instead of eating into the interior. There are no boats to reach
    // stray islands, so the map should read as one big landmass, not a natural archipelago.
    const falloffPlateau = 0.85
    function radialFalloff(i: number, j: number): number {
      const dx = (i - half) / half
      const dy = (j - half) / half
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= falloffPlateau) return 1
      const t = Math.min(1, (dist - falloffPlateau) / (1 - falloffPlateau))
      return 1 - t * t * (3 - 2 * t)
    }

    // One map = one environment: `groundType` is the single ground type covering this
    // environment's non-water land (see EnvironmentTerrainParams) — water sparsity,
    // patchwork shapes and lakes come from `params` too. The default below (used only if
    // a caller omits `params` entirely) matches Temperate.
    const terrainValueByType = {
      Grass: 0,
      Desert: 1,
      Jungle: 3,
      DarkForest: 4,
      Dirt: 5,
    } satisfies Record<'Grass' | 'Desert' | 'Jungle' | 'DarkForest' | 'Dirt', TerrainValue>
    const groundTypeValue = terrainValueByType[params.groundType ?? 'Grass']
    const height = new Float32Array(gridSize * gridSize)
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        height[i * gridSize + j] = fbm(i * scale, j * scale)
      }
    }

    const waterThreshold = 0.28

    const terrainMap: TerrainGrid = []
    const borderWaterWidth = Math.max(4, Math.floor(gridSize * 0.04))
    for (let i = 0; i < gridSize; i++) {
      terrainMap[i] = []
      for (let j = 0; j < gridSize; j++) {
        let h = height[i * gridSize + j]
        const fo = radialFalloff(i, j)

        h += (fo - 0.5) * 0.75

        terrainMap[i][j] = h < waterThreshold ? 2 : groundTypeValue
      }
    }

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < gridSize - 1; i++) {
        for (let j = 1; j < gridSize - 1; j++) {
          const wn =
            (terrainMap[i - 1][j] === 2 ? 1 : 0) +
            (terrainMap[i + 1][j] === 2 ? 1 : 0) +
            (terrainMap[i][j - 1] === 2 ? 1 : 0) +
            (terrainMap[i][j + 1] === 2 ? 1 : 0)
          if (terrainMap[i][j] !== 2 && wn >= 3) terrainMap[i][j] = 2
          if (terrainMap[i][j] === 2 && wn <= 1) terrainMap[i][j] = groundTypeValue
        }
      }
    }

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        if (
          i < borderWaterWidth ||
          j < borderWaterWidth ||
          i >= gridSize - borderWaterWidth ||
          j >= gridSize - borderWaterWidth
        ) {
          terrainMap[i][j] = 2
        }
      }
    }

    // There are no boats: drown every land component except the largest one so the map
    // is a single reachable landmass instead of a mainland dotted with useless islets.
    function removeDisconnectedLand(): void {
      const visited = new Uint8Array(gridSize * gridSize)
      let bestComponent: number[] | null = null
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const start = i * gridSize + j
          if (terrainMap[i][j] === 2 || visited[start]) continue
          visited[start] = 1
          const component = [start]
          const stack = [start]
          while (stack.length) {
            const idx = stack.pop()!
            const ci = Math.floor(idx / gridSize)
            const cj = idx % gridSize
            // Plain index access, not array destructuring: this method's compiled body is
            // extracted via .toString() and run inside a Web Worker in total isolation
            // (see generateTerrainInWorker) — destructuring a tuple here compiles to a
            // call to Babel's `_slicedToArray` helper, which only exists in the surrounding
            // bundle and is undefined inside the worker, throwing a ReferenceError there.
            const neighbors: [number, number][] = [
              [ci - 1, cj],
              [ci + 1, cj],
              [ci, cj - 1],
              [ci, cj + 1],
            ]
            for (let neighborIndex = 0; neighborIndex < neighbors.length; neighborIndex++) {
              const ni = neighbors[neighborIndex][0]
              const nj = neighbors[neighborIndex][1]
              if (ni < 0 || nj < 0 || ni >= gridSize || nj >= gridSize) continue
              const nIdx = ni * gridSize + nj
              if (visited[nIdx] || terrainMap[ni][nj] === 2) continue
              visited[nIdx] = 1
              component.push(nIdx)
              stack.push(nIdx)
            }
          }
          if (!bestComponent || component.length > bestComponent.length) bestComponent = component
        }
      }
      if (!bestComponent) return
      const mainland = new Uint8Array(gridSize * gridSize)
      // Plain indexed loop, not for...of: same worker-isolation constraint as above —
      // Babel can compile even a guaranteed-array for...of down to a call to its
      // `_createForOfIteratorHelper` runtime helper, which is equally undefined inside
      // the isolated worker scope.
      for (let componentIndex = 0; componentIndex < bestComponent.length; componentIndex++) {
        mainland[bestComponent[componentIndex]] = 1
      }
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          if (terrainMap[i][j] !== 2 && !mainland[i * gridSize + j]) terrainMap[i][j] = 2
        }
      }
    }
    removeDisconnectedLand()

    function forceOuterWater(): void {
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          if (
            i < borderWaterWidth ||
            j < borderWaterWidth ||
            i >= gridSize - borderWaterWidth ||
            j >= gridSize - borderWaterWidth
          ) {
            terrainMap[i][j] = 2
          }
        }
      }
    }

    function featureCount(baseCount: number): number {
      return Math.max(0, Math.round(baseCount * Math.max(1, gridSize / 144)))
    }

    function randomRange(min: number, max: number, salt: number): number {
      return min + hash(salt * 12.9898 + 78.233, salt * 37.719 + 11.17) * (max - min)
    }

    function randomInt(min: number, max: number, salt: number): number {
      return Math.floor(randomRange(min, max + 1, salt))
    }

    function normalizedShapeDistance(di: number, dj: number, radius: number, shapeIndex: number): number {
      const angle = Math.atan2(dj, di)
      const rx = radius * (shapeIndex === 1 ? 1.35 : shapeIndex === 2 ? 0.85 : 1.05)
      const ry = radius * (shapeIndex === 1 ? 0.85 : shapeIndex === 2 ? 1.25 : 0.95)
      const bend = shapeIndex === 3 ? Math.sin(angle * 2) * radius * 0.18 : 0
      const x = (di + bend) / rx
      const y = (dj - (shapeIndex === 2 ? Math.cos(angle) * radius * 0.12 : 0)) / ry
      return Math.sqrt(x * x + y * y)
    }

    function applyGroundPatch(
      centerI: number,
      centerJ: number,
      radius: number,
      terrainValue: TerrainValue,
      salt: number
    ): void {
      const shapeIndex = randomInt(0, 3, salt + 17)
      const maxRadius = Math.ceil(radius * 1.5)
      for (let di = -maxRadius; di <= maxRadius; di++) {
        for (let dj = -maxRadius; dj <= maxRadius; dj++) {
          const ni = centerI + di
          const nj = centerJ + dj
          if (
            ni < borderWaterWidth + 2 ||
            nj < borderWaterWidth + 2 ||
            ni >= gridSize - borderWaterWidth - 2 ||
            nj >= gridSize - borderWaterWidth - 2 ||
            terrainMap[ni]?.[nj] === 2
          ) {
            continue
          }
          const edge = normalizedShapeDistance(di, dj, radius, shapeIndex)
          const roughness = (hash(ni * 0.73 + salt, nj * 0.73 - salt) - 0.5) * 0.32
          if (edge + roughness <= 1) terrainMap[ni][nj] = terrainValue
        }
      }
    }

    function applyLake(
      centerI: number,
      centerJ: number,
      radius: number,
      shoreRadius: number,
      shoreValue: TerrainValue | null,
      salt: number
    ): void {
      const shapeIndex = randomInt(0, 3, salt + 29)
      const maxRadius = Math.ceil(radius + shoreRadius + 2)
      const lakeCells: Array<[number, number]> = []
      for (let di = -maxRadius; di <= maxRadius; di++) {
        for (let dj = -maxRadius; dj <= maxRadius; dj++) {
          const ni = centerI + di
          const nj = centerJ + dj
          if (
            ni < borderWaterWidth + maxRadius ||
            nj < borderWaterWidth + maxRadius ||
            ni >= gridSize - borderWaterWidth - maxRadius ||
            nj >= gridSize - borderWaterWidth - maxRadius
          ) {
            continue
          }
          const edge = normalizedShapeDistance(di, dj, radius, shapeIndex)
          const roughness = (hash(ni * 0.51 + salt, nj * 0.51 - salt) - 0.5) * 0.28
          if (edge + roughness <= 1) {
            lakeCells.push([ni, nj])
            terrainMap[ni][nj] = 2
          }
        }
      }
      if (!lakeCells.length || shoreValue == null || shoreRadius <= 0) return
      for (let di = -maxRadius; di <= maxRadius; di++) {
        for (let dj = -maxRadius; dj <= maxRadius; dj++) {
          const ni = centerI + di
          const nj = centerJ + dj
          if (
            ni < borderWaterWidth + 2 ||
            nj < borderWaterWidth + 2 ||
            ni >= gridSize - borderWaterWidth - 2 ||
            nj >= gridSize - borderWaterWidth - 2 ||
            terrainMap[ni]?.[nj] === 2
          ) {
            continue
          }
          const edge = normalizedShapeDistance(di, dj, radius, shapeIndex)
          const roughness = (hash(ni * 0.61 + salt, nj * 0.61 - salt) - 0.5) * 0.35
          if (edge > 1 && edge <= 1 + shoreRadius / Math.max(radius, 1) + roughness) terrainMap[ni][nj] = shoreValue
        }
      }
    }

    // Lakes are carved first so patchwork (right below) can see them and steer Dirt
    // clear of any shoreline — Dirt and Desert relief borders look fine on their own,
    // but the two don't compose where they'd have to meet at the same cell.
    const lakes = params.lakes
    if (lakes && lakes.count > 0) {
      const shoreValue = lakes.shoreType ? terrainValueByType[lakes.shoreType] : null
      for (let index = 0; index < featureCount(lakes.count); index++) {
        const salt = 5000 + index * 43
        const margin = borderWaterWidth + Math.ceil(lakes.maxRadius + lakes.shoreRadius) + 5
        const centerI = randomInt(margin, gridSize - margin - 1, salt)
        const centerJ = randomInt(margin, gridSize - margin - 1, salt + 11)
        const radius = randomRange(lakes.minRadius, lakes.maxRadius, salt + 19)
        applyLake(centerI, centerJ, radius, lakes.shoreRadius, shoreValue, salt)
      }
    }

    function hasWaterWithin(centerI: number, centerJ: number, distance: number): boolean {
      const r = Math.ceil(distance)
      const distanceSq = distance * distance
      for (let di = -r; di <= r; di++) {
        for (let dj = -r; dj <= r; dj++) {
          if (di * di + dj * dj > distanceSq) continue
          if (terrainMap[centerI + di]?.[centerJ + dj] === 2) return true
        }
      }
      return false
    }

    const patchwork = params.patchwork
    if (patchwork && patchwork.count > 0) {
      const terrainValue = terrainValueByType[patchwork.terrainType]
      // Desert's own patchwork/lakes use Jungle and are meant to hug water (the oasis
      // look); only Dirt needs to stay clear of the desert-styled water border.
      const requireWaterClearance = patchwork.terrainType === 'Dirt'
      for (let index = 0; index < featureCount(patchwork.count); index++) {
        const salt = 1000 + index * 31
        const margin = borderWaterWidth + Math.ceil(patchwork.maxRadius) + 4
        const radius = randomRange(patchwork.minRadius, patchwork.maxRadius, salt + 13)
        const waterClearance = Math.ceil(radius * 1.5) + 3
        let centerI = 0
        let centerJ = 0
        let placed = false
        for (let attempt = 0; attempt < 12; attempt++) {
          const attemptSalt = salt + attempt * 101
          centerI = randomInt(margin, gridSize - margin - 1, attemptSalt)
          centerJ = randomInt(margin, gridSize - margin - 1, attemptSalt + 7)
          if (!requireWaterClearance || !hasWaterWithin(centerI, centerJ, waterClearance)) {
            placed = true
            break
          }
        }
        if (placed) applyGroundPatch(centerI, centerJ, radius, terrainValue, salt)
      }
    }

    forceOuterWater()

    return terrainMap
  }

  _hasSolidNeighbor(i: number, j: number): boolean {
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (Math.abs(di) + Math.abs(dj) <= 1 && this.map.grid[i + di]?.[j + dj]?.solid) return true
      }
    }
    return false
  }

  _hasWaterNeighbor(i: number, j: number): boolean {
    for (let di = -2; di <= 2; di++) {
      const maxDj = 2 - Math.abs(di)
      for (let dj = -maxDj; dj <= maxDj; dj++) {
        const neighbor = this.map.grid[i + di]?.[j + dj]
        if (neighbor?.category === 'Water' || neighbor?.waterBorder) return true
      }
    }
    return false
  }

  _hasLandNeighborInRange(i: number, j: number, range: number): boolean {
    for (let di = -range; di <= range; di++) {
      const maxDj = range - Math.abs(di)
      for (let dj = -maxDj; dj <= maxDj; dj++) {
        const neighbor = this.map.grid[i + di]?.[j + dj]
        if (neighbor && neighbor.category !== 'Water') return true
      }
    }
    return false
  }

  _gaiaCreateAnimal(options: AnimalOptions): void {
    if (this.map.gaia instanceof Gaia) {
      this.map.gaia.createAnimal(options)
    }
  }

  _placeWaterSet(cell: RuntimeCell): void {
    const nearLand = this._hasLandNeighborInRange(cell.i, cell.j, WATER_SET_DEEP_LAND_MIN_DIST)
    const pool = nearLand ? WATER_SETS : [...WATER_SETS, ...WATER_SETS_DEEP]
    const sheet = this.map.randomItem(pool)
    const texture = getTextureByFrame(sheet, 0, Assets)
    if (!texture) return
    const set: SetSprite = Sprite.from(texture)
    set.label = LABEL_TYPES.set
    set.roundPixels = true
    set.eventMode = 'none'
    set.updateAnchor = true
    set.zIndex = 2
    cell.addChild?.(set)
  }

  generateSets() {
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (this._hasSolidNeighbor(i, j)) continue
        if (!cell.has && !cell.solid && !cell.border && !cell.inclined) {
          const hasWaterNeighbour = this._hasWaterNeighbor(i, j)
          const hasWaterBorderClearance = hasWaterBorderWithin(
            this.map.grid,
            i,
            j,
            WATER_BORDER_PLACEMENT_CLEARANCE
          )
          if (
            cell.category !== 'Water' &&
            !hasWaterNeighbour &&
            !hasWaterBorderClearance &&
            this.map.random() < FLOOR_SET_CHANCE &&
            i > 1 &&
            j > 1 &&
            i < this.map.size &&
            j < this.map.size
          ) {
            let floorSpritesheets
            switch (cell.type) {
              case 'Desert':
                floorSpritesheets = FLOOR_SETS_DESERT
                break
              case 'Jungle':
                floorSpritesheets = FLOOR_SETS_JUNGLE
                break
              default:
                floorSpritesheets = FLOOR_SETS_GRASS
                break
            }
            const randomSpritesheet = this.map.randomItem(floorSpritesheets)
            const texture = getTextureByFrame(randomSpritesheet, 0, Assets)
            const floor: SetSprite = Sprite.from(texture)
            floor.label = LABEL_TYPES.floor
            floor.roundPixels = true
            floor.eventMode = 'none'
            floor.updateAnchor = true
            floor.zIndex = 1
            cell.addChild?.(floor)
          }
          if (
            !hasWaterNeighbour &&
            !hasWaterBorderClearance &&
            cell.category !== 'Water' &&
            this.map.random() < this.map.chanceOfSets
          ) {
            const randomSpritesheet = this.map.randomItem(GROUND_SETS)
            const texture = getTextureByFrame(randomSpritesheet, 0, Assets)
            const rock: SetSprite = Sprite.from(texture)
            rock.label = LABEL_TYPES.set
            rock.roundPixels = true
            rock.eventMode = 'none'
            rock.updateAnchor = true
            rock.zIndex = 2
            cell.addChild?.(rock)
          }
          if (
            !hasWaterNeighbour &&
            !hasWaterBorderClearance &&
            cell.category !== 'Water' &&
            this.map.random() < AMBIENT_ANIMAL_CHANCE
          ) {
            this.placeAmbientAnimalGroup(i, j, this.pickAmbientAnimalType(i, j))
          }
          if (
            this.isShoreWaterCell(i, j) &&
            !cell.has &&
            cell.type !== 'DeepWater' &&
            this.map.random() < WATER_SET_CHANCE
          ) {
            this._placeWaterSet(cell)
          }
        }
      }
    }
  }

  async generateSetsAsync() {
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        const cell = this.map.grid[i][j]
        if (this._hasSolidNeighbor(i, j) || cell.has || cell.solid || cell.border || cell.inclined) continue
        const hasWaterNeighbour = this._hasWaterNeighbor(i, j)
        const hasWaterBorderClearance = hasWaterBorderWithin(this.map.grid, i, j, WATER_BORDER_PLACEMENT_CLEARANCE)
        if (
          cell.category !== 'Water' &&
          !hasWaterNeighbour &&
          !hasWaterBorderClearance &&
          this.map.random() < FLOOR_SET_CHANCE &&
          i > 1 &&
          j > 1 &&
          i < this.map.size &&
          j < this.map.size
        ) {
          const sheets =
            cell.type === 'Desert' ? FLOOR_SETS_DESERT : cell.type === 'Jungle' ? FLOOR_SETS_JUNGLE : FLOOR_SETS_GRASS
          const randomSpritesheet = this.map.randomItem(sheets)
          const texture = getTextureByFrame(randomSpritesheet, 0, Assets)
          if (texture) {
            const floor: SetSprite = Sprite.from(texture)
            floor.label = LABEL_TYPES.floor
            floor.roundPixels = true
            floor.eventMode = 'none'
            floor.updateAnchor = true
            floor.zIndex = 1
            cell.addChild?.(floor)
          }
        }
        if (
          !hasWaterNeighbour &&
          !hasWaterBorderClearance &&
          cell.category !== 'Water' &&
          this.map.random() < this.map.chanceOfSets
        ) {
          const sheet = this.map.randomItem(GROUND_SETS)
          const texture = getTextureByFrame(sheet, 0, Assets)
          if (texture) {
            const rock: SetSprite = Sprite.from(texture)
            rock.label = LABEL_TYPES.set
            rock.roundPixels = true
            rock.eventMode = 'none'
            rock.zIndex = 2
            cell.addChild?.(rock)
          }
        }
        if (
          !hasWaterNeighbour &&
          !hasWaterBorderClearance &&
          cell.category !== 'Water' &&
          this.map.random() < AMBIENT_ANIMAL_CHANCE
        ) {
          this.placeAmbientAnimalGroup(i, j, this.pickAmbientAnimalType(i, j))
        }
        if (
          this.isShoreWaterCell(i, j) &&
          !cell.has &&
          cell.type !== 'DeepWater' &&
          this.map.random() < WATER_SET_CHANCE
        ) {
          this._placeWaterSet(cell)
        }
      }
      const yieldEvery = this.map.pregeneratedBlueprintId ? 32 : 8
      if (i % yieldEvery === 0) await this.yieldToBrowser()
    }
  }

  placePortal(): void {
    const { map } = this
    if ([...map.resources].some(resource => resource.type === PORTAL_RESOURCE_TYPE)) return

    // Same footprint convention as a size-3 building (3x3), matching the structure's visual size.
    const footprintRadius = getBuildingFootprintRadius(PORTAL_FOOTPRINT_SIZE)
    const isValidFootprint = (i: number, j: number, radius: number): boolean => {
      const centerZ = map.grid[i]?.[j]?.z
      if (centerZ === undefined) return false
      const cells = getPlainCellsAroundPoint(i, j, map.grid, radius)
      if (cells.length !== (radius * 2 + 1) ** 2) return false
      return cells.every(
        cell =>
          !cell.solid && !cell.has && cell.category !== 'Water' && !cell.border && !cell.inclined && cell.z === centerZ
      )
    }
    const center = Math.round(map.size / 2)
    const border = 10
    const playerSafeDistanceSq = 15 ** 2
    let position: GridPosition | null = null
    // Prefer breathing room beyond the footprint so it's not immediately hugged by trees/resources,
    // but relax that in dense biomes rather than fail outright — the footprint itself always stays clear.
    for (const clearance of [3, 2, 1, 0]) {
      for (let attempt = 0; attempt < 300; attempt++) {
        const i = attempt === 0 ? center : map.randomRange(border, map.size - border)
        const j = attempt === 0 ? center : map.randomRange(border, map.size - border)
        if (!isValidFootprint(i, j, footprintRadius + clearance)) continue
        const tooCloseToPlayer = map.playersPos.some(
          pos => pos && (pos.i - i) ** 2 + (pos.j - j) ** 2 < playerSafeDistanceSq
        )
        if (tooCloseToPlayer) continue
        position = { i, j }
        break
      }
      if (position) break
    }
    if (!position) return

    const context = runtimeContext(map.context)
    const portal = map.addChild(
      new Resource({ i: position.i, j: position.j, type: PORTAL_RESOURCE_TYPE, size: PORTAL_FOOTPRINT_SIZE }, context)
    )
    map.resources.add(portal)
    getPlainCellsAroundPoint(position.i, position.j, map.grid, footprintRadius, cell => {
      cell.solid = true
      cell.has = portal
      return true
    })
  }

  findPlayerPlaces() {
    const results: GridPosition[] = []
    const N = this.map.positionsCount
    const searchHalf = Math.max(6, Math.floor(this.map.size * 0.06))
    const zoneRadius = this.map.size < 64 ? 2 : 5
    const border = Math.min(12, Math.max(2, Math.floor(this.map.size * 0.08)))
    let minDistance = Math.max(16, Math.floor((this.map.size / Math.max(N, 2)) * 0.55))

    const farEnoughFromOtherSpawns = (position: GridPosition) =>
      results.every(
        existing => !existing || (existing.i - position.i) ** 2 + (existing.j - position.j) ** 2 >= minDistance ** 2
      )

    const canUseCell = (cell: RuntimeCell) => !cell.border && !cell.solid && !cell.inclined && cell.category !== 'Water'

    for (let index = 0; index < N; index++) {
      let found = null

      for (let relaxation = 0; relaxation < 3 && !found; relaxation++) {
        const attempts = 80
        for (let attempt = 0; attempt < attempts && !found; attempt++) {
          const ci = this.map.randomRange(border, this.map.size - border)
          const cj = this.map.randomRange(border, this.map.size - border)
          const candidate = getZoneInGridWithCondition(
            {
              minX: Math.max(border, ci - searchHalf),
              maxX: Math.min(this.map.size - border, ci + searchHalf),
              minY: Math.max(border, cj - searchHalf),
              maxY: Math.min(this.map.size - border, cj + searchHalf),
            },
            this.map.grid,
            zoneRadius,
            canUseCell
          )
          if (candidate && farEnoughFromOtherSpawns(candidate)) found = candidate
        }
        minDistance = Math.max(10, Math.floor(minDistance * 0.75))
      }

      if (!found) {
        found = getZoneInGridWithCondition(
          {
            minX: border,
            maxX: this.map.size - border,
            minY: border,
            maxY: this.map.size - border,
          },
          this.map.grid,
          zoneRadius,
          canUseCell
        )
      }

      if (found) results.push(found)
    }

    return results
  }
}
