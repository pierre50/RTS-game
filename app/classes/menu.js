import { getIconPath, isometricToCartesian, Modal } from '../lib'
import { LONG_CLICK_DURATION, IS_MOBILE } from '../constants'
import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'
import { MinimapManager } from '../ui/MinimapManager'
import { BottombarManager } from '../ui/BottombarManager'
import { PlayerStatsManager } from '../ui/PlayerStatsManager'

export default class Menu {
  constructor(context) {
    this.context = context
    this.topbar = document.createElement('div')
    this.topbar.id = 'topbar'
    this.topbar.className = 'topbar bar'
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

    this.longClick = false
    this.mouseHoldTimeout

    this.resources = document.createElement('div')
    this.resources.className = 'topbar-resources'
    ;['wood', 'food', 'stone', 'gold'].forEach(res => {
      this.setResourceBox(res)
    })

    this.age = document.createElement('div')
    this.age.className = 'topbar-age'
    const options = document.createElement('div')
    options.className = 'topbar-options'
    const menu = document.createElement('div')
    menu.className = 'topbar-options-menu'
    menu.innerText = t('menuBtn')
    menu.addEventListener('pointerdown', () => {
      playClickSound()
      this.context.pause()
      const content = document.createElement('div')
      content.className = 'modal-menu'
      const modal = new Modal(content)
      const save = document.createElement('button')
      save.className = 'menu-btn'
      save.innerText = t('save')
      save.addEventListener('pointerdown', () => {
        playClickSound()
        this.context.save()
        modal.close()
        this.context.resume()
      })
      const load = document.createElement('div')
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'application/JSON'
      input.addEventListener('change', evt => {
        const reader = new FileReader()
        reader.onload = ({ target: { result } }) => {
          this.context.load(JSON.parse(result))
          modal.close()
          this.context.resume()
        }
        reader.readAsText(evt.target.files[0])
      })
      load.className = 'input-file menu-btn'
      load.innerText = t('load')
      load.addEventListener('pointerdown', playClickSound)
      load.appendChild(input)
      const quit = document.createElement('button')
      quit.className = 'menu-btn secondary'
      quit.innerText = t('quit')
      quit.addEventListener('pointerdown', () => {
        playClickSound()
        modal.close()
        this.context.quit()
      })
      const cancel = document.createElement('button')
      cancel.className = 'menu-btn secondary'
      cancel.innerText = t('cancel')
      cancel.addEventListener('pointerdown', () => {
        playClickSound()
        modal.close()
        this.context.resume()
      })
      content.appendChild(save)
      content.appendChild(load)
      content.appendChild(quit)
      content.appendChild(cancel)
    })
    options.appendChild(menu)

    this.topbar.appendChild(this.resources)
    this.topbar.appendChild(this.age)
    this.topbar.appendChild(options)
    document.body.prepend(this.topbar)

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
    this.bottombarMap.addEventListener('pointerdown', evt => {
      const {
        context: { controls },
      } = this
      this.mouseHoldTimeout = setTimeout(() => {
        this.longClick = true
        const minimapFactor = this.minimapManager.getMinimapFactor()
        const rect = evt.target.getBoundingClientRect()
        const x = (evt.clientX - rect.left - rect.width / 2) * minimapFactor
        const y = (evt.clientY - rect.top - 3) * minimapFactor
        controls.setCamera(x, y)
      }, LONG_CLICK_DURATION)
    })
    this.bottombarMap.addEventListener('pointerup', evt => {
      const {
        context: { player, controls, map },
      } = this
      clearTimeout(this.mouseHoldTimeout)
      if (controls.mouseBuilding || controls.mouseRectangle || this.longClick) {
        this.longClick = false
        return
      }
      this.longClick = false
      const minimapFactor = this.minimapManager.getMinimapFactor()
      const rect = evt.target.getBoundingClientRect()
      const x = (evt.clientX - rect.left - rect.width / 2) * minimapFactor
      const y = (evt.clientY - rect.top - 3) * minimapFactor

      if (player?.selectedUnits?.length) {
        const pos = isometricToCartesian(x, y)
        const i = Math.min(Math.max(pos[0], 0), map.size)
        const j = Math.min(Math.max(pos[1], 0), map.size)
        if (map.grid[i] && map.grid[i][j]) {
          controls.sendUnits(map.grid[i][j])
        }
      } else {
        controls.setCamera(x, y)
      }
    })
    bottombarMapWrap.appendChild(this.bottombarMap)

    this.terrainMinimap = document.createElement('canvas')
    this.playersMinimap = []
    this.resourcesMinimap = document.createElement('canvas')
    this.cameraMinimap = document.createElement('canvas')
    this.cameraMinimap.style.zIndex = 1

    this.bottombarMap.appendChild(this.terrainMinimap)
    this.bottombarMap.appendChild(this.resourcesMinimap)
    this.bottombarMap.appendChild(this.cameraMinimap)
    this.bottombar.appendChild(this.bottombarInfo)
    this.bottombar.appendChild(this.bottombarMenu)
    this.bottombar.appendChild(bottombarMapWrap)
    document.body.appendChild(this.bottombar)

    this.toggled = false
    this.toggle = document.createElement('div')
    this.toggle.className = 'toggle'
    this.toggle.innerText = 'x'
    this.toggle.addEventListener('pointerdown', evt => {
      evt.preventDefault()
      if (this.toggled) {
        this.toggle.innerText = 'x'
        this.bottombar.style.display = 'grid'
        this.toggled = false
      } else {
        this.bottombar.style.display = 'none'
        this.toggle.innerText = 'o'
        this.toggled = true
      }
      evt.stopPropagation()
    })
    IS_MOBILE && document.body.prepend(this.toggle)

    this.minimapManager = new MinimapManager(this)
    this.bottombarManager = new BottombarManager(this)
    this.playerStatsManager = new PlayerStatsManager(this)

    // Expose throttled minimap updaters as top-level properties for external callers
    this.updatePlayerMiniMap = this.minimapManager.updatePlayerMiniMap
    this.updateResourcesMiniMap = this.minimapManager.updateResourcesMiniMap
    this.updateCameraMiniMap = this.minimapManager.updateCameraMiniMap

    this._infoCache = null
    this.selection = null
    this.updateTopbar()
  }

  destroy() {
    this.playerStatsManager.destroy()
    this.bottombar.remove()
    this.topbar.remove()
  }

  init() {
    this.minimapManager.initMiniMap()
    this.updateTopbar()
  }

  setResourceBox(name) {
    const box = document.createElement('div')
    box.className = 'resource'

    const img = document.createElement('img')
    img.className = 'resource-content'
    img.src = this.icons[name]

    this[name] = document.createElement('div')
    box.appendChild(img)
    box.appendChild(this[name])
    this.resources.appendChild(box)
  }

  updateTopbar() {
    const {
      context: { player },
    } = this
    const ageLabels = {
      0: t('stoneAge'),
      1: t('toolAge'),
      2: t('bronzeAge'),
      3: t('ironAge'),
    }
    ;['wood', 'food', 'stone', 'gold', 'age'].forEach(prop => {
      const val = Math.min((player && player[prop]) || 0, 99999)
      this[prop].textContent = prop === 'age' ? ageLabels[val] : val
    })
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
      bottom: this.bottombar.clientHeight + 5 + 'px',
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
