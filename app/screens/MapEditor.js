import { Assets, Container, Sprite } from 'pixi.js'
import Map from '../classes/map'
import { Cell } from '../classes/cell'
import { Resource } from '../classes/resource'
import { AI, Gaia, Human } from '../classes/players'
import { FAMILY_TYPES, LABEL_TYPES, RESOURCE_TYPES } from '../constants'
import { getPlainCellsAroundPoint, randomItem } from '../lib'
import { getCameraZoom } from '../lib/settings'
import { canPlaceBuildingAt } from '../lib/grid/placement'
import { EditorControls } from '../controllers/EditorControls'
import { MapEditorHud } from '../ui/MapEditorHud'

const DEFAULT_MAP_SIZE = 120
const MAP_EXPORT_EXT = '.rtsmap'
const PLACEMENT_SELECTION_SUPPRESS_MS = 150
const EDITOR_FLOOR_SPRITESHEETS = {
  Desert: ['275', '276', '277', '278', '303', '304', '305', '306', '307'],
  Jungle: ['275', '276', '277', '278', '292', '293', '294', '295', '296', '297', '298', '299', '300', '301'],
  Grass: ['292', '293', '294', '295', '296', '297', '298', '299', '300', '301'],
}
export default class MapEditor extends Container {
  constructor(app, gamebox, config = {}, onQuit = null) {
    super()
    this.config = config
    this.onQuit = onQuit
    this._orientationBlocked = false
    this._selectionSuppressedUntil = 0
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
      editorConfig: this.config,
      editorState: this.editorState,
      hud: null,
      map: null,
      controls: null,
      menu: null,
      player: null,
      players: [],
      paused: false,
      aiPaused: true,
      pause() {},
      resume() {},
      restart() {},
      save() {},
      load() {},
      applyZoom: () => this.applyZoom(),
      scheduler: {
        add() {
          return null
        },
        remove() {},
        clear() {},
        destroy() {},
      },
    }

