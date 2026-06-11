import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'
import { MinimapManager } from './MinimapManager'
import { MinimapInputController } from './MinimapInputController'
import { MapEditorMenu } from './MapEditorMenu'

const TOOLS = [
  { id: 'forest', label: 'editorForest' },
  { id: 'terrain', label: 'editorTerrain' },
  { id: 'erase', label: 'editorErase' },
  { id: 'raiseRelief', label: 'editorRaiseRelief' },
]

const BRUSH_SIZES = [1, 2, 4]
const RELIEF_LEVELS = [-4, -3, -2, -1, 0, 1, 2, 3, 4]
const TERRAIN_OPTIONS = ['Grass', 'Water', 'Jungle', 'Desert']

export class MapEditorHud {
  constructor({ context, state, onQuit, onChange }) {
    this.context = context
    this.state = state
    this.onQuit = onQuit
    this.onChange = onChange
    this.toolButtons = new Map()
    this.brushButtons = new Map()
    this.editorMenu = new MapEditorMenu(this)

    this.gameHud = document.createElement('div')
    this.gameHud.className = 'game-hud map-editor-hud ui-age-0'

    this.topbar = document.createElement('div')
    this.topbar.id = 'topbar'
    this.topbar.className = 'topbar bar'

    this.resources = document.createElement('div')
    this.resources.className = 'topbar-resources map-editor-titlebar'
    this.resources.textContent = context.editorConfig?.name || t('editorTitle')

    this.age = document.createElement('div')
    this.age.className = 'topbar-age map-editor-status'
    this.age.textContent = t('editorStatusIdle')

    const options = document.createElement('div')
    options.className = 'topbar-options'
    options.appendChild(this.editorMenu.createOpenButton())

    this.topbar.appendChild(this.resources)
    this.topbar.appendChild(this.age)
    this.topbar.appendChild(options)

    this.bottombar = document.createElement('div')
    this.bottombar.className = 'bottombar bar'

    this.bottombarInfo = document.createElement('div')
    this.bottombarInfo.className = 'bottombar-info active map-editor-info'

    this.bottombarMenu = document.createElement('div')
    this.bottombarMenu.className = 'bottombar-menu map-editor-menu'

    const bottombarMapWrap = document.createElement('div')
    bottombarMapWrap.className = 'bottombar-map-wrap'

    this.bottombarMap = document.createElement('div')
    this.bottombarMap.className = 'bottombar-map'
    bottombarMapWrap.appendChild(this.bottombarMap)

    this.terrainMinimap = document.createElement('canvas')
    this.playersMinimap = []
    this.resourcesMinimap = document.createElement('canvas')
    this.cameraMinimap = document.createElement('canvas')
    this.cameraMinimap.classList.add('minimap-camera')

    this.bottombarMap.appendChild(this.terrainMinimap)
    this.bottombarMap.appendChild(this.resourcesMinimap)
    this.bottombarMap.appendChild(this.cameraMinimap)

    this.bottombar.appendChild(this.bottombarInfo)
    this.bottombar.appendChild(this.bottombarMenu)
    this.bottombar.appendChild(bottombarMapWrap)

    this.gameHud.appendChild(this.topbar)
    this.gameHud.appendChild(this.bottombar)
    document.body.appendChild(this.gameHud)

    this.minimapManager = new MinimapManager(this)
    this.minimapInputController = new MinimapInputController(this)
    this.minimapInputController.bind()

    this._renderToolMenu()
    this.sync()
  }

  init() {
    this.minimapManager.initMiniMap()
    this.updateCameraMiniMap()
    this.updateResourcesMiniMap()
  }

  _btn(label, onClick, className = 'ui-btn') {
    const button = document.createElement('button')
    button.className = className
    button.textContent = label
    button.addEventListener('pointerdown', playClickSound)
    button.addEventListener('click', onClick)
    return button
  }

  _sectionTitle(label) {
    const title = document.createElement('div')
    title.className = 'map-editor-section-title'
    title.textContent = label
    return title
  }

