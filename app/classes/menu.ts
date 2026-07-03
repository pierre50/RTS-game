import { t } from '../lib/lang'
import { MinimapManager } from '../ui/MinimapManager'
import { BottombarManager } from '../ui/BottombarManager'
import { PlayerStatsManager } from '../ui/PlayerStatsManager'
import { TopbarView } from '../ui/TopbarView'
import { PauseMenu } from '../ui/PauseMenu'
import { MinimapInputController } from '../ui/MinimapInputController'
import { MenuTooltip } from '../ui/MenuTooltip'

type AnyRecord = Record<string, any>

export default class Menu {
  [key: string]: any

  context: AnyRecord
  gameHud: HTMLDivElement
  bottombar: HTMLDivElement
  bottombarInfo: HTMLDivElement
  bottombarMenu: HTMLDivElement
  bottombarMap: HTMLDivElement
  terrainMinimap: HTMLCanvasElement
  playersMinimap: any[]
  resourcesMinimap: HTMLCanvasElement
  cameraMinimap: HTMLCanvasElement
  minimapManager: MinimapManager
  bottombarManager: BottombarManager
  playerStatsManager: PlayerStatsManager
  pauseMenu: PauseMenu
  topbarView: TopbarView
  minimapInputController: MinimapInputController
  menuTooltip: MenuTooltip
  toggled: boolean
  updatePlayerMiniMap: any
  updateResourcesMiniMap: any
  updateCameraMiniMap: any
  _infoCache: any
  selection: any

  constructor(context: AnyRecord) {
    this.context = context
    this.gameHud = document.createElement('div')
    this.gameHud.className = 'game-hud'
    this.bottombar = document.createElement('div')
    this.bottombar.className = 'bottombar bar'
    this.bottombarInfo = document.createElement('div')
    this.bottombarInfo.className = 'bottombar-info'
    this.bottombarMenu = document.createElement('div')
    this.bottombarMenu.className = 'bottombar-menu'
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
    this.gameHud.appendChild(this.bottombar)
    document.body.appendChild(this.gameHud)

    this.minimapManager = new MinimapManager(this)
    this.bottombarManager = new BottombarManager(this)
    this.playerStatsManager = new PlayerStatsManager(this)
    this.pauseMenu = new PauseMenu(this)
    this.topbarView = new TopbarView(this)
    this.minimapInputController = new MinimapInputController(this)
    this.menuTooltip = new MenuTooltip()
    this.toggled = false

    this.topbarView.build()
    this.minimapInputController.bind()

    // Expose throttled minimap updaters as top-level properties for external callers
    this.updatePlayerMiniMap = this.minimapManager.updatePlayerMiniMap
    this.updateResourcesMiniMap = this.minimapManager.updateResourcesMiniMap
    this.updateCameraMiniMap = this.minimapManager.updateCameraMiniMap

    this._infoCache = null
    this.selection = null
    this.updateTopbar()
  }

  destroy(): void {
    this.menuTooltip.destroy()
    this.minimapInputController.destroy()
    this.playerStatsManager.destroy()
    this.gameHud.remove()
    this.topbarView.destroy()
  }

  init(): void {
    this.minimapManager.initMiniMap()
    this.updateTopbar()
    this.bottombarManager.preloadIcons(this.context.player)
  }

  updateTopbar(): void {
    this.topbarView.update()
  }

  updateAgeTheme(age = 0): void {
    this.topbarView.updateAgeTheme(age)
  }

  showMessage(message: string, type = 'error'): void {
    const {
      context: { gamebox },
    } = this
    if (document.getElementById('msg')) {
      document.getElementById('msg')?.remove()
    }
    const box = document.createElement('div')
    box.id = 'msg'
    box.className = 'message'
    const msg = document.createElement('span')
    msg.textContent = message
    msg.className = `message-content message-content--${type}`

    box.appendChild(msg)
    gamebox.appendChild(box)
    setTimeout(() => {
      box.remove()
    }, 3000)
  }

  // Minimap delegates
  getMinimapFactor(): any {
    return this.minimapManager.getMinimapFactor()
  }
  revealTerrainMinimap(): any {
    return this.minimapManager.revealTerrainMinimap()
  }
  rebuildTerrainMiniMapFromViews(): any {
    return this.minimapManager.rebuildTerrainMiniMapFromViews()
  }
  updateTerrainMiniMap(i: any, j: any): any {
    return this.minimapManager.updateTerrainMiniMap(i, j)
  }
  updateResourceMiniMap(resource: any): any {
    return this.minimapManager.updateResourceMiniMap(resource)
  }
  updatePlayerMiniMapEvt(owner: any): any {
    return this.minimapManager.updatePlayerMiniMapEvt(owner)
  }
  updateResourcesMiniMapEvt(): any {
    return this.minimapManager.updateResourcesMiniMapEvt()
  }
  updateCameraMiniMapEvt(): any {
    return this.minimapManager.updateCameraMiniMapEvt()
  }

  // PlayerStats delegate
  updatePlayerStats(): any {
    return this.playerStatsManager.update()
  }

  // Bottombar delegates
  resetInfo(): any {
    return this.bottombarManager.resetInfo()
  }
  generateInfo(selection: any): any {
    return this.bottombarManager.generateInfo(selection)
  }
  updateInfo(target: any, action: any): any {
    return this.bottombarManager.updateInfo(target, action)
  }
  updateButtonContent(target: any, action: any): any {
    return this.bottombarManager.updateButtonContent(target, action)
  }
  toggleButtonCancel(target: any, value: any): any {
    return this.bottombarManager.toggleButtonCancel(target, value)
  }
  updateBottombar(): any {
    return this.bottombarManager.updateBottombar()
  }
  setBottombar(selection: any): any {
    return this.bottombarManager.setBottombar(selection)
  }
  getMessage(cost: any): any {
    return this.bottombarManager.getMessage(cost)
  }
  getUnitButton(type: any): any {
    return this.bottombarManager.getUnitButton(type)
  }
  getRallyPointButton(): any {
    return this.bottombarManager.getRallyPointButton()
  }
  getBuildingButton(type: any): any {
    return this.bottombarManager.getBuildingButton(type)
  }
  getTechnologyButton(type: any): any {
    return this.bottombarManager.getTechnologyButton(type)
  }
  handleHotkey(key: any): any {
    return this.bottombarManager.handleHotkey(key)
  }
}
