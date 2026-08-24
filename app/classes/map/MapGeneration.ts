import { Assets } from 'pixi.js'
import { Resource } from '../Resource'
import { Human, AI, Gaia, Player } from '../players'
import {
  colors,
  getZoneInGridWithCondition,
  updateInstanceVisibility,
  getGaiaAnimals,
  getBuildingFootprintCells,
  getBuildingFootprintRadius,
  getPlainCellsAroundPoint,
} from '../../lib'
import { rehydrateAIKnowledge } from '../../services/FogOfWar'
import { getIdealSpawnRangeForMapSize } from '../../config/mapSizes'
import {
  BUILDING_TYPES,
  FAMILY_TYPES,
  PLAYER_TYPES,
  POPULATION_MAX,
  RESOURCE_TYPES,
  UNIT_TYPES,
  getEnvironmentTerrainParams,
} from '../../constants'
import { Cell, GenerationCell } from '../cell'
import { MapBlueprintGeneration } from './MapBlueprintGeneration'
import type { GridPosition } from '../../types/grid'
import type { RuntimeCell } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import type { PlayerOptions } from '../players/Player'
import type { ResourceOptions } from '../Resource'
import type { AnimalOptions } from '../animal'
import type { ResourceEntity, BuildingEntity } from '../../types/entities'
import type { GameContextLike } from '../../types/context'
import {
  processUnit,
  restoreAIState,
  restoreBuildingAssignments,
  restorePlayerEntitiesFromSave,
  restorePlayerViewsAndFog,
  restoreSelection,
} from './MapSaveRestore'
import { generateTerrainMap } from './MapTerrainGeneration'
import { ensureBanditCampOwner, placeBanditCamps } from './BanditCampGeneration'
import { applyCivilizationLevelStartingKit } from './CivilizationStartingKit'
import {
  canPlaceAmbientAnimalAt,
  createSpawnSearchCell,
  generateAmbientAnimalSets,
  generateAmbientAnimalSetsAsync,
  getAmbientAnimalProfile,
  pickAmbientAnimalType,
  placeAmbientAnimalGroup,
  type AmbientAnimalProfile,
} from './AmbientAnimalGeneration'
import type { SaveEntityState } from '../../types/save'
import {
  createGenerationTimer,
  type GaiaRespawnSlot,
  type GameConfig,
  type GenerateMapOptions,
  type GenerationTimer,
  type MapBlueprint,
  type MapGenerationContext,
  type MapGenerationMap,
  type ProgressCallback,
  type SavedGameData,
  type TerrainValue,
  type TerrainGrid,
} from './MapGenerationTypes'
import type { EnvironmentTerrainParams } from '../../constants'
import type { SavedPlayer } from './MapSaveRestore'
export type {
  CellDefinition,
  GenerateMapOptions,
  MapBlueprint,
  MapGenerationContext,
  MapGenerationMap,
  ProgressCallback,
  SavedGameData,
  TerrainGrid,
} from './MapGenerationTypes'