    this.start()
  }

  start() {
    this.context.map = new Map(this.context)
    this.context.map.size = this.config.size || DEFAULT_MAP_SIZE
    this.context.map.mapType = this.config.mapType || 'blank'
    this.context.map.revealEverything = true
    this.context.map.revealTerrain = true
    this.context.map.showResources = true
    this.context.map.gaia = new Gaia(this.context)
    this._createInitialMap()

    this.context.hud = new MapEditorHud({
      context: this.context,
      state: this.editorState,
      onQuit: () => this.quit(),
      onChange: () => this.context.hud?.sync(),
    })
    this.context.menu = this.context.hud

    this.context.controls = new EditorControls(this.context)

    this.addChild(this.context.map)
    this.addChild(this.context.controls)
    this.applyZoom()
    this.context.hud.init()
    window.addEventListener('resize', this._onResize)
  }

  canPaintTerrain() {
    return this.editorState.mode === 'terrain'
  }

  canSelectEntities() {
    return this.editorState.mode === 'units'
  }

  _createInitialMap() {
    const { map } = this.context
    map.removeChildren()
    map.grid = []
    map.resources = new Set()
    map.invalidateReliefCoastDistances()

    if (map.mapType !== 'blank') {
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
        const cell = new Cell({ i, j, z: 0, type: 'Grass' }, this.context)
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

  _initializeEditorPlayers() {
    const { map } = this.context
    const configuredPlayers = this.config.players?.length
      ? this.config.players
      : [{ name: 'Player 1', color: 'blue', civ: 'Greek', team: null, isHuman: true }]
    const anchors = this._getEditorPlayerAnchors(configuredPlayers.length)
    const players = []

    configuredPlayers.forEach((config, index) => {
      const anchor = anchors[index] || anchors[0]
      const baseOptions = {
        name: config.name || `Player ${index + 1}`,
        i: anchor.i,
        j: anchor.j,
        age: 0,
        civ: config.civ || 'Greek',
        color: config.color || 'blue',
        team: config.team ?? null,
      }
      const player =
        index === 0 || config.isHuman
          ? new Human({ ...baseOptions, isPlayed: index === 0 }, this.context)
          : new AI({ ...baseOptions, difficulty: config.difficulty || 'medium' }, this.context)
      players.push(player)
    })

    this.context.player = players.find(player => player.isPlayed) || players[0] || null
    this.context.players = players
    map.gaia = new Gaia(this.context)
    map.gaia.name = 'Gaia'
  }

  _getEditorPlayerAnchors(count = 1) {
    const { map } = this.context
    const size = map.size
    if (Array.isArray(map.playersPos) && map.playersPos.length >= count) {
      return map.playersPos.slice(0, count)
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

  _populateGeneratedMap() {
    const { map } = this.context
    map.playersPos = map.findPlayerPlaces()

    const forestAnchors = map.playersPos.length
      ? map.playersPos
      : [
          { i: Math.floor(map.size * 0.3), j: Math.floor(map.size * 0.3) },
          { i: Math.floor(map.size * 0.7), j: Math.floor(map.size * 0.7) },
        ]

    for (const anchor of forestAnchors) {
      map.generateForestAroundPlayer(anchor, map.size * 4)
    }

    const neutralForestCenters = []
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

  _applyMapFixture() {
    if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return
    const fixture = new URLSearchParams(window.location.search).get('mapFixture')
    if (!['water-borders', 'water-flat-pinches', 'water-flat-overlap'].includes(fixture)) return

    const { map } = this.context
    if (fixture === 'water-flat-overlap') {
      map.grid[4]?.[9]?.setTerrainType('Water')
      map.grid[6]?.[8]?.setTerrainType('Water')
      map.normalizeWaterTopology()
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

      for (const [i, j] of waterCells) map.grid[i]?.[j]?.setTerrainType('Water')
      map.normalizeWaterTopology()
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
        cell.setTerrainType('Water')
      }
    }
  }

  applyZoom() {
    const zoom = getCameraZoom()
    this.scale.set(zoom)
    this.position.set(
      (this.context.app.screen.width * (1 - zoom)) / 2,
      (this.context.app.screen.height * (1 - zoom)) / 2
    )
    this.context.hud?.updateCameraMiniMap()
  }

  quit() {
    if (typeof this.onQuit === 'function') {
      this.onQuit()
    }
  }

  exportMap() {
    const exportedPlayers = (this.config.players?.length ? this.config.players : this.context.players).map(player => {
      const isHuman = Boolean(player.isHuman ?? player.isPlayed)
      return {
        name: player.name,
        color: player.color,
        civ: player.civ,
        team: player.team ?? null,
        isHuman,
        difficulty: isHuman ? undefined : player.difficulty || 'medium',
      }
    })

    const payload = {
      format: 'rts-map',
      version: 1,
      name: this.config.name || 'map',
      size: this.context.map.size,
      mapType: this.config.mapType || 'blank',
      seed: this.context.map.seed,
      players: exportedPlayers,
      cells: this.context.map.grid.map(line =>
        line.map(cell => ({
          type: cell.type,
          z: cell.z,
        }))
      ),
      resources: [...this.context.map.resources].map(resource => ({
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

  setOrientationBlocked(blocked) {
    this._orientationBlocked = blocked
  }

  updatePlayersConfig(players) {
    const previousPlayers = [...this.context.players]
    const previousGaia = this.context.map.gaia
    this.config.players = players.map(player => ({ ...player }))
    this.context.editorConfig.players = this.config.players
    this.context.player?.unselectAll?.()
    this._initializeEditorPlayers()
    this._syncOwnedEntities(previousPlayers, previousGaia)
    if (!this.getPlacementOwners().some(owner => owner.label === this.editorState.placementOwnerLabel)) {
      this.clearPlacementSelection()
    }
    this.context.hud?.setBottombar()
  }

  _syncOwnedEntities(previousPlayers, previousGaia) {
    for (let index = 0; index < previousPlayers.length; index++) {
      const previousOwner = previousPlayers[index]
      const nextOwner = this.context.players[index]
      if (!previousOwner) continue

      if (nextOwner) {
        this._transferOwnedInstances(previousOwner, nextOwner)
      } else {
        this._removeOwnedInstances(previousOwner)
      }
    }

    if (previousGaia && this.context.map.gaia && previousGaia !== this.context.map.gaia) {
      this._transferOwnedInstances(previousGaia, this.context.map.gaia)
    }
  }

  _collectOwnedInstances(owner) {
    const instances = new Set([...(owner?.units || []), ...(owner?.buildings || []), ...(owner?.corpses || [])])

    for (const row of this.context.map.grid) {
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

  _transferOwnedInstances(previousOwner, nextOwner) {
    const instances = this._collectOwnedInstances(previousOwner)
    nextOwner.units = []
    nextOwner.buildings = []
    nextOwner.corpses = []
    nextOwner.population = 0

    for (const instance of instances) {
      if (!instance || instance.isDestroyed) continue
      instance.owner = nextOwner
      if (instance.family === FAMILY_TYPES.building && !instance.isDead) {
        nextOwner.buildings.push(instance)
      } else if (instance.isDead || instance.currentSheet === 'corpseSheet') {
        nextOwner.corpses.push(instance)
      } else {
        nextOwner.units.push(instance)
        nextOwner.population++
      }
    }
  }

  _removeOwnedInstances(owner) {
    const instances = this._collectOwnedInstances(owner)
    for (const instance of instances) {
      this._hardRemoveInstance(instance)
    }
  }

  _hardRemoveInstance(instance) {
    if (!instance || instance.isDestroyed) return

    const { map } = this.context
    instance.stopInterval?.()
    instance.stopAttackInterval?.()
    instance.stopTimeout?.()
    clearTimeout(instance.visibilityTimeout)
    instance.unselect?.()
    instance.path = []
    instance.dest = null
    instance.realDest = null
    instance.pendingOrder = null
    instance.action = null
    instance.eventMode = 'none'
    instance.isDestroyed = true
    map.removeFromInstanceBucket(instance)

    if (instance.family === FAMILY_TYPES.building) {
      const dist = instance.size === 3 ? 1 : 0
      getPlainCellsAroundPoint(instance.i, instance.j, map.grid, dist, cell => {
        if (cell.has === instance) {
          cell.has = null
          cell.solid = false
        }
        cell.corpses.delete(instance)
      })
    } else {
      const cell = map.grid[instance.i]?.[instance.j]
      if (cell?.has === instance) {
        cell.has = null
        cell.solid = false
      }
      cell?.corpses?.delete(instance)
    }

    if (instance.family === FAMILY_TYPES.animal || instance.family === FAMILY_TYPES.unit) {
      const ownerList =
        instance.isDead || instance.currentSheet === 'corpseSheet' ? instance.owner?.corpses : instance.owner?.units
      const index = ownerList?.indexOf(instance) ?? -1
      if (index >= 0) ownerList.splice(index, 1)
    }

    if (instance.family === FAMILY_TYPES.building) {
      const index = instance.owner?.buildings?.indexOf(instance) ?? -1
      if (index >= 0) instance.owner.buildings.splice(index, 1)
    }

    instance.parent?.removeChild?.(instance)
    instance.destroy({ children: true, texture: instance.family !== FAMILY_TYPES.building })
  }

  removeEntity(instance) {
    if (!instance || instance.isDestroyed) return false
    this.context.player?.unselectAll?.()
    this._hardRemoveInstance(instance)
    this.context.hud?.setBottombar()
    this.context.hud?.updateResourcesMiniMap()
    return true
  }

  getPlacementOwners() {
    return [...this.context.players, this.context.map.gaia].filter(Boolean)
  }

  setPlacementSelection(ownerLabel, type, kind) {
    this.editorState.placementOwnerLabel = ownerLabel ?? null
    this.editorState.placementType = type ?? null
    this.editorState.placementKind = kind ?? null
    this.context.hud?.sync()
  }

  clearPlacementSelection() {
    this.setPlacementSelection(null, null, null)
  }

  getPlacementSelection() {
    const { placementOwnerLabel, placementType, placementKind } = this.editorState
    if (!placementOwnerLabel || !placementType || !placementKind) return null
    const owner = this.getPlacementOwners().find(candidate => candidate.label === placementOwnerLabel)
    if (!owner) return null
    return { owner, type: placementType, kind: placementKind }
  }

  handleEntityInteraction(instance) {
    if (!this.canSelectEntities()) {
      return true
    }

    if (Date.now() < this._selectionSuppressedUntil) {
      return true
    }

    const { player, hud } = this.context
    this.clearPlacementSelection()
    player?.unselectAll?.()
    instance.select()
    hud?.setBottombar(instance)

    switch (instance.family) {
      case FAMILY_TYPES.unit:
        if (instance.owner?.isPlayed) {
          player.selectedUnit = instance
          player.selectedUnits = [instance]
        } else {
          player.selectedOther = instance
        }
        break
      case FAMILY_TYPES.building:
        if (instance.owner?.isPlayed) {
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

  handleUnitsModeMapClick(cell) {
    if (!this.canSelectEntities() || !cell) return false

    const selection = this.getPlacementSelection()
    if (!selection) {
      this.context.player?.unselectAll?.()
      this.context.hud?.setBottombar()
      return false
    }

    return this.spawnSelectedEntityAt(cell, selection)
  }

  spawnSelectedEntityAt(cell, selection = this.getPlacementSelection()) {
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

  _spawnBuildingAt(cell, owner, type, onSpawn = null) {
    const config = owner.config?.buildings?.[type]
    if (!config || !canPlaceBuildingAt(this.context.map.grid, cell.i, cell.j, config)) return false
    owner.createBuilding({ i: cell.i, j: cell.j, type, isBuilt: true })
    onSpawn?.()
    this.refreshTerrainAppearance()
    return true
  }

  _spawnUnitAt(cell, owner, type, onSpawn = null) {
    const unitConfig = owner.config?.units?.[type]
    if (!unitConfig || !this._canSpawnMobileAt(cell, unitConfig.category === 'Boat')) return false
    owner.createUnit({ i: cell.i, j: cell.j, type })
    onSpawn?.()
    this.context.hud?.updateResourcesMiniMap()
    return true
  }

  _spawnAnimalAt(cell, type, onSpawn = null) {
    if (!this._canSpawnMobileAt(cell, false)) return false
    this.context.map.gaia.createAnimal({ i: cell.i, j: cell.j, type })
    onSpawn?.()
    this.context.hud?.updateResourcesMiniMap()
    return true
  }

  _canSpawnMobileAt(cell, isBoat = false) {
    if (!cell || cell.has || cell.solid || cell.border) return false
    if (isBoat) {
      return cell.category === 'Water' || cell.waterBorder
    }
    return cell.category !== 'Water' && !cell.waterBorder && !cell.inclined
  }

  getBrushCells(centerCell) {
    const radius = Math.max(0, this.editorState.brushSize - 1)
    const cells = []
    for (let di = -radius; di <= radius; di++) {
      for (let dj = -radius; dj <= radius; dj++) {
        if (di * di + dj * dj > radius * radius) continue
        const cell = this.context.map.grid[centerCell.i + di]?.[centerCell.j + dj]
        if (cell) cells.push(cell)
      }
    }
    return cells
  }

  applyBrush(centerCell) {
    if (this._orientationBlocked) return

    const cells = this.getBrushCells(centerCell)
    const reliefEdits = new Set()
    const waterEdit =
      this.editorState.brushType === 'map' && this._getMapPaintTerrain() === 'Water'
        ? { level: centerCell.z, seeds: new Set() }
        : null
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
            const result = this.applyMapPaint(cell, waterEdit?.level)
            if (result.terrainChanged) {
              if (waterEdit) waterEdit.seeds.add(cell)
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
      this.refreshTerrainAppearance(reliefEdits, waterEdit)
    } else if (resourceDirty) {
      this.syncResourceSprites()
      this.context.hud?.updateResourcesMiniMap()
    }

    if (this.editorState.brushType === 'map') {
      this.refreshTerrainSets(cells)
    }
  }

  _getMapPaintTerrain() {
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

  _mapPaintWantsForest() {
    return ['forest', 'palmdesert', 'palmjungle'].includes(this.editorState.mapPaint)
  }

  applyMapPaint(cell, waterLevel = 0) {
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

  setTerrainType(cell, type, waterLevel = 0) {
    if (!cell) return false
    if (cell.type === type) {
      if (type !== 'Water' || cell.z === waterLevel) return false
      this.context.map.setCellReliefLevelDirect(cell, waterLevel)
      return true
    }
    if (cell.has && type === 'Water') {
      cell.has.die?.(true)
    }
    if (type === 'Water' && cell.z !== waterLevel) {
      this.context.map.setCellReliefLevelDirect(cell, waterLevel)
    }
    cell.setTerrainType(type)
    if (cell.has?.type === RESOURCE_TYPES.tree) {
      cell.has.refreshTextureForTerrain()
    }
    return true
  }

  setRelief(cell, level) {
    if (!cell) return false
    const nextLevel = Math.max(-4, Math.min(4, Number(level) || 0))
    if (nextLevel === cell.z) return false
    this.context.map.setCellReliefLevelDirect(cell, nextLevel)
    return true
  }

  placeForest(cell) {
    if (!cell || cell.type === 'Water' || cell.waterBorder || cell.has) return false

    const resource = new Resource({ i: cell.i, j: cell.j, type: RESOURCE_TYPES.tree }, this.context)
    resource.eventMode = 'none'
    resource.allowClick = false
    resource.allowMove = false
    if (resource.sprite) {
      resource.sprite.eventMode = 'none'
    }
    resource.visible = true
    this.context.map.addChild(resource)
    this.context.map.resources.add(resource)
    resource.syncWithCell()
    return true
  }

  eraseEntity(cell) {
    if (!cell?.has) return false
    const resource = cell.has
    this.context.map.resources.delete(resource)
    this.context.map.removeFromInstanceBucket(resource)
    resource.clear()
    return true
  }

  refreshTerrainAppearance(protectedReliefCells = new Set(), waterEdit = null) {
    const { map } = this.context

    const filledWater = map.fillWaterGaps(waterEdit?.level)
    if (waterEdit) {
      for (const cell of filledWater) waterEdit.seeds.add(cell)
      const normalizedWater = map.normalizeWaterTopology(waterEdit.level, waterEdit.seeds)
      for (const cell of normalizedWater) waterEdit.seeds.add(cell)
      for (const cell of map.fillWaterGaps(waterEdit.level)) waterEdit.seeds.add(cell)
      map.flattenWaterComponents(waterEdit.seeds, waterEdit.level)
    }

    map.rebuildTerrainAppearance(protectedReliefCells)
    this.syncResourceSprites()
    this.context.hud?.revealTerrainMinimap()
    this.context.hud?.updateResourcesMiniMap()
  }

  refreshTerrainSets(changedCells = null) {
    const targetCells = changedCells?.length
      ? [...new Set(changedCells.filter(Boolean))]
      : this.context.map.grid.flat().filter(Boolean)

    for (const cell of targetCells) {
      this._clearTerrainSetDecorations(cell)
    }

    for (const cell of targetCells) {
      this._applyTerrainSetDecorations(cell)
    }
  }

  _clearTerrainSetDecorations(cell) {
    if (!cell) return

    for (let index = cell.children.length - 1; index >= 0; index--) {
      const child = cell.children[index]
      if (child?.label !== LABEL_TYPES.floor && child?.label !== LABEL_TYPES.set) continue
      cell.removeChild(child)
      child.destroy?.()
    }
  }

  _applyTerrainSetDecorations(cell) {
    if (!cell || !this._canDecorateTerrainCell(cell)) return

    if (Math.random() < 0.03) {
      this._addFloorDecoration(cell)
    }
    if (Math.random() < this.context.map.chanceOfSets) {
      this._addSetDecoration(cell)
    }
  }

  _canDecorateTerrainCell(cell) {
    if (!cell || cell.has || cell.solid || cell.border || cell.inclined || cell.category === 'Water') {
      return false
    }

    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (Math.abs(di) + Math.abs(dj) > 1) continue
        if (this.context.map.grid[cell.i + di]?.[cell.j + dj]?.solid) return false
      }
    }

    for (let di = -2; di <= 2; di++) {
      const maxDj = 2 - Math.abs(di)
      for (let dj = -maxDj; dj <= maxDj; dj++) {
        const neighbor = this.context.map.grid[cell.i + di]?.[cell.j + dj]
        if (neighbor?.category === 'Water' || neighbor?.waterBorder) return false
      }
    }

    return cell.i > 1 && cell.j > 1 && cell.i < this.context.map.size && cell.j < this.context.map.size
  }

  _addFloorDecoration(cell) {
    const sheets = EDITOR_FLOOR_SPRITESHEETS[cell.type] || EDITOR_FLOOR_SPRITESHEETS.Grass
    const randomSpritesheet = randomItem(sheets)
    const spritesheet = Assets.cache.get(randomSpritesheet)
    const texture = spritesheet?.textures?.[`000_${randomSpritesheet}.png`]
    if (!texture) return

    const floor = Sprite.from(texture)
    floor.label = LABEL_TYPES.floor
    floor.roundPixels = true
    floor.allowMove = false
    floor.eventMode = 'none'
    floor.allowClick = false
    floor.updateAnchor = true
    floor.zIndex = 1
    cell.addChild(floor)
  }

  _addSetDecoration(cell) {
    const randomSpritesheet = randomItem(['531', '532', '533', '534'])
    const spritesheet = Assets.cache.get(randomSpritesheet)
    const texture = spritesheet?.textures?.[`000_${randomSpritesheet}.png`]
    if (!texture) return

    const set = Sprite.from(texture)
    set.label = LABEL_TYPES.set
    set.roundPixels = true
    set.allowMove = false
    set.eventMode = 'none'
    set.allowClick = false
    set.updateAnchor = true
    set.zIndex = 11
    cell.addChild(set)
  }

  syncResourceSprites() {
    for (const resource of this.context.map.resources) {
      resource.syncWithCell()
    }
  }

  destroy(options) {
    window.removeEventListener('resize', this._onResize)
    this.context.controls?.destroy({ children: true })
    this.context.hud?.destroy()
    this.context.map?.destroy({ children: true })
    super.destroy(options)
  }
}
