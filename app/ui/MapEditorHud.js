import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'
import { getIconPath } from '../lib'
import { MinimapManager } from './MinimapManager'
import { MinimapInputController } from './MinimapInputController'
import { MapEditorMenu } from './MapEditorMenu'
import { MapEditorPlayersModal } from './MapEditorPlayersModal'

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
const MAP_OPTIONS = ['Grass', 'Desert', 'forest', 'Water', 'DeepWater', 'palmdesert', 'palmjungle']

export class MapEditorHud {
  constructor({ context, state, onQuit, onChange }) {
    this.context = context
    this.state = state
    this.onQuit = onQuit
    this.onChange = onChange
    this.toolButtons = new Map()
    this.modeButtons = new Map()
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
    this.icons = {
      wood: getIconPath('000_50732'),
      food: getIconPath('002_50732'),
      stone: getIconPath('001_50732'),
      gold: getIconPath('003_50732'),
    }
    this.infoIcons = {
      wood: getIconPath('000_50731'),
      stone: getIconPath('001_50731'),
      food: getIconPath('002_50731'),
      gold: getIconPath('003_50731'),
    }

    this.age = document.createElement('div')
    this.age.className = 'topbar-age map-editor-status'
    this.age.textContent = t('editorStatusIdle')

    const terrainButton = this._createTopbarModeButton(t('editorTerrain'), () => this._setMode('terrain'))
    const playersButton = this._createTopbarModeButton(t('players'), () => this._openPlayersModal())
    const unitsButton = this._createTopbarModeButton(t('editorUnits'), () => this._setMode('units'))
    this.modeButtons.set('terrain', terrainButton)
    this.modeButtons.set('units', unitsButton)
    this.resources.appendChild(terrainButton)
    this.resources.appendChild(playersButton)
    this.resources.appendChild(unitsButton)

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
    this.updatePlayerMiniMap = this.minimapManager.updatePlayerMiniMap
    this.updateResourcesMiniMap = this.minimapManager.updateResourcesMiniMap
    this.updateCameraMiniMap = this.minimapManager.updateCameraMiniMap
    this.minimapInputController = new MinimapInputController(this)
    this.minimapInputController.bind()
    this.selection = null

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

  _createTopbarModeButton(label, onClick) {
    const button = this._btn(label, onClick, 'ui-btn')
    button.type = 'button'
    return button
  }

  _createIconActionBox(iconPath, onClick, label) {
    const box = document.createElement('div')
    box.className = 'bottombar-menu-box'
    box.setAttribute('role', 'button')
    box.tabIndex = 0
    box.setAttribute('aria-label', label)
    box.title = label

    const icon = document.createElement('img')
    icon.src = iconPath
    icon.alt = ''
    icon.className = 'img'
    box.appendChild(icon)

    box.addEventListener('pointerdown', playClickSound)
    box.addEventListener('pointerup', evt => {
      evt.preventDefault()
      onClick(evt)
    })
    box.addEventListener('keydown', evt => {
      if (evt.key !== 'Enter' && evt.key !== ' ') return
      evt.preventDefault()
      onClick(evt)
    })

    return box
  }

  _clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild)
    }
  }

  _renderToolMenu() {
    this.selection = null
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

  _renderUnitsMenu() {
    this.bottombarMenu.textContent = ''

    const controlsPanel = document.createElement('div')
    controlsPanel.className = 'map-editor-panel map-editor-controls-panel'
    const columns = document.createElement('div')
    columns.className = 'map-editor-columns'

    const owners = this.context.editor.getPlacementOwners()
    const activeOwner = owners.find(owner => owner.label === this.state.placementOwnerLabel) || owners[0] || null
    if (activeOwner && activeOwner.label !== this.state.placementOwnerLabel) {
      this.state.placementOwnerLabel = activeOwner.label
    }

    const playerWrap = document.createElement('div')
    playerWrap.className = 'map-editor-field map-editor-column'
    playerWrap.appendChild(this._sectionTitle(t('editorPlayer')))
    const playerList = document.createElement('div')
    playerList.className = 'map-editor-vertical-list map-editor-scroll-list'
    owners.forEach(owner => {
      const label = owner.name || (owner === this.context.map.gaia ? t('gaia') : t('players'))
      const button = this._createListButton(label, () => {
        this.context.editor.setPlacementSelection(owner.label, null, null)
      })
      button.classList.toggle('is-active', owner.label === activeOwner?.label)
      playerList.appendChild(button)
    })
    playerWrap.appendChild(playerList)
    columns.appendChild(playerWrap)

    const buildingsWrap = document.createElement('div')
    buildingsWrap.className = 'map-editor-field map-editor-column'
    buildingsWrap.appendChild(this._sectionTitle(t('editorBuildings')))
    const buildingsList = document.createElement('div')
    buildingsList.className = 'map-editor-vertical-list map-editor-scroll-list'
    if (activeOwner && activeOwner !== this.context.map.gaia) {
      Object.keys(activeOwner.config?.buildings || {}).forEach(type => {
        const button = this._createListButton(t(type), () => {
          this.context.editor.setPlacementSelection(activeOwner.label, type, 'building')
        })
        const isActive =
          this.state.placementOwnerLabel === activeOwner.label &&
          this.state.placementKind === 'building' &&
          this.state.placementType === type
        button.classList.toggle('is-active', isActive)
        buildingsList.appendChild(button)
      })
    }
    buildingsWrap.appendChild(buildingsList)
    columns.appendChild(buildingsWrap)

    const unitsWrap = document.createElement('div')
    unitsWrap.className = 'map-editor-field map-editor-column'
    unitsWrap.appendChild(
      this._sectionTitle(activeOwner === this.context.map.gaia ? t('editorAnimals') : t('editorUnits'))
    )
    const unitsList = document.createElement('div')
    unitsList.className = 'map-editor-vertical-list map-editor-scroll-list'
    const unitSource =
      activeOwner === this.context.map.gaia ? activeOwner?.config?.animals || {} : activeOwner?.config?.units || {}
    Object.keys(unitSource).forEach(type => {
      const kind = activeOwner === this.context.map.gaia ? 'animal' : 'unit'
      const button = this._createListButton(t(type), () => {
        this.context.editor.setPlacementSelection(activeOwner.label, type, kind)
      })
      const isActive =
        this.state.placementOwnerLabel === activeOwner?.label &&
        this.state.placementKind === kind &&
        this.state.placementType === type
      button.classList.toggle('is-active', isActive)
      unitsList.appendChild(button)
    })
    unitsWrap.appendChild(unitsList)
    columns.appendChild(unitsWrap)

    controlsPanel.appendChild(columns)
    this.bottombarMenu.appendChild(controlsPanel)

    if (!this.selection) {
      const placement = this.context.editor.getPlacementSelection()
      this._renderInfoLines([
        t('editorMode') + ': ' + t('editorUnits'),
        placement?.type === 'SmallWall'
          ? t(this.context.editor.hasWallDraft() ? 'editorWallFinishHint' : 'editorWallStartHint')
          : placement
            ? t('editorPlaceHint')
            : t('editorSelectHint'),
      ])
      return
    }

    const actionRow = document.createElement('div')
    actionRow.className = 'map-editor-button-grid'
    const deselectButton = this._createListButton(t('editorDeselect'), () => {
      this.context.player?.unselectAll()
      this.setBottombar()
    })
    const deleteButton = this._createListButton(t('editorDelete'), () => {
      this.context.editor.removeEntity(this.selection)
    })
    actionRow.appendChild(deselectButton)
    actionRow.appendChild(deleteButton)
    this.bottombarMenu.appendChild(actionRow)
  }

  _setTool(tool) {
    this.state.brushType = tool
    this.sync()
    this.onChange()
  }

  _setMode(mode) {
    this.context.editor.cancelWallDraft()
    this.state.mode = mode
    this.context.player?.unselectAll?.()
    if (mode === 'terrain') {
      this._renderToolMenu()
    } else {
      this._renderUnitsMenu()
    }
    this.sync()
    this.onChange()
  }

  _openPlayersModal() {
    const maxPlayers = this._getMaxPlayersForCurrentSize()
    new MapEditorPlayersModal({
      size: this.context.map.size,
      players: this.context.editorConfig.players,
      maxPlayers,
      onSave: players => this.context.editor.updatePlayersConfig(players),
    })
  }

  _getMaxPlayersForCurrentSize() {
    const size = this.context.map.size
    if (size <= 16) return 2
    if (size <= 144) return 3
    return 4
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
    this.modeButtons.forEach((button, mode) => {
      button.classList.toggle('is-active', mode === this.state.mode)
    })
    if (this.state.mode === 'units') {
      this._renderUnitsMenu()
      return
    }
    this.toolButtons.forEach((button, tool) => {
      button.classList.toggle('is-active', tool === this.state.brushType)
    })

    const isTerrainMode = this.state.mode === 'terrain'
    const isMapBrush = this.state.brushType === 'map'
    this.bottombarMenu.classList.toggle('is-hidden', !isTerrainMode && !this.selection)
    this.detailLabel.textContent = isMapBrush ? t('editorTerrain') : t('editorElevation')
    if (!isTerrainMode) return
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

    if (!this.selection) {
      this._renderInfoLines([
        t('editorBrushType') + ': ' + t(TOOLS.find(tool => tool.id === this.state.brushType)?.label || 'editorMap'),
        (isMapBrush ? t('editorTerrain') : t('editorElevation')) +
          ': ' +
          (isMapBrush ? t(this.state.mapPaint) : this.state.elevationLevel),
        t('editorBrushSize') +
          ': ' +
          t(BRUSH_SIZES.find(size => size.value === this.state.brushSize)?.label || 'editorBrushSizeTiny'),
      ])
    }
  }

  setBottombar(selection = null) {
    this.selection = selection
    this.bottombarMenu.textContent = ''
    this.bottombarInfo.textContent = ''

    if (!selection?.interface?.info) {
      if (this.state.mode === 'terrain') {
        this._renderToolMenu()
      }
      this.sync()
      return
    }

    selection.interface.info(this.bottombarInfo)
    const wrapper = document.createElement('div')
    wrapper.className = 'map-editor-panel map-editor-controls-panel'
    const actionRow = document.createElement('div')
    actionRow.className = 'bottombar-menu'
    actionRow.appendChild(
      this._createIconActionBox(
        getIconPath('003_50721'),
        () => this.context.editor.removeEntity(this.selection),
        t('editorDelete')
      )
    )
    actionRow.appendChild(
      this._createIconActionBox(
        getIconPath('010_50721'),
        () => {
          this.context.player?.unselectAll()
          this.setBottombar()
        },
        t('editorDeselect')
      )
    )
    wrapper.appendChild(actionRow)
    this.bottombarMenu.appendChild(wrapper)
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

  updatePlayerMiniMapEvt(owner) {
    return this.minimapManager.updatePlayerMiniMapEvt(owner)
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
