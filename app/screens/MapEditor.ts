import type { Application } from 'pixi.js'
import { Assets, Container, type ContainerChild, Sprite } from 'pixi.js'
import Map from '../classes/map'
import { Cell } from '../classes/cell'
import { Resource } from '../classes/Resource'
import { AI, Gaia, Human } from '../classes/players'
import { BUILDING_TYPES, FAMILY_TYPES, LABEL_TYPES, RESOURCE_TYPES } from '../constants'
import { getPlainCellsAroundPoint, getBuildingFootprintRadius, getTextureByFrame, randomItem } from '../lib'
import { getCameraZoom } from '../lib/settings'
import { canPlaceBuildingAt } from '../lib/grid/placement'
import { getAdjacentWalls, isWall, updateWallTexture, type WallBuilding } from '../lib/buildings/walls'
import { EditorControls } from '../controllers/EditorControls'
import { WallPlacementController } from '../controllers/WallPlacementController'
import { MapEditorHud } from '../ui/MapEditorHud'
import { loadPregeneratedMapBlueprint } from '../serialization/MapBlueprintLoader'
import type { GameContextLike, SchedulerLike } from '../types/context'
import type {
  EditorConfig,
  EditorPlayerConfig,
  MapEditorContextLike,
  MapEditorPlacementSelection,
  MapEditorReadyContext,
} from '../types/mapEditor'
import type { RuntimeCell, RuntimeMap } from '../types/map'
import type { AnimalEntity, BuildingEntity, ResourceEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'

type MapInstance = InstanceType<typeof Map> & {
  pregeneratedBlueprintId?: string | number | null
  generationTimings?: Record<string, number>
}

type EditableCell = RuntimeCell & {
  setTerrainType(type: string): void
  children: ContainerChild[]
  addChild(child: ContainerChild): void
  removeChild(child: ContainerChild): void
}

type DestroyableEditorEntity = RuntimeEntity & {
  parent?: { removeChild?: (child: RuntimeEntity) => void } | null
  visibilityTimeout?: ReturnType<typeof setTimeout>
}

type MutableEditorEntity = RuntimeEntity &
  Partial<UnitEntity> &
  Partial<BuildingEntity> &
  Partial<AnimalEntity> &
  DestroyableEditorEntity

type EditorUnitListEntity = UnitEntity | (AnimalEntity & UnitEntity)

type RuntimeEditorContext = MapEditorContextLike & GameContextLike

function runtimeEditorContext(context: MapEditorContextLike): RuntimeEditorContext {
  if (!context.map) throw new Error('Map editor runtime context requires a map')
  return context as RuntimeEditorContext
}

function isResourceEntity(entity: RuntimeEntity | null | undefined): entity is ResourceEntity {
  return entity?.family === FAMILY_TYPES.resource
}

function isUnitEntity(entity: RuntimeEntity | null | undefined): entity is UnitEntity {
  return entity?.family === FAMILY_TYPES.unit
}

function isBuildingEntity(entity: RuntimeEntity | null | undefined): entity is BuildingEntity {
  return entity?.family === FAMILY_TYPES.building
}

function isEditorUnitListEntity(entity: RuntimeEntity | null | undefined): entity is EditorUnitListEntity {
  return entity?.family === FAMILY_TYPES.unit || entity?.family === FAMILY_TYPES.animal
}

const DEFAULT_MAP_SIZE = 120
const MAP_EXPORT_EXT = '.map'
const PLACEMENT_SELECTION_SUPPRESS_MS = 150
const EDITOR_FLOOR_SPRITESHEETS: Record<string, string[]> = {
  Desert: ['environment/floor/desert-4', 'environment/floor/desert-5', 'environment/floor/desert-6', 'environment/floor/desert-7', 'environment/floor/desert-8', 'environment/floor/desert-9', 'environment/floor/desert-10', 'environment/floor/desert-11', 'environment/floor/desert-12'],
  Jungle: ['environment/floor/desert-4', 'environment/floor/desert-5', 'environment/floor/desert-6', 'environment/floor/desert-7', 'environment/floor/grass-1', 'environment/floor/grass-2', 'environment/floor/grass-3', 'environment/floor/grass-4', 'environment/floor/grass-5', 'environment/floor/grass-6', 'environment/floor/grass-7', 'environment/floor/grass-8', 'environment/floor/grass-9', 'environment/floor/grass-10'],
  Grass: ['environment/floor/grass-1', 'environment/floor/grass-2', 'environment/floor/grass-3', 'environment/floor/grass-4', 'environment/floor/grass-5', 'environment/floor/grass-6', 'environment/floor/grass-7', 'environment/floor/grass-8', 'environment/floor/grass-9', 'environment/floor/grass-10'],
}
export default class MapEditor extends Container {
  config: EditorConfig
  onQuit: (() => void) | null
  _orientationBlocked: boolean
  _selectionSuppressedUntil: number
  _terrainStrokeEdits: Set<RuntimeCell> | null
  _onResize: () => void
  editorState: MapEditorContextLike['editorState']
  context: MapEditorContextLike
  wallPlacementController?: WallPlacementController

  constructor(app: Application, gamebox: HTMLElement, config: EditorConfig = {}, onQuit: (() => void) | null = null) {
    super()
    this.config = config
    this.onQuit = onQuit
    this._orientationBlocked = false
    this._selectionSuppressedUntil = 0
    this._terrainStrokeEdits = null
    this._onResize = () => this.applyZoom()
    this.editorState = {
      mode: 'terrain',
      brushType: 'map',
      brushSize: 1,
      mapPaint: 'Grass',
      elevationLevel: 0,
      placementOwnerLabel: null,
      placementType: null,
      placementKind: null,
    }
    this.context = {
      app,
      gamebox,
      editor: this,
      editorConfig: { players: this.config.players ?? [] },
      editorState: this.editorState,
      hud: null,
      map: null,
      controls: null,
      menu: null,
      player: null,
      players: [],
      paused: false,
      pause() {},
      resume() {},
      restart() {},
      save() {},
      load() {},
      quit() {},
      applyZoom: () => this.applyZoom(),
      scheduler: {
        elapsedMs: 0,
        add() {
          return 0
        },
        update() {},
        addOneShot() {
          return 0
        },
        remove() {},
        clear() {},
        destroy() {},
      } as SchedulerLike,
    }

    this.start().catch(error => {
      console.error('Unable to start map editor', error)
    })
  }

  get _map(): MapInstance {
    return this.context.map as MapInstance
  }

  get _readyContext(): MapEditorReadyContext {
    const { context } = this
    if (!context.map || !context.hud || !context.menu || !context.controls || !context.player) {
      throw new Error('Map editor context is not ready')
    }
    return context as MapEditorReadyContext
  }

  async start(): Promise<void> {
    this.context.map = new Map(this.context) as RuntimeMap
    const map = this._map
    map.size = this.config.size || DEFAULT_MAP_SIZE
    map.mapType = this.config.mapType || 'blank'
    map.revealEverything = true
    map.revealTerrain = true
    map.showResources = true
    map.gaia = new Gaia(runtimeEditorContext(this.context))
    await this._createInitialMap()

    const hud = new MapEditorHud({
      context: runtimeEditorContext(this.context),
      state: this.editorState,
      onQuit: () => this.quit(),
      onChange: () => this.context.hud?.sync(),
    })
    this.context.hud = hud
    this.context.menu = hud

    const controls = new EditorControls({ ...runtimeEditorContext(this.context), hud })
    this.context.controls = controls
    this.wallPlacementController = new WallPlacementController({
      context: runtimeEditorContext(this.context),
      parent: map,
      getPreviewPosition: (cell: RuntimeCell) => ({ x: cell.x, y: cell.y }),
      canUseCell: (cell: RuntimeCell, owner: PlayerLike, allowExistingWall: boolean = false) =>
        this._canWallUseCell(cell, owner, allowExistingWall),
      onCommit: (path: RuntimeCell[], owner: PlayerLike) => this._commitWallPath(path, owner),
      onChange: () => this.context.hud?.sync(),
    })

    this.addChild(map as ContainerChild)
    this.addChild(controls)
    this.applyZoom()
    this.context.hud.init()
    window.addEventListener('resize', this._onResize)
  }

  canPaintTerrain(): boolean {
    return this.editorState.mode === 'terrain'
  }

  canSelectEntities(): boolean {
    return this.editorState.mode === 'units'
  }

  async _createInitialMap(): Promise<void> {
    const map = this._map
    map.removeChildren()
    map.grid = []
    map.resources = new Set()
    map.invalidateReliefCoastDistances()

    if (map.mapType !== 'blank') {
      const blueprint = await loadPregeneratedMapBlueprint({
        size: map.size,
        positionsCount: this.config.players?.length || undefined,
      })

      if (blueprint) {
        map.generateEditableFromBlueprint(blueprint)
        map.pregeneratedBlueprintId = blueprint.id
        map.generationTimings = blueprint.timings || {}
        this._initializeEditorPlayers()
        for (let i = 0; i <= map.size; i++) {
          for (let j = 0; j <= map.size; j++) {
            map.grid[i][j].visible = true
          }
        }
        map.ready = true
        this.refreshTerrainAppearance()
        this.refreshTerrainSets()
        return
      }

      map.pregeneratedBlueprintId = null
      map.generateCells()
      this._initializeEditorPlayers()
      map.generateMapRelief()
      this._populateGeneratedMap()
      for (let i = 0; i <= map.size; i++) {
        for (let j = 0; j <= map.size; j++) {
          map.grid[i][j].visible = true
        }
      }
      map.ready = true
      this.refreshTerrainAppearance()
      return
    }

    for (let i = 0; i <= map.size; i++) {
      map.grid[i] = []
      for (let j = 0; j <= map.size; j++) {
        const cell = new Cell({ i, j, z: 0, type: 'Grass' }, this.context as ConstructorParameters<typeof Cell>[1])
        cell.visible = true
        map.addChild(cell)
        map.grid[i][j] = cell
      }
    }

    this._initializeEditorPlayers()
    this._applyMapFixture()
    map.ready = true
    this.refreshTerrainAppearance()
    this.refreshTerrainSets()
  }

  _initializeEditorPlayers(): void {
    const map = this._map
    const runtimeContext = runtimeEditorContext(this.context)
    const configuredPlayers: EditorPlayerConfig[] = this.config.players?.length
      ? this.config.players
      : [{ name: 'Player 1', color: 'blue', civ: 'Greek', team: null, isHuman: true }]
    const anchors = this._getEditorPlayerAnchors(configuredPlayers.length)
    const players: PlayerLike[] = []

    configuredPlayers.forEach((config: EditorPlayerConfig, index: number) => {
      const anchor = anchors[index] || anchors[0]
      const baseOptions = {
        name: config.name || `Player ${index + 1}`,
        i: anchor.i,
        j: anchor.j,
        age: Math.max(0, Math.min(Number(config.age) || 0, 1)),
        civ: config.civ || 'Greek',
        color: config.color || 'blue',
        team: config.team ?? null,
      }
      const player =
        index === 0 || config.isHuman
          ? new Human({ ...baseOptions, isPlayed: index === 0 }, runtimeContext)
          : new AI({ ...baseOptions, difficulty: map.difficulty }, runtimeContext)
      players.push(player)
    })

    this.context.player = players.find(player => player.isPlayed) || players[0]
    this.context.players = players
    const gaia = new Gaia(runtimeContext)
    map.gaia = gaia
    gaia.name = 'Gaia'
  }

  _getEditorPlayerAnchors(count: number = 1): { i: number; j: number }[] {
    const map = this._map
    const size = map.size
    const playersPos = map.playersPos as { i: number; j: number }[]
    if (Array.isArray(playersPos) && playersPos.length >= count) {
      return playersPos.slice(0, count)
    }

    const center = Math.floor(size / 2)
    const offset = Math.max(6, Math.floor(size * 0.22))
    return [
      { i: center, j: center },
      { i: Math.max(2, center - offset), j: Math.max(2, center - offset) },
      { i: Math.min(size - 2, center + offset), j: Math.max(2, center - offset) },
      { i: Math.max(2, center - offset), j: Math.min(size - 2, center + offset) },
      { i: Math.min(size - 2, center + offset), j: Math.min(size - 2, center + offset) },
    ]
  }

  _populateGeneratedMap(): void {
    const map = this._map
    map.playersPos = map.findPlayerPlaces()

    const forestAnchors = map.playersPos.length
      ? map.playersPos
      : [
          { i: Math.floor(map.size * 0.3), j: Math.floor(map.size * 0.3) },
          { i: Math.floor(map.size * 0.7), j: Math.floor(map.size * 0.7) },
        ]

    for (const anchor of forestAnchors) {
      if (!anchor) continue
      map.generateForestAroundPlayer(anchor, map.size * 4)
    }

    const neutralForestCenters: { i: number; j: number }[] = []
    const neutralForestGroups = Math.max(4, Math.round(map.size / 24))
    for (let index = 0; index < neutralForestGroups; index++) {
      const center = map.findNeutralResourceCenter(map.playersPos, neutralForestCenters, 24, 18)
      if (!center) break
      if (map.placeResourceGroupAt(center, RESOURCE_TYPES.tree, 14, 4)) {
        neutralForestCenters.push(center)
      }
    }

    map.generateSets()
  }

  _applyMapFixture(): void {
    if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return
    const fixture = new URLSearchParams(window.location.search).get('mapFixture')
    if (
      !['water-borders', 'water-flat-pinches', 'water-flat-overlap', 'water-land-replacement'].includes(
        fixture as string
      )
    ) {
      return
    }

    const map = this._map
    if (fixture === 'water-land-replacement') {
      const waterCells = [
        [4, 2],
        [4, 3],
        [4, 4],
        [4, 5],
        [5, 3],
        [5, 4],
        [5, 5],
        [5, 6],
        [6, 3],
        [6, 4],
        [6, 5],
        [7, 3],
        [7, 4],
        [7, 5],
        [8, 3],
        [8, 5],
        [9, 4],
        [9, 9],
        [10, 4],
        [10, 5],
        [10, 6],
        [10, 7],
        [10, 8],
        [11, 4],
        [11, 5],
        [11, 6],
        [11, 7],
        [11, 8],
        [12, 8],
        [13, 8],
      ]
      for (const [i, j] of waterCells) (map.grid[i]?.[j] as EditableCell | undefined)?.setTerrainType('Water')
      return
    }

    if (fixture === 'water-flat-overlap') {
      ;(map.grid[4]?.[9] as EditableCell | undefined)?.setTerrainType('Water')
      ;(map.grid[6]?.[8] as EditableCell | undefined)?.setTerrainType('Water')
      return
    }

    if (fixture === 'water-flat-pinches') {
      const waterCells = [
        [2, 12],
        [3, 11],
        [3, 12],
        [3, 13],
        [4, 6],
        [4, 10],
        [4, 11],
        [4, 12],
        [4, 13],
        [4, 14],
        [5, 5],
        [5, 6],
        [5, 7],
        [5, 11],
        [5, 12],
        [5, 13],
        [6, 4],
        [6, 5],
        [6, 6],
        [6, 7],
        [6, 8],
        [6, 11],
        [6, 12],
        [6, 13],
        [7, 5],
        [7, 6],
        [7, 7],
        [7, 11],
        [7, 12],
        [7, 13],
        [8, 6],
        [8, 10],
        [8, 11],
        [8, 12],
        [8, 13],
        [8, 14],
        [9, 11],
        [9, 12],
        [9, 13],
        [10, 12],
      ]

      for (const [i, j] of waterCells) (map.grid[i]?.[j] as EditableCell | undefined)?.setTerrainType('Water')
      return
    }

    const patterns = [
      {
        center: [4, 4],
        level: -2,
        offsets: [
          [0, 0],
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ],
      },
      {
        center: [4, 12],
        level: 0,
        offsets: [
          [0, 0],
          [1, 0],
          [0, -1],
          [1, -1],
        ],
      },
      {
        center: [11, 4],
        level: 3,
        offsets: [
          [0, 0],
          [0, 1],
          [1, 0],
        ],
      },
      {
        center: [11, 11],
        level: 1,
        offsets: [
          [0, 0],
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
          [1, 1],
        ],
      },
    ]

    for (const {
      center: [ci, cj],
      level,
      offsets,
    } of patterns) {
      for (let i = Math.max(0, ci - 4); i <= Math.min(map.size, ci + 4); i++) {
        for (let j = Math.max(0, cj - 4); j <= Math.min(map.size, cj + 4); j++) {
          const distance = Math.max(Math.abs(i - ci), Math.abs(j - cj))
          const targetLevel = level + Math.sign(-level) * Math.max(0, distance - 2)
          map.setCellReliefLevelDirect(map.grid[i][j], Math.max(-4, Math.min(4, targetLevel)))
        }
      }

      for (const [di, dj] of offsets) {
        const cell = map.grid[ci + di]?.[cj + dj]
        if (!cell) continue
        map.setCellReliefLevelDirect(cell, level)
        ;(cell as EditableCell).setTerrainType('Water')
      }
    }
  }

  applyZoom(): void {
    const zoom = getCameraZoom()
    this.scale.set(zoom)
    this.position.set(
      (this.context.app.screen.width * (1 - zoom)) / 2,
      (this.context.app.screen.height * (1 - zoom)) / 2
    )
    this.context.hud?.updateCameraMiniMap()
  }

  quit(): void {
    if (typeof this.onQuit === 'function') {
      this.onQuit()
    }
  }

  exportMap(): void {
    const exportedPlayers = (
      (this.config.players?.length ? this.config.players : this.context.players) as ((
        | EditorPlayerConfig
        | PlayerLike
      ) & {
        isHuman?: boolean
        isPlayed?: boolean
      })[]
    ).map(player => {
      const isHuman = Boolean(player.isHuman ?? player.isPlayed)
      return {
        name: player.name,
        color: player.color,
        civ: player.civ,
        age: Math.max(0, Math.min(Number((player as EditorPlayerConfig).age) || 0, 1)),
        team: player.team ?? null,
        isHuman,
      }
    })

    const map = this._map
    const payload = {
      format: 'map',
      version: 1,
      name: this.config.name || 'map',
      size: map.size,
      mapType: this.config.mapType || 'blank',
      seed: map.seed,
      players: exportedPlayers,
      cells: map.grid.map((line: RuntimeCell[]) =>
        line.map(cell => ({
          type: cell.type,
          z: cell.z,
        }))
      ),
      resources: [...map.resources].map((resource: RuntimeEntity) => ({
        type: resource.type,
        i: resource.i,
        j: resource.j,
      })),
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(payload.name || 'map').replace(/[\\/:]/g, '-')}${MAP_EXPORT_EXT}`
    a.click()
    URL.revokeObjectURL(url)
  }

  setOrientationBlocked(blocked: boolean): void {
    this._orientationBlocked = blocked
  }

  updatePlayersConfig(players: EditorPlayerConfig[]): void {
    const previousPlayers = [...(this.context.players ?? [])]
    const previousGaia = this._map.gaia
    this.config.players = players.map(player => ({ ...player }))
    this.context.editorConfig.players = this.config.players
    this.context.player?.unselectAll?.()
    this._initializeEditorPlayers()
    this._syncOwnedEntities(previousPlayers, previousGaia)
    if (!this.getPlacementOwners().some(owner => owner.label === this.editorState.placementOwnerLabel)) {
      this.clearPlacementSelection()
    }
    this.context.hud?.setActionTarget()
  }

  _syncOwnedEntities(previousPlayers: PlayerLike[], previousGaia: PlayerLike | null | undefined): void {
    for (let index = 0; index < previousPlayers.length; index++) {
      const previousOwner = previousPlayers[index]
      const nextOwner = (this.context.players ?? [])[index]
      if (!previousOwner) continue

      if (nextOwner) {
        this._transferOwnedInstances(previousOwner, nextOwner)
      } else {
        this._removeOwnedInstances(previousOwner)
      }
    }

    const map = this._map
    if (previousGaia && map.gaia && previousGaia !== map.gaia) {
      this._transferOwnedInstances(previousGaia, map.gaia)
    }
  }

  _collectOwnedInstances(owner: PlayerLike | null | undefined): RuntimeEntity[] {
    const instances = new Set<RuntimeEntity>([
      ...(owner?.units || []),
      ...(owner?.animals || []),
      ...(owner?.buildings || []),
      ...(owner?.corpses || []),
    ])

    for (const row of this._map.grid) {
      if (!row) continue
      for (const cell of row) {
        if (!cell?.corpses?.size) continue
        for (const corpse of cell.corpses) {
          if (corpse?.owner?.label === owner?.label) {
            instances.add(corpse)
          }
        }
      }
    }

    return [...instances].filter(Boolean)
  }

  _transferOwnedInstances(previousOwner: PlayerLike, nextOwner: PlayerLike): void {
    const instances = this._collectOwnedInstances(previousOwner)
    nextOwner.units = []
    nextOwner.buildings = []
    nextOwner.corpses = []
    nextOwner.population = 0

    for (const instance of instances) {
      const entity = instance as MutableEditorEntity
      if (!entity || entity.isDestroyed) continue
      entity.owner = nextOwner
      if (isBuildingEntity(entity) && !entity.isDead) {
        nextOwner.buildings.push(entity)
      } else if (entity.isDead || entity.currentSheet === 'corpseSheet') {
        if (isEditorUnitListEntity(entity)) nextOwner.corpses.push(entity)
      } else if (isEditorUnitListEntity(entity)) {
        nextOwner.units.push(entity)
        nextOwner.population++
      }
    }
  }

  _removeOwnedInstances(owner: PlayerLike): void {
    const instances = this._collectOwnedInstances(owner)
    for (const instance of instances) {
      this._hardRemoveInstance(instance)
    }
  }

  _hardRemoveInstance(instance: RuntimeEntity | null | undefined): void {
    if (!instance || instance.isDestroyed) return
    const entity = instance as MutableEditorEntity

    const map = this._map
    entity.stopInterval?.()
    entity.stopAttackInterval?.()
    entity.stopTimeout?.()
    clearTimeout(entity.visibilityTimeout)
    entity.unselect?.()
    entity.path = []
    entity.dest = null
    entity.realDest = null
    entity.pendingOrder = null
    entity.action = null
    entity.eventMode = 'none'
    entity.isDestroyed = true
    map.removeFromInstanceBucket(entity)

    if (isBuildingEntity(entity)) {
      const dist = getBuildingFootprintRadius(entity.size ?? 1)
      getPlainCellsAroundPoint(entity.i, entity.j, map.grid, dist, (cell: RuntimeCell) => {
        if (cell.has === entity) {
          cell.has = null
          cell.solid = false
        }
        cell.corpses.delete(entity)
        return true
      })
    } else {
      const cell = map.grid[instance.i]?.[instance.j]
      if (cell?.has === entity) {
        cell.has = null
        cell.solid = false
      }
      cell?.corpses?.delete(entity)
    }

    if (entity.family === FAMILY_TYPES.animal || isUnitEntity(entity)) {
      const ownerList =
        entity.isDead || entity.currentSheet === 'corpseSheet' ? entity.owner?.corpses : entity.owner?.units
      const index = isEditorUnitListEntity(entity) ? ownerList?.indexOf(entity) ?? -1 : -1
      if (index >= 0) ownerList?.splice(index, 1)
    }

    if (isBuildingEntity(entity)) {
      const index = entity.owner?.buildings?.indexOf(entity) ?? -1
      if (index >= 0) entity.owner?.buildings.splice(index, 1)
    }

    entity.parent?.removeChild?.(entity)
    entity.destroy?.({
      children: true,
      texture: entity.family !== FAMILY_TYPES.building,
    })
  }

  removeEntity(instance: RuntimeEntity): boolean {
    if (!instance || instance.isDestroyed) return false
    const removedWall = this._isWall(instance)
    const adjacentWalls =
      removedWall && instance.owner ? this._getAdjacentWalls(instance.i, instance.j, instance.owner) : []
    this.context.player?.unselectAll?.()
    this._hardRemoveInstance(instance)
    adjacentWalls.forEach(wall => this._updateWallTexture(wall))
    this.context.hud?.setActionTarget()
    this.context.hud?.updateResourcesMiniMap()
    return true
  }

  getPlacementOwners(): PlayerLike[] {
    return [...(this.context.players ?? []), this._map.gaia].filter((owner): owner is PlayerLike =>
      Boolean(owner)
    )
  }

  setPlacementSelection(ownerLabel: string | null, type: string | null, kind: string | null): void {
    this.cancelWallDraft()
    this.editorState.placementOwnerLabel = ownerLabel ?? null
    this.editorState.placementType = type ?? null
    this.editorState.placementKind = kind ?? null
    this.context.controls?.entityPreview?.set(this.getPlacementSelection())
    this.context.hud?.sync()
  }

  clearPlacementSelection(): void {
    this.setPlacementSelection(null, null, null)
  }

  hasWallDraft(): boolean {
    return Boolean(this.wallPlacementController?.active)
  }

  isWallPlacementSelected(): boolean {
    const selection = this.getPlacementSelection()
    return selection?.kind === 'building' && selection.type === BUILDING_TYPES.smallWall
  }

  _isWall(
    instance: RuntimeEntity | null | undefined,
    owner: PlayerLike | null = null
  ): instance is BuildingEntity & WallBuilding {
    return instance?.family === FAMILY_TYPES.building && isWall(instance, owner)
  }

  _canWallUseCell(
    cell: RuntimeCell | null | undefined,
    owner: PlayerLike | null,
    allowExistingWall: boolean = false
  ): boolean {
    if (!cell || cell.category === 'Water' || cell.waterBorder || cell.inclined || cell.border) return false
    if (!cell.has && !cell.solid) return true
    return allowExistingWall && this._isWall(cell.has, owner)
  }

  handleWallMapClick(cell: RuntimeCell): boolean {
    if (!this.canSelectEntities() || !this.isWallPlacementSelected()) return false
    const selection = this.getPlacementSelection()
    if (!selection) return true
    this._selectionSuppressedUntil = Date.now() + PLACEMENT_SELECTION_SUPPRESS_MS
    this.wallPlacementController?.handleClick(cell, selection.owner)
    return true
  }

  updateWallDraft(cell: RuntimeCell): boolean {
    return this.wallPlacementController?.update(cell) || false
  }

  _commitWallPath(path: RuntimeCell[], owner: PlayerLike): boolean {
    if (!path.length) return false
    const affected = new Set<WallBuilding>()

    path.forEach(cell => {
      if (this._isWall(cell.has, owner)) {
        affected.add(cell.has)
        return
      }
      if (!this._canWallUseCell(cell, owner)) return
      const wall = owner.createBuilding({
        i: cell.i,
        j: cell.j,
        type: BUILDING_TYPES.smallWall,
        isBuilt: true,
      })
      if (this._isWall(wall, owner)) affected.add(wall)
    })

    for (const wall of affected) {
      this._getAdjacentWalls(wall.i, wall.j, owner).forEach(neighbour => affected.add(neighbour))
    }
    affected.forEach(wall => this._updateWallTexture(wall))
    this.context.hud?.updateResourcesMiniMap()
    this.refreshTerrainAppearance()
    return affected.size > 0
  }

  _getAdjacentWalls(i: number, j: number, owner: PlayerLike): WallBuilding[] {
    return getAdjacentWalls(this._map.grid, i, j, owner)
  }

  _updateWallTexture(wall: WallBuilding): void {
    updateWallTexture(wall)
  }

  cancelWallDraft(): boolean {
    return this.wallPlacementController?.cancel() || false
  }

  getPlacementSelection(): MapEditorPlacementSelection | null {
    const { placementOwnerLabel, placementType, placementKind } = this.editorState
    if (!placementOwnerLabel || !placementType || !placementKind) return null
    const owner = this.getPlacementOwners().find(candidate => candidate.label === placementOwnerLabel)
    if (!owner) return null
    return { owner, type: placementType, kind: placementKind }
  }

  handleEntityInteraction(instance: RuntimeEntity): boolean {
    if (!this.canSelectEntities()) {
      return true
    }

    if (Date.now() < this._selectionSuppressedUntil) {
      return true
    }

    const { player, hud } = this.context
    this.clearPlacementSelection()
    player?.unselectAll?.()
    instance.select?.()
    hud?.setActionTarget(instance)
    if (!player) return true

    switch (instance.family) {
      case FAMILY_TYPES.unit:
        if (isUnitEntity(instance) && instance.owner?.isPlayed) {
          player.selectedUnit = instance
          player.selectedUnits = [instance]
        } else {
          player.selectedOther = instance
        }
        break
      case FAMILY_TYPES.building:
        if (isBuildingEntity(instance) && instance.owner?.isPlayed) {
          player.selectedBuilding = instance
        } else {
          player.selectedOther = instance
        }
        break
      default:
        player.selectedOther = instance
        break
    }

    return true
  }

  handleUnitsModeMapClick(cell: RuntimeCell): boolean {
    if (!this.canSelectEntities() || !cell) return false

    const selection = this.getPlacementSelection()
    if (!selection) {
      this.context.player?.unselectAll?.()
      this.context.hud?.setActionTarget()
      return false
    }

    return this.spawnSelectedEntityAt(cell, selection)
  }

  spawnSelectedEntityAt(
    cell: RuntimeCell,
    selection: MapEditorPlacementSelection | null = this.getPlacementSelection()
  ): boolean {
    if (!cell || !selection) return false
    const { owner, type, kind } = selection
    const suppressSelection = () => {
      this._selectionSuppressedUntil = Date.now() + PLACEMENT_SELECTION_SUPPRESS_MS
    }

    switch (kind) {
      case 'building':
        return this._spawnBuildingAt(cell, owner, type, suppressSelection)
      case 'unit':
        return this._spawnUnitAt(cell, owner, type, suppressSelection)
      case 'animal':
        return this._spawnAnimalAt(cell, type, suppressSelection)
      default:
        return false
    }
  }

  _spawnBuildingAt(cell: RuntimeCell, owner: PlayerLike, type: string, onSpawn: (() => void) | null = null): boolean {
    const config = owner.config?.buildings?.[type]
    if (
      !config ||
      !canPlaceBuildingAt(this._map.grid, cell.i, cell.j, { ...config, type })
    ) {
      return false
    }
    owner.createBuilding({ i: cell.i, j: cell.j, type, isBuilt: true })
    onSpawn?.()
    this.refreshTerrainAppearance()
    return true
  }

  _spawnUnitAt(cell: RuntimeCell, owner: PlayerLike, type: string, onSpawn: (() => void) | null = null): boolean {
    const unitConfig = owner.config?.units?.[type]
    if (!unitConfig || !this._canSpawnMobileAt(cell)) return false
    owner.createUnit?.({ i: cell.i, j: cell.j, type })
    onSpawn?.()
    this.context.hud?.updateResourcesMiniMap()
    return true
  }

  _spawnAnimalAt(cell: RuntimeCell, type: string, onSpawn: (() => void) | null = null): boolean {
    if (!this._canSpawnMobileAt(cell)) return false
    const { gaia } = this._map
    if (gaia instanceof Gaia) {
      gaia.createAnimal({ i: cell.i, j: cell.j, type })
    }
    onSpawn?.()
    this.context.hud?.updateResourcesMiniMap()
    return true
  }

  _canSpawnMobileAt(cell: RuntimeCell | null | undefined): boolean {
    if (!cell || cell.has || cell.solid || cell.border) return false
    return cell.category !== 'Water' && !cell.waterBorder && !cell.inclined
  }

  getBrushCells(centerCell: RuntimeCell): RuntimeCell[] {
    const radius = Math.max(0, this.editorState.brushSize - 1)
    const cells: RuntimeCell[] = []
    for (let di = -radius; di <= radius; di++) {
      for (let dj = -radius; dj <= radius; dj++) {
        if (di * di + dj * dj > radius * radius) continue
        const cell = this._map.grid[centerCell.i + di]?.[centerCell.j + dj]
        if (cell) cells.push(cell)
      }
    }
    return cells
  }

  applyBrush(centerCell: RuntimeCell): void {
    if (this._orientationBlocked) return

    const cells = this.getBrushCells(centerCell)
    const reliefEdits = new Set<RuntimeCell>()
    let terrainDirty = false
    let resourceDirty = false

    if (this.editorState.brushType === 'map') {
      for (const cell of cells) {
        this._clearTerrainSetDecorations(cell)
      }
    }

    for (const cell of cells) {
      switch (this.editorState.brushType) {
        case 'map':
          {
            const result = this.applyMapPaint(cell, centerCell.z)
            if (result.terrainChanged) {
              this._terrainStrokeEdits?.add(cell)
              terrainDirty = true
            }
            if (result.resourceChanged) {
              resourceDirty = true
            }
          }
          break
        case 'elevation':
          if (this.setRelief(cell, this.editorState.elevationLevel)) {
            reliefEdits.add(cell)
            terrainDirty = true
          }
          break
      }
    }

    if (terrainDirty) {
      this.refreshTerrainAppearance(reliefEdits)
    } else if (resourceDirty) {
      this.syncResourceSprites()
      this.context.hud?.updateResourcesMiniMap()
    }

    if (this.editorState.brushType === 'map') {
      this.refreshTerrainSets(cells)
    }
  }

  beginTerrainStroke(): void {
    this._terrainStrokeEdits = new Set()
  }

  finishTerrainStroke(): void {
    const edits = this._terrainStrokeEdits
    this._terrainStrokeEdits = null
    if (!edits?.size) return

    this._map.normalizeWaterTopology(null, null, edits)
    this.refreshTerrainAppearance()
    this.refreshTerrainSets([...edits])
  }

  _getMapPaintTerrain(): string {
    switch (this.editorState.mapPaint) {
      case 'forest':
        return 'Grass'
      case 'palmdesert':
        return 'Desert'
      case 'palmjungle':
        return 'Jungle'
      default:
        return this.editorState.mapPaint
    }
  }

  _mapPaintWantsForest(): boolean {
    return ['forest', 'palmdesert', 'palmjungle'].includes(this.editorState.mapPaint)
  }

  applyMapPaint(cell: RuntimeCell, waterLevel: number = 0): { terrainChanged: boolean; resourceChanged: boolean } {
    if (!cell) return { terrainChanged: false, resourceChanged: false }

    const targetTerrain = this._getMapPaintTerrain()
    const wantsForest = this._mapPaintWantsForest()
    let terrainChanged = false
    let resourceChanged = false

    if (this.setTerrainType(cell, targetTerrain, waterLevel)) {
      terrainChanged = true
    }

    if (wantsForest) {
      resourceChanged = this.placeForest(cell) || resourceChanged
    } else {
      resourceChanged = this.eraseEntity(cell) || resourceChanged
    }

    return { terrainChanged, resourceChanged }
  }

  setTerrainType(cell: RuntimeCell, type: string, waterLevel: number = 0): boolean {
    if (!cell) return false
    if (cell.type === type) {
      if (type !== 'Water' || cell.z === waterLevel) return false
      this._map.setCellReliefLevelDirect(cell, waterLevel)
      return true
    }
    if (cell.has && type === 'Water') {
      cell.has.die?.(true)
    }
    if (type === 'Water' && cell.z !== waterLevel) {
      this._map.setCellReliefLevelDirect(cell, waterLevel)
    }
    ;(cell as EditableCell).setTerrainType(type)
    if (isResourceEntity(cell.has) && cell.has.type === RESOURCE_TYPES.tree) {
      cell.has.refreshTextureForTerrain?.()
    }
    return true
  }

  setRelief(cell: RuntimeCell, level: number): boolean {
    if (!cell) return false
    const nextLevel = Math.max(-4, Math.min(4, Number(level) || 0))
    if (nextLevel === cell.z) return false
    this._map.setCellReliefLevelDirect(cell, nextLevel)
    return true
  }

  placeForest(cell: RuntimeCell): boolean {
    if (!cell || cell.type === 'Water' || cell.waterBorder || cell.has || cell.inclined) return false

    const map = this._map
    const resource = new Resource({ i: cell.i, j: cell.j, type: RESOURCE_TYPES.tree }, runtimeEditorContext(this.context))
    resource.eventMode = 'none'
    if (resource.sprite) {
      resource.sprite.eventMode = 'none'
    }
    resource.visible = true
    map.addChild(resource)
    map.resources.add(resource)
    resource.syncWithCell()
    return true
  }

  eraseEntity(cell: RuntimeCell): boolean {
    if (!cell?.has) return false
    const resource = cell.has
    const map = this._map
    map.resources.delete(resource)
    map.removeFromInstanceBucket(resource)
    resource.clear?.()
    return true
  }

  refreshTerrainAppearance(protectedReliefCells: Set<RuntimeCell> = new Set()): void {
    const map = this._map

    map.rebuildTerrainAppearance(protectedReliefCells)
    this.syncResourceSprites()
    this.context.hud?.revealTerrainMinimap()
    this.context.hud?.updateResourcesMiniMap()
  }

  refreshTerrainSets(changedCells: RuntimeCell[] | null = null): void {
    const targetCells: RuntimeCell[] = changedCells?.length
      ? [...new Set(changedCells.filter(Boolean))]
      : this._map.grid.flat().filter(Boolean)

    for (const cell of targetCells) {
      this._clearTerrainSetDecorations(cell)
    }

    for (const cell of targetCells) {
      this._applyTerrainSetDecorations(cell)
    }
  }

  _clearTerrainSetDecorations(cell: RuntimeCell): void {
    if (!cell) return
    const editableCell = cell as EditableCell

    for (let index = editableCell.children.length - 1; index >= 0; index--) {
      const child = editableCell.children[index]
      if (child?.label !== LABEL_TYPES.floor && child?.label !== LABEL_TYPES.set) continue
      editableCell.removeChild(child)
      child.destroy?.()
    }
  }

  _applyTerrainSetDecorations(cell: RuntimeCell): void {
    if (!cell || !this._canDecorateTerrainCell(cell)) return

    if (Math.random() < 0.03) {
      this._addFloorDecoration(cell)
    }
    if (Math.random() < this._map.chanceOfSets) {
      this._addSetDecoration(cell)
    }
  }

  _canDecorateTerrainCell(cell: RuntimeCell): boolean {
    if (!cell || cell.has || cell.solid || cell.border || cell.inclined || cell.category === 'Water') {
      return false
    }

    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (Math.abs(di) + Math.abs(dj) > 1) continue
        if (this._map.grid[cell.i + di]?.[cell.j + dj]?.solid) return false
      }
    }

    for (let di = -2; di <= 2; di++) {
      const maxDj = 2 - Math.abs(di)
      for (let dj = -maxDj; dj <= maxDj; dj++) {
        const neighbor = this._map.grid[cell.i + di]?.[cell.j + dj]
        if (neighbor?.category === 'Water' || neighbor?.waterBorder) return false
      }
    }

    const { size } = this._map
    return cell.i > 1 && cell.j > 1 && cell.i < size && cell.j < size
  }

  _addFloorDecoration(cell: RuntimeCell): void {
    const sheets = EDITOR_FLOOR_SPRITESHEETS[cell.type] || EDITOR_FLOOR_SPRITESHEETS.Grass
    const randomSpritesheet = randomItem(sheets)
    if (!randomSpritesheet) return
    const texture = getTextureByFrame(randomSpritesheet, 0, Assets)
    if (!texture) return

    const floor = Sprite.from(texture) as Sprite & { updateAnchor?: boolean }
    floor.label = LABEL_TYPES.floor
    floor.roundPixels = true
    floor.eventMode = 'none'
    floor.updateAnchor = true
    floor.zIndex = 1
    ;(cell as EditableCell).addChild(floor)
  }

  _addSetDecoration(cell: RuntimeCell): void {
    const randomSpritesheet = randomItem(['environment/ground/stone-set-1', 'environment/ground/stone-set-2', 'environment/ground/stone-set-3', 'environment/ground/stone-set-4'])
    if (!randomSpritesheet) return
    const texture = getTextureByFrame(randomSpritesheet, 0, Assets)
    if (!texture) return

    const set = Sprite.from(texture) as Sprite & { updateAnchor?: boolean }
    set.label = LABEL_TYPES.set
    set.roundPixels = true
    set.eventMode = 'none'
    set.updateAnchor = true
    set.zIndex = 11
    ;(cell as EditableCell).addChild(set)
  }

  syncResourceSprites(): void {
    for (const resource of this._map.resources) {
      resource.syncWithCell?.()
    }
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    window.removeEventListener('resize', this._onResize)
    this.context.controls?.destroy({ children: true })
    this.context.hud?.destroy()
    ;(this.context.map as MapInstance | null)?.destroy({ children: true })
    super.destroy(options)
  }
}
