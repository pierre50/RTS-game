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
      tool: 'forest',
      brushSize: 1,
      terrainType: this.config.baseTerrain || 'Grass',
      reliefLevel: 0,
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

    map.ready = true
    this.refreshTerrainAppearance()
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
    let terrainDirty = false
    let resourceDirty = false

    for (const cell of cells) {
      switch (this.editorState.tool) {
        case 'forest':
          resourceDirty = this.placeForest(cell) || resourceDirty
          break
        case 'erase':
          resourceDirty = this.eraseEntity(cell) || resourceDirty
          break
        case 'terrain':
          terrainDirty = this.setTerrainType(cell, this.editorState.terrainType) || terrainDirty
          break
        case 'raiseRelief':
          terrainDirty = this.setRelief(cell, this.editorState.reliefLevel) || terrainDirty
          break
      }
    }

    if (terrainDirty) {
      this.refreshTerrainAppearance()
    } else if (resourceDirty) {
      this.syncResourceSprites()
      this.context.hud?.updateResourcesMiniMap()
    }
  }

  setTerrainType(cell, type) {
    if (!cell || cell.type === type) return false
    if (cell.has && type === 'Water') {
      cell.has.die?.(true)
    }
    if (type === 'Water' && cell.z !== 0) {
      this.context.map.setCellReliefLevelDirect(cell, 0)
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

  refreshTerrainAppearance() {
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

    map.formatCellsWaterBorder()
    const reliefCoastDistances = map.getReliefCoastDistances()
    map.clampReliefAroundWater(reliefCoastDistances)
    map.enforceReliefStepContinuity(reliefCoastDistances)
    map.formatCellsDesert()
    map.formatCellsRelief()
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