  _renderToolMenu() {
    this.bottombarMenu.textContent = ''

    const toolsPanel = document.createElement('div')
    toolsPanel.className = 'map-editor-panel'
    toolsPanel.appendChild(this._sectionTitle(t('editorTools')))

    const toolsWrap = document.createElement('div')
    toolsWrap.className = 'map-editor-button-grid'
    TOOLS.forEach(tool => {
      const button = this._btn(t(tool.label), () => this._setTool(tool.id))
      this.toolButtons.set(tool.id, button)
      toolsWrap.appendChild(button)
    })
    toolsPanel.appendChild(toolsWrap)

    const settingsPanel = document.createElement('div')
    settingsPanel.className = 'map-editor-panel'
    settingsPanel.appendChild(this._sectionTitle(t('editorBrush')))

    const brushWrap = document.createElement('div')
    brushWrap.className = 'map-editor-inline-group'
    BRUSH_SIZES.forEach(size => {
      const button = this._btn(String(size), () => this._setBrushSize(size))
      this.brushButtons.set(size, button)
      brushWrap.appendChild(button)
    })
    settingsPanel.appendChild(brushWrap)

    settingsPanel.appendChild(this._sectionTitle(t('editorTerrain')))
    this.terrainSelect = document.createElement('select')
    this.terrainSelect.className = 'ui-select map-editor-select'
    TERRAIN_OPTIONS.forEach(type => {
      const option = document.createElement('option')
      option.value = type
      option.textContent = t(type)
      this.terrainSelect.appendChild(option)
    })
    this.terrainSelect.value = this.state.terrainType
    this.terrainSelect.addEventListener('change', () => {
      this.state.terrainType = this.terrainSelect.value
      this.onChange()
      this.sync()
    })
    settingsPanel.appendChild(this.terrainSelect)

    settingsPanel.appendChild(this._sectionTitle(t('editorRelief')))
    this.reliefSelect = document.createElement('select')
    this.reliefSelect.className = 'ui-select map-editor-select'
    RELIEF_LEVELS.forEach(level => {
      const option = document.createElement('option')
      option.value = String(level)
      option.textContent = String(level)
      this.reliefSelect.appendChild(option)
    })
    this.reliefSelect.value = String(this.state.reliefLevel)
    this.reliefSelect.addEventListener('change', () => {
      this.state.reliefLevel = Number(this.reliefSelect.value)
      this.onChange()
      this.sync()
    })
    settingsPanel.appendChild(this.reliefSelect)

    this.bottombarMenu.appendChild(toolsPanel)
    this.bottombarMenu.appendChild(settingsPanel)
  }

  _setTool(tool) {
    this.state.tool = tool
    this.sync()
    this.onChange()
  }

  _setBrushSize(size) {
    this.state.brushSize = size
    this.sync()
    this.onChange()
  }

  _renderInfoLines(lines) {
    this.bottombarInfo.textContent = ''
    lines.forEach(text => {
      const line = document.createElement('div')
      line.className = 'map-editor-info-line'
      line.textContent = text
      this.bottombarInfo.appendChild(line)
    })
  }

  sync() {
    this.toolButtons.forEach((button, tool) => {
      button.classList.toggle('is-active', tool === this.state.tool)
    })
    this.brushButtons.forEach((button, size) => {
      button.classList.toggle('is-active', size === this.state.brushSize)
    })
    this.reliefSelect.value = String(this.state.reliefLevel)
    this.terrainSelect.value = this.state.terrainType
    this._renderInfoLines([
      t('editorTools') + ': ' + t(TOOLS.find(tool => tool.id === this.state.tool)?.label || 'editorForest'),
      t('editorBrush') + ': ' + this.state.brushSize,
      t('editorTerrain') + ': ' + t(this.state.terrainType),
      t('editorRelief') + ': ' + this.state.reliefLevel,
    ])
  }

  updateStatus(cell) {
    if (!cell) {
      this.age.textContent = t('editorStatusIdle')
      return
    }
    this.age.textContent = t('editorStatus', {
      i: cell.i,
      j: cell.j,
      type: t(cell.type),
      level: cell.z,
    })
  }

  getMinimapFactor() {
    return this.minimapManager.getMinimapFactor()
  }

  revealTerrainMinimap() {
    return this.minimapManager.revealTerrainMinimap()
  }

  updateTerrainMiniMap(i, j) {
    return this.minimapManager.updateTerrainMiniMap(i, j)
  }

  updateResourceMiniMap(resource) {
    return this.minimapManager.updateResourceMiniMap(resource)
  }

  updateResourcesMiniMap() {
    return this.minimapManager.updateResourcesMiniMapEvt()
  }

  updateCameraMiniMap() {
    if (!this.context.controls?.getViewportMetrics) return
    return this.minimapManager.updateCameraMiniMapEvt()
  }

  destroy() {
    this.minimapInputController.destroy()
    this.gameHud.remove()
  }
}