// Unowned, indestructible landmark: exactly one is placed per map, never tied to any player.
const PORTAL_RESOURCE_TYPE = 'Portal'
const PORTAL_FOOTPRINT_SIZE = 3
const STARTING_CIVILIAN_GENDERS: Array<'male' | 'female'> = ['male', 'male', 'female', 'female']
function createGaiaRespawnSlot(animal: SaveEntityState, context: GameContextLike, owner: PlayerLike): GaiaRespawnSlot {
  return {
    ...animal,
    context,
    family: FAMILY_TYPES.animal,
    isDestroyed: true,
    owner,
  }
}


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
  const resourceState =
    resource.type === RESOURCE_TYPES.wheat && resource.currentFrame == null && resource.startsMature == null
      ? { ...resource, startsMature: true }
      : resource
  const instance = map.addChild(new Resource(resourceState, runtimeContext(map.context)))
  if (instance.type === PORTAL_RESOURCE_TYPE) {
    getBuildingFootprintCells(instance.i, instance.j, map.grid, instance.size || PORTAL_FOOTPRINT_SIZE, cell => {
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
    const source = generateTerrainMap.toString()
    const functionSource = source.startsWith('function') ? `(${source})` : `(function ${source})`
    const workerSource = `
      const generateTerrain = ${functionSource};
      self.onmessage = ({ data }) => {
        try {
          self.postMessage(generateTerrain(data.gridSize, data.seed, data.params));
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
    return pickAmbientAnimalType({
      animals: gameConfig().animals,
      biome: this.map.grid[i]?.[j]?.type ?? '',
      isInPlayerStartSafeZone: radius => this.isInPlayerStartSafeZone(i, j, radius),
      random: () => this.map.random(),
    })
  }

  getAmbientAnimalProfile(type: string): AmbientAnimalProfile {
    return getAmbientAnimalProfile(type)
  }

  canPlaceAmbientAnimalAt(i: number, j: number): boolean {
    return canPlaceAmbientAnimalAt(this.map, i, j, {
      hasWaterNeighbor: () => this._hasWaterNeighbor(i, j),
      isInPlayerStartSafeZone: radius => this.isInPlayerStartSafeZone(i, j, radius),
    })
  }

  placeAmbientAnimalGroup(i: number, j: number, type: string): void {
    placeAmbientAnimalGroup(this.map, i, j, type, {
      canPlace: (i, j) => this.canPlaceAmbientAnimalAt(i, j),
      createAnimal: options => this._gaiaCreateAnimal(options),
    })
  }

  isShoreWaterCell(i: number, j: number): boolean {
    const cell = this.map.grid[i]?.[j]
    return Boolean(cell?.category === 'Water' && this._hasLandNeighborInRange(i, j, 1))
  }

  restoreSavedPlayers(players: SavedPlayer[], runtime?: SavedGameData['runtime']): void {
    const classMap: Record<string, typeof Human | typeof AI | typeof Player> = {
      Human,
      AI,
      [PLAYER_TYPES.bandits]: Player,
    }
    const context = runtimeContext(this.map.context)
    this.map.context.players = players.map((player: SavedPlayer) => {
      const PlayerClass = classMap[player.type] ?? Player
      const restoredPlayer = new PlayerClass(
        {
          ...player,
          corpses: [],
          buildings: [],
          units: [],
          ...(player.type === PLAYER_TYPES.ai ? { difficulty: this.map.difficulty } : {}),
        },
        context
      )
      if (player.isPlayed) this.map.context.player = restoredPlayer
      return restoredPlayer
    })
    if (Number.isFinite(runtime?.elapsedMs) && this.map.context.scheduler) {
      this.map.context.scheduler.elapsedMs = Math.max(0, runtime?.elapsedMs ?? 0)
    }
  }

  restoreSavedResources(resources: SaveEntityState[], naturalResourceRespawnSlots?: SaveEntityState[]): void {
    this.map.resources = new Set(resources.map(resource => createResourceFromState(resource, this.map)))
    this.map.naturalResourceRespawnSlots = [...(naturalResourceRespawnSlots ?? [])]
  }

  restoreSavedEntities(players: SavedPlayer[], animals: SaveEntityState[], context: GameContextLike): void {
    this.map.context.players.forEach((player, index) => restorePlayerEntitiesFromSave(player, players[index]))
    const gaia = this.map.gaia instanceof Gaia ? this.map.gaia : null
    animals.forEach(animal => {
      if (!gaia) return
      if (animal.isDestroyed) (gaia.animals as unknown as GaiaRespawnSlot[]).push(createGaiaRespawnSlot(animal, context, gaia))
      else gaia.createAnimal(animal)
    })

    getGaiaAnimals(gaia)
      .filter(animal => !animal.isDestroyed)
      .forEach(animal => processUnit(animal, this.map))

    this.map.context.players.forEach((player, index) => {
      const savedPlayer = players[index]
      restorePlayerViewsAndFog(player, this.map)
      restoreBuildingAssignments(player, savedPlayer?.buildings || [], this.map)
      rehydrateAIKnowledge(player, this.map)
      restoreAIState(player, savedPlayer, this.map)
      player.units.forEach(unit => processUnit(unit, this.map))
      restoreSelection(player, savedPlayer, this.map)
    })
  }

  finishSavedStateRestore({ bakeTerrain = false }: { bakeTerrain?: boolean } = {}): void {
    this.map._fogInitComplete = true
    this.map._flushFogQueue()
    if (bakeTerrain) this.map.bakeTerrainToChunks()
    this.map.ready = true
  }

  async setInitialFogCells(yieldEvery: number): Promise<number> {
    const fogCellsStartedAt = performance.now()
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        this.map.grid[i][j].setFog()
      }
      if (i % yieldEvery === 0) await this.yieldToBrowser()
    }
    return performance.now() - fogCellsStartedAt
  }

  generateFromJSON(data: SavedGameData): void {
    const { map, players, camera, resources, naturalResourceRespawnSlots, animals, runtime } = data
    const context = runtimeContext(this.map.context)
    const { menu, controls } = context
    this.map.removeChildren()
    this.map.clearRenderChunks()
    this.map.resetRandom()
    this.map.size = map.length - 1
    this.map.invalidateReliefCoastDistances()

    this.restoreSavedPlayers(players, runtime)

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
    this.restoreSavedResources(resources, naturalResourceRespawnSlots)

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

    this.restoreSavedEntities(players, animals, context)
    this.finishSavedStateRestore({ bakeTerrain: true })
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
    this.map.naturalResourceRespawnSlots = []
    this.map.instanceBuckets = null
    this.map.context.players = []
    this.map.context.player = null
    this.map.gaia = new Gaia(runtimeContext(this.map.context))
  }

  applySavedStateToGeneratedMap(data: SavedGameData): void {
    const { players, camera, resources, naturalResourceRespawnSlots, animals, runtime } = data
    const context = runtimeContext(this.map.context)
    const { menu, controls } = context

    this.clearGeneratedGameplayState()
    this.restoreSavedPlayers(players, runtime)

    this.restoreSavedResources(resources, naturalResourceRespawnSlots)

    controls?.setCamera?.(camera.x, camera.y, true)
    menu?.init?.()
    menu?.updateResourcesMiniMap()

    this.restoreSavedEntities(players, animals, context)
    this.finishSavedStateRestore()
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

    const { timings, measure, measureAsync } = createGenerationTimer(this.map.generationTimings || {})

    await this.prepareBaseTerrain(context, { timings, measure }, onProgress)
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
    measure('banditCampPlacement', () => this.placeBanditCamps())
    measure('portalPlacement', () => this.placePortal())
    await onProgress('generatingDecorations', 0.74)
    await measureAsync('decorations', () => this.generateSetsAsync())
    for (const viewer of this.map.context.players || []) {
      rehydrateAIKnowledge(viewer, this.map)
    }
    await onProgress('generatingFog', 0.86)
    measure('fogInit', () => this.map._initFogChunks())

    if (!this.map.revealEverything) {
      const yieldEvery = this.map.pregeneratedBlueprintId ? 32 : 12
      timings.fogCells = await this.setInitialFogCells(yieldEvery)
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
    const { timings, measure, measureAsync } = createGenerationTimer(this.map.generationTimings || {})

    await this.prepareBaseTerrain(context, { timings, measure }, onProgress)
    await onProgress('generatingFog', 0.72)
    measure('fogInit', () => this.map._initFogChunks())

    if (!this.map.revealEverything) {
      timings.fogCells = await this.setInitialFogCells(16)
    }

    this.map._fogInitComplete = true
    this.map._flushFogQueue()
    await onProgress('finalizingWorld', 0.92)
    await measureAsync('terrainBake', () => this.map.bakeTerrainToChunks())
    this.map.ready = true
    this.map.generationTimings = timings
  }

  async prepareBaseTerrain(
    context: GameContextLike,
    timer: Pick<GenerationTimer, 'measure' | 'timings'>,
    onProgress: ProgressCallback
  ): Promise<void> {
    this.map.gaia = new Gaia(context)
    if (this.map.pregeneratedBlueprintId) {
      timer.timings.relief = 0
    } else {
      await onProgress('generatingRelief', 0.28)
      timer.measure('relief', () => this.map.generateMapRelief())
    }
    await this.yieldToBrowser()
    timer.measure('terrainRendering', () => this.map.rebuildTerrainAppearance())
  }

  applyStartingBonuses(player: PlayerLike, configuredAge: number | null = null): void {
    const age = configuredAge == null ? this.map.startingAge : configuredAge
    const startingAge = Math.max(0, Math.min(Number(age) || 0, 3))
    player.age = startingAge

    if (!this.map.allTechnologies) return

    player.autoTechnologyByAge = true
    player.applyEligibleTechnologies?.()
  }

  generatePlayers(playersConfig: Array<PlayerOptions> | null = null): PlayerLike[] {
    const context = runtimeContext(this.map.context)

    const players: PlayerLike[] = []
    this.map.banditCampPositions = []
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
          this.map.banditCampPositions.push({ i: posI, j: posJ })
        }
      }
    }

    if (!this.map.noAI && this.map.banditCampPositions.length) {
      const anchor = this.map.banditCampPositions[0]
      const human = players.find(player => player.isPlayed)
      ensureBanditCampOwner(this.map, context, anchor, human?.civ ?? 'Greek', players)
    }

    players
      .filter(player => player.type !== PLAYER_TYPES.bandits)
      .forEach((player, index) =>
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
      if (player.type === PLAYER_TYPES.bandits) continue
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

  placeBanditCamps(): void {
    placeBanditCamps(this.map, runtimeContext(this.map.context))
  }

  // Spawns a player already at an advanced stage: extra economy/military buildings, a static wall
  // perimeter, consistent technologies, a resource cushion and a few soldiers stationed near home.
  // Building/unit counts are read straight from the AI's own long-term per-age targets
  // (MAX_BUILDING_BY_AGE, MAX_*_BY_AGE) so no new tuning numbers are invented here.
  applyCivilizationLevelStartingKit(player: PlayerLike, level: number, townCenter: BuildingEntity): void {
    applyCivilizationLevelStartingKit(this.map, player, level, townCenter)
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
      7: 'Snow',
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
      7: 'Snow',
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
    const { seed: resolvedSeed, terrain } = generateTerrainMap(gridSize, seed, params)
    this.map.seed = resolvedSeed
    return terrain
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

  generateSets() {
    generateAmbientAnimalSets(this.map, {
      hasSolidNeighbor: (i, j) => this._hasSolidNeighbor(i, j),
      hasWaterNeighbor: (i, j) => this._hasWaterNeighbor(i, j),
      pickType: (i, j) => this.pickAmbientAnimalType(i, j),
      placeGroup: (i, j, type) => this.placeAmbientAnimalGroup(i, j, type),
    })
  }

  async generateSetsAsync() {
    await generateAmbientAnimalSetsAsync(this.map, {
      hasSolidNeighbor: (i, j) => this._hasSolidNeighbor(i, j),
      hasWaterNeighbor: (i, j) => this._hasWaterNeighbor(i, j),
      pickType: (i, j) => this.pickAmbientAnimalType(i, j),
      placeGroup: (i, j, type) => this.placeAmbientAnimalGroup(i, j, type),
      yieldToBrowser: () => this.yieldToBrowser(),
    })
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
    getBuildingFootprintCells(position.i, position.j, map.grid, PORTAL_FOOTPRINT_SIZE, cell => {
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
