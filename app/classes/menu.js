import { t } from '../lib/lang'
import { MinimapManager } from '../ui/MinimapManager'
import { BottombarManager } from '../ui/BottombarManager'
import { PlayerStatsManager } from '../ui/PlayerStatsManager'
import { TopbarView } from '../ui/TopbarView'
import { PauseMenu } from '../ui/PauseMenu'
import { MinimapInputController } from '../ui/MinimapInputController'

export default class Menu {
  constructor(context) {
    this.context = context
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
    document.body.appendChild(this.bottombar)

    this.minimapManager = new MinimapManager(this)
    this.bottombarManager = new BottombarManager(this)
    this.playerStatsManager = new PlayerStatsManager(this)
    this.pauseMenu = new PauseMenu(this)
    this.topbarView = new TopbarView(this)
    this.minimapInputController = new MinimapInputController(this)
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

  destroy() {
    this.minimapInputController.destroy()
    this.playerStatsManager.destroy()
    this.bottombar.remove()
    this.topbarView.destroy()
  }

  init() {
    this.minimapManager.initMiniMap()
    this.updateTopbar()
  }

  updateTopbar() {
    this.topbarView.update()
  }

  updateAgeTheme(age = 0) {
    this.topbarView.updateAgeTheme(age)
  }

  showMessage(message) {
    const {
      context: { gamebox },
    } = this
    if (document.getElementById('msg')) {
      document.getElementById('msg').remove()
    }
    const box = document.createElement('div')
    box.id = 'msg'
    box.className = 'message'
    Object.assign(box.style, {
      bottom: this.bottombar.clientHeight + 18 + 'px',
    })
    const msg = document.createElement('span')
    msg.textContent = message
    msg.className = 'message-content'

    box.appendChild(msg)
    gamebox.appendChild(box)
    setTimeout(() => {
      box.remove()
    }, 3000)
  }

  // Minimap delegates
  getMinimapFactor() { return this.minimapManager.getMinimapFactor() }
  revealTerrainMinimap() { return this.minimapManager.revealTerrainMinimap() }
  updateTerrainMiniMap(i, j) { return this.minimapManager.updateTerrainMiniMap(i, j) }
  updateResourceMiniMap(resource) { return this.minimapManager.updateResourceMiniMap(resource) }
  updatePlayerMiniMapEvt(owner) { return this.minimapManager.updatePlayerMiniMapEvt(owner) }
  updateResourcesMiniMapEvt() { return this.minimapManager.updateResourcesMiniMapEvt() }
  updateCameraMiniMapEvt() { return this.minimapManager.updateCameraMiniMapEvt() }

  // PlayerStats delegate
  updatePlayerStats() { return this.playerStatsManager.update() }

  // Bottombar delegates
  resetInfo() { return this.bottombarManager.resetInfo() }
  generateInfo(selection) { return this.bottombarManager.generateInfo(selection) }
  updateInfo(target, action) { return this.bottombarManager.updateInfo(target, action) }
  updateButtonContent(target, action) { return this.bottombarManager.updateButtonContent(target, action) }
  toggleButtonCancel(target, value) { return this.bottombarManager.toggleButtonCancel(target, value) }
  updateBottombar() { return this.bottombarManager.updateBottombar() }
  setBottombar(selection) { return this.bottombarManager.setBottombar(selection) }
  getMessage(cost) { return this.bottombarManager.getMessage(cost) }
  getUnitButton(type) { return this.bottombarManager.getUnitButton(type) }
  getBuildingButton(type) { return this.bottombarManager.getBuildingButton(type) }
  getTechnologyButton(type) { return this.bottombarManager.getTechnologyButton(type) }
}
