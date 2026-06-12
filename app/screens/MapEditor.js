import { Container } from 'pixi.js'
import Map from '../classes/map'
import { Cell } from '../classes/cell'
import { Resource } from '../classes/resource'
import { RESOURCE_TYPES } from '../constants'
import { getCameraZoom } from '../lib/settings'
import { EditorControls } from '../controllers/EditorControls'
import { MapEditorHud } from '../ui/MapEditorHud'

const DEFAULT_MAP_SIZE = 120
const MAP_EXPORT_EXT = '.rtsmap'
export default class MapEditor extends Container {
  constructor(app, gamebox, config = {}, onQuit = null) {
    super()
    this.config = config
    this.onQuit = onQuit
    this._orientationBlocked = false
    this._onResize = () => this.applyZoom()
    this.editorState = {
      brushType: 'map',
      brushSize: 1,
      mapPaint: this.config.baseTerrain || 'Grass',
      elevationLevel: 0,
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
    this.context.map.revealEverything = true
    this.context.map.revealTerrain = true
    this.context.map.showResources = true
    this.context.map.gaia = { units: [] }
    this._createBlankMap()

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

  _createBlankMap() {
    const { map } = this.context
    map.removeChildren()
    map.grid = []
    map.resources = new Set()

    for (let i = 0; i <= map.size; i++) {
      map.grid[i] = []
      for (let j = 0; j <= map.size; j++) {
        const cell = new Cell({ i, j, z: 0, type: this.config.baseTerrain || 'Grass' }, this.context)
        cell.visible = true
        map.addChild(cell)
        map.grid[i][j] = cell
      }
    }

    this._applyMapFixture()
    map.ready = true
    this.refreshTerrainAppearance()
  }

  _applyMapFixture() {
    if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) return
    const fixture = new URLSearchParams(window.location.search).get('mapFixture')
    if (fixture !== 'water-borders') return

    const { map } = this.context
    const patterns = [
      { center: [4, 4], level: -2, offsets: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] },
      { center: [4, 12], level: 0, offsets: [[0, 0], [1, 0], [0, -1], [1, -1]] },
      { center: [11, 4], level: 3, offsets: [[0, 0], [0, 1], [1, 0]] },
      { center: [11, 11], level: 1, offsets: [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]] },
    ]

    for (const { center: [ci, cj], level, offsets } of patterns) {
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
    const payload = {
      format: 'rts-map',
      version: 1,
      name: this.config.name || 'map',
      size: this.context.map.size,
      baseTerrain: this.config.baseTerrain || 'Grass',
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

    for (let i = 0; i <= map.size; i++) {
      for (let j = 0; j <= map.size; j++) {
        map.grid[i][j].resetTerrainAppearance()
      }
    }

    for (let i = 0; i <= map.size; i++) {
      for (let j = 0; j <= map.size; j++) {
        map.grid[i][j].fillWaterCellsAroundCell()
      }
    }

    if (waterEdit) map.flattenWaterComponents(waterEdit.seeds, waterEdit.level)
    map.formatCellsWaterBorder()
    map.clampReliefAroundWaterLevels()
    const unrestrictedReliefDistances = new Int16Array((map.size + 1) ** 2).fill(map.size + 4)
    map.enforceReliefStepContinuity(unrestrictedReliefDistances, protectedReliefCells)
    map.formatCellsRelief()
    map.formatCellsWaterBorderOverlays()
    map.formatCellsDesert()
    this.syncResourceSprites()
    this.context.hud?.revealTerrainMinimap()
    this.context.hud?.updateResourcesMiniMap()
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
