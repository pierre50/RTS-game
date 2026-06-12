import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'
import { MinimapManager } from './MinimapManager'
import { MinimapInputController } from './MinimapInputController'
import { MapEditorMenu } from './MapEditorMenu'

const TOOLS = [
  { id: 'map', label: 'editorMap' },
  { id: 'elevation', label: 'editorElevation' },
]

const BRUSH_SIZES = [
  { value: 1, label: 'editorBrushSizeTiny' },
  { value: 2, label: 'editorBrushSizeSmall' },
  { value: 3, label: 'editorBrushSizeMedium' },
  { value: 4, label: 'editorBrushSizeLarge' },
  { value: 6, label: 'editorBrushSizeHuge' },
]
const RELIEF_LEVELS = [-4, -3, -2, -1, 0, 1, 2, 3, 4]
const MAP_OPTIONS = ['Grass', 'Desert', 'forest', 'Water', 'palmdesert', 'palmjungle']

export class MapEditorHud {
  constructor({ context, state, onQuit, onChange }) {
    this.context = context
    this.state = state
    this.onQuit = onQuit
    this.onChange = onChange
    this.toolButtons = new Map()
    this.detailButtons = new Map()
    this.brushSizeButtons = new Map()
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

  _createListButton(label, onClick) {
    const button = this._btn(label, onClick, 'ui-btn map-editor-list-btn')
    button.type = 'button'
    return button
  }

  _clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild)
    }
  }

  _renderToolMenu() {
    this.bottombarMenu.textContent = ''

    const controlsPanel = document.createElement('div')
    controlsPanel.className = 'map-editor-panel map-editor-controls-panel'
    const columns = document.createElement('div')
    columns.className = 'map-editor-columns'

    const brushTypeWrap = document.createElement('div')
    brushTypeWrap.className = 'map-editor-field map-editor-column map-editor-column-brush-type'
    brushTypeWrap.appendChild(this._sectionTitle(t('editorBrushType')))

    const toolsWrap = document.createElement('div')
    toolsWrap.className = 'map-editor-vertical-list'
    TOOLS.forEach(tool => {
      const button = this._createListButton(t(tool.label), () => this._setTool(tool.id))
      this.toolButtons.set(tool.id, button)
      toolsWrap.appendChild(button)
    })
    brushTypeWrap.appendChild(toolsWrap)
    columns.appendChild(brushTypeWrap)

    const detailWrap = document.createElement('div')
    detailWrap.className = 'map-editor-field map-editor-column map-editor-column-detail'

    this.detailLabel = this._sectionTitle(t('editorTerrain'))
    detailWrap.appendChild(this.detailLabel)

    this.detailList = document.createElement('div')
    this.detailList.className = 'map-editor-vertical-list map-editor-scroll-list'
    detailWrap.appendChild(this.detailList)
    columns.appendChild(detailWrap)

    const brushSizeWrap = document.createElement('div')
    brushSizeWrap.className = 'map-editor-field map-editor-column map-editor-column-size'
    brushSizeWrap.appendChild(this._sectionTitle(t('editorBrushSize')))

    this.brushSizeList = document.createElement('div')
    this.brushSizeList.className = 'map-editor-vertical-list map-editor-scroll-list'
    BRUSH_SIZES.forEach(size => {
      const button = this._createListButton(t(size.label), () => {
        this.state.brushSize = size.value
        this.onChange()
        this.sync()
      })
      this.brushSizeButtons.set(size.value, button)
      this.brushSizeList.appendChild(button)
    })
    brushSizeWrap.appendChild(this.brushSizeList)
    columns.appendChild(brushSizeWrap)

    controlsPanel.appendChild(columns)

    this.bottombarMenu.appendChild(controlsPanel)
  }

  _setTool(tool) {
    this.state.brushType = tool
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
      button.classList.toggle('is-active', tool === this.state.brushType)
    })

    const isMapBrush = this.state.brushType === 'map'
    this.detailLabel.textContent = isMapBrush ? t('editorTerrain') : t('editorElevation')
    this._clearElement(this.detailList)
    this.detailButtons.clear()

    const options = isMapBrush
      ? MAP_OPTIONS.map(value => ({ value, label: t(value) }))
      : RELIEF_LEVELS.map(value => ({ value: String(value), label: String(value) }))

    options.forEach(({ value, label }) => {
      const button = this._createListButton(label, () => {
        if (isMapBrush) {
          this.state.mapPaint = value
        } else {
          this.state.elevationLevel = Number(value)
        }
        this.onChange()
        this.sync()
      })
      const isActive = isMapBrush ? value === this.state.mapPaint : Number(value) === this.state.elevationLevel
      button.classList.toggle('is-active', isActive)
      this.detailButtons.set(String(value), button)
      this.detailList.appendChild(button)
    })

    this.brushSizeButtons.forEach((button, size) => {
      button.classList.toggle('is-active', size === this.state.brushSize)
    })

    this._renderInfoLines([
      t('editorBrushType') +
        ': ' +
        t(TOOLS.find(tool => tool.id === this.state.brushType)?.label || 'editorMap'),
      (isMapBrush ? t('editorTerrain') : t('editorElevation')) +
        ': ' +
        (isMapBrush ? t(this.state.mapPaint) : this.state.elevationLevel),
      t('editorBrushSize') +
        ': ' +
        t(BRUSH_SIZES.find(size => size.value === this.state.brushSize)?.label || 'editorBrushSizeTiny'),
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
