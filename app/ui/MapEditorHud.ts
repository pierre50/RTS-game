import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'
import { getIconPath } from '../lib'
import { createResourceIconMaps } from './resourceIcons'
import { MinimapManager } from './MinimapManager'
import { MinimapInputController } from './MinimapInputController'
import { MapEditorMenu } from './MapEditorMenu'
import { MapEditorPlayersModal } from './MapEditorPlayersModal'
import type { GameContextLike } from '../types/context'
import type { RuntimeEntity, ResourceEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { RuntimeCell } from '../types/map'
import type { MapEditorLike, MapEditorUiState } from '../types/mapEditor'
import type { PlayerSetupConfig } from '../types/save'
import type { MenuButtonSpec, MinimapPlayerCanvas } from '../types/ui'

type MapEditorContext = GameContextLike & {
  editor: MapEditorLike
  editorConfig: { players: PlayerSetupConfig[] }
}

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
  context: MapEditorContext
  state: MapEditorUiState
  onQuit: () => void
  onChange: () => void
  toolButtons: Map<string, HTMLButtonElement>
  modeButtons: Map<string, HTMLButtonElement>
  detailButtons: Map<string, HTMLButtonElement>
  brushSizeButtons: Map<number, HTMLButtonElement>
  editorMenu: MapEditorMenu

  gameHud: HTMLDivElement
  topbar: HTMLDivElement
  resources: HTMLDivElement
  icons: Record<string, string>
  infoIcons: Record<string, string>
  age: HTMLDivElement
  editorPanel: HTMLDivElement
  editorPanelInfo: HTMLDivElement
  editorPanelMenu: HTMLDivElement
  editorPanelMap: HTMLDivElement
  terrainMinimap: HTMLCanvasElement
  playersMinimap: MinimapPlayerCanvas[]
  resourcesMinimap: HTMLCanvasElement
  cameraMinimap: HTMLCanvasElement

  minimapManager: MinimapManager
  updatePlayerMiniMap: (owner: PlayerLike) => void
  minimapInputController: MinimapInputController
  selection: RuntimeEntity | null
  toggle?: HTMLButtonElement
  toggled!: boolean

  detailLabel!: HTMLDivElement
  detailList!: HTMLDivElement
  brushSizeList!: HTMLDivElement

  constructor({
    context,
    state,
    onQuit,
    onChange,
  }: {
    context: MapEditorContext
    state: MapEditorUiState
    onQuit: () => void
    onChange: () => void
  }) {
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
    const resourceIcons = createResourceIconMaps()
    this.icons = resourceIcons.icons
    this.infoIcons = resourceIcons.infoIcons

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

    this.editorPanel = document.createElement('div')
    this.editorPanel.className = 'editor-panel bar'

    this.editorPanelInfo = document.createElement('div')
    this.editorPanelInfo.className = 'selection-info active map-editor-info'

    this.editorPanelMenu = document.createElement('div')
    this.editorPanelMenu.className = 'action-menu-grid map-editor-menu'

    const editorPanelMapWrap = document.createElement('div')
    editorPanelMapWrap.className = 'editor-minimap-wrap'

    this.editorPanelMap = document.createElement('div')
    this.editorPanelMap.className = 'editor-minimap'
    editorPanelMapWrap.appendChild(this.editorPanelMap)

    this.terrainMinimap = document.createElement('canvas')
    this.playersMinimap = []
    this.resourcesMinimap = document.createElement('canvas')
    this.cameraMinimap = document.createElement('canvas')
    this.cameraMinimap.classList.add('minimap-camera')

    this.editorPanelMap.appendChild(this.terrainMinimap)
    this.editorPanelMap.appendChild(this.resourcesMinimap)
    this.editorPanelMap.appendChild(this.cameraMinimap)

    this.editorPanel.appendChild(this.editorPanelInfo)
    this.editorPanel.appendChild(this.editorPanelMenu)
    this.editorPanel.appendChild(editorPanelMapWrap)

    this.gameHud.appendChild(this.topbar)
    this.gameHud.appendChild(this.editorPanel)
    document.body.appendChild(this.gameHud)

    this.toggled = false
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

  init(): void {
    this.minimapManager.initMiniMap()
    this.updateCameraMiniMap()
    this.updateResourcesMiniMap()
  }

  _btn(label: string, onClick: (evt: MouseEvent) => void, className: string = 'ui-btn'): HTMLButtonElement {
    const button = document.createElement('button')
    button.className = className
    button.textContent = label
    button.addEventListener('pointerdown', playClickSound)
    button.addEventListener('click', onClick)
    return button
  }

  _sectionTitle(label: string): HTMLDivElement {
    const title = document.createElement('div')
    title.className = 'map-editor-section-title'
    title.textContent = label
    return title
  }

  _createListButton(label: string, onClick: (evt: MouseEvent) => void): HTMLButtonElement {
    const button = this._btn(label, onClick, 'ui-btn map-editor-list-btn')
    button.type = 'button'
    return button
  }

  _createTopbarModeButton(label: string, onClick: (evt: MouseEvent) => void): HTMLButtonElement {
    const button = this._btn(label, onClick, 'ui-btn')
    button.type = 'button'
    return button
  }

  _createIconActionBox(iconPath: string, onClick: (evt: Event) => void, label: string): HTMLDivElement {
    const box = document.createElement('div')
    box.className = 'action-menu-box'
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

  _clearElement(element: HTMLElement): void {
    while (element.firstChild) {
      element.removeChild(element.firstChild)
    }
  }

  _renderToolMenu(): void {
    this.selection = null
    this.editorPanelMenu.textContent = ''

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

    this.editorPanelMenu.appendChild(controlsPanel)
  }

  _renderUnitsMenu(): void {
    this.editorPanelMenu.textContent = ''

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
        this.context.editor.setPlacementSelection(activeOwner!.label, type, kind)
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
    this.editorPanelMenu.appendChild(controlsPanel)

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
      this.setActionTarget()
    })
    const deleteButton = this._createListButton(t('editorDelete'), () => {
      if (this.selection) this.context.editor.removeEntity(this.selection)
    })
    actionRow.appendChild(deselectButton)
    actionRow.appendChild(deleteButton)
    this.editorPanelMenu.appendChild(actionRow)
  }

  _setTool(tool: string): void {
    this.state.brushType = tool
    this.sync()
    this.onChange()
  }

  _setMode(mode: 'terrain' | 'units'): void {
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

  _openPlayersModal(): void {
    const maxPlayers = this._getMaxPlayersForCurrentSize()
    new MapEditorPlayersModal({
      size: this.context.map.size,
      players: this.context.editorConfig.players,
      maxPlayers,
      onSave: (players: PlayerSetupConfig[]) => this.context.editor.updatePlayersConfig(players),
    })
  }

  _getMaxPlayersForCurrentSize(): number {
    const size = this.context.map.size
    if (size <= 16) return 2
    if (size <= 144) return 3
    return 4
  }

  _renderInfoLines(lines: string[]): void {
    this.editorPanelInfo.textContent = ''
    lines.forEach(text => {
      const line = document.createElement('div')
      line.className = 'map-editor-info-line'
      line.textContent = text
      this.editorPanelInfo.appendChild(line)
    })
  }

  sync(): void {
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
    this.editorPanelMenu.classList.toggle('is-hidden', !isTerrainMode && !this.selection)
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

  setActionTarget(selection: RuntimeEntity | null = null): void {
    this.selection = selection
    this.editorPanelMenu.textContent = ''
    this.editorPanelInfo.textContent = ''

    if (!selection?.interface?.info) {
      if (this.state.mode === 'terrain') {
        this._renderToolMenu()
      }
      this.sync()
      return
    }

    selection.interface.info(this.editorPanelInfo)
    const wrapper = document.createElement('div')
    wrapper.className = 'map-editor-panel map-editor-controls-panel'
    const actionRow = document.createElement('div')
    actionRow.className = 'action-menu-grid'
    actionRow.appendChild(
      this._createIconActionBox(
        getIconPath('003_50721'),
        () => {
          if (this.selection) this.context.editor.removeEntity(this.selection)
        },
        t('editorDelete')
      )
    )
    actionRow.appendChild(
      this._createIconActionBox(
        getIconPath('010_50721'),
        () => {
          this.context.player?.unselectAll()
          this.setActionTarget()
        },
        t('editorDeselect')
      )
    )
    wrapper.appendChild(actionRow)
    this.editorPanelMenu.appendChild(wrapper)
  }

  showMessage(): void {}

  updateTopbar(): void {
    this.sync()
  }

  updateActionTarget(): void {
    this.setActionTarget(this.selection)
  }

  updateInfo(): void {}

  updateButtonContent(): void {}

  toggleQueuedActionCancel(): void {}

  getActionUnitButton(): MenuButtonSpec {
    return { id: 'editor-unit-placeholder' }
  }

  getActionTechnologyButton(): MenuButtonSpec {
    return { id: 'editor-technology-placeholder' }
  }

  getActionRallyPointButton(): MenuButtonSpec {
    return { id: 'editor-rally-placeholder' }
  }

  getActionBuildingButton(): MenuButtonSpec {
    return { id: 'editor-building-placeholder' }
  }

  updateStatus(cell: RuntimeCell | null): void {
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

  getMinimapFactor(): number {
    return this.minimapManager.getMinimapFactor()
  }

  revealTerrainMinimap(): void {
    return this.minimapManager.revealTerrainMinimap()
  }

  rebuildTerrainMiniMapFromViews(): void {
    return this.minimapManager.rebuildTerrainMiniMapFromViews()
  }

  updateTerrainMiniMap(i: number, j: number): void {
    return this.minimapManager.updateTerrainMiniMap(i, j)
  }

  updateResourceMiniMap(resource: ResourceEntity): void {
    return this.minimapManager.updateResourceMiniMap(resource)
  }

  updatePlayerMiniMapEvt(owner: PlayerLike): void {
    return this.minimapManager.updatePlayerMiniMapEvt(owner)
  }

  updateResourcesMiniMap(): void {
    return this.minimapManager.updateResourcesMiniMapEvt()
  }

  updateCameraMiniMap(): void {
    if (!this.context.controls?.getViewportMetrics) return
    return this.minimapManager.updateCameraMiniMapEvt()
  }

  destroy(): void {
    this.minimapInputController.destroy()
    this.gameHud.remove()
  }
}
