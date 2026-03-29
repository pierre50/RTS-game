import { Assets } from 'pixi.js'
import {
  getIconPath,
  canAfford,
  refundCost,
  throttle,
  canvasDrawDiamond,
  canvasDrawRectangle,
  canvasDrawStrokeRectangle,
  isValidCondition,
  getBuildingAsset,
  Modal,
  isometricToCartesian,
} from '../lib'
import { CELL_WIDTH, CELL_HEIGHT, LONG_CLICK_DURATION, IS_MOBILE, FAMILY_TYPES } from '../constants'
import { sound } from '@pixi/sound'

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
    menu.innerText = 'Menu'
    menu.addEventListener('pointerdown', () => {
      this.context.pause()
      const content = document.createElement('div')
      content.className = 'modal-menu'
      const modal = new Modal(content)
      const save = document.createElement('button')
      save.className = 'menu-btn'
      save.innerText = 'Sauvegarder'
      save.addEventListener('pointerdown', () => {
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
      load.innerText = 'Charger'
      load.appendChild(input)
      const quit = document.createElement('button')
      quit.className = 'menu-btn secondary'
      quit.innerText = 'Quitter'
      quit.addEventListener('pointerdown', () => {
        modal.close()
        this.context.quit()
      })
      const cancel = document.createElement('button')
      cancel.className = 'menu-btn secondary'
      cancel.innerText = 'Annuler'
      cancel.addEventListener('pointerdown', () => {
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
        const minimapFactor = this.getMinimapFactor()
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
      const minimapFactor = this.getMinimapFactor()
      const rect = evt.target.getBoundingClientRect()
      const x = (evt.clientX - rect.left - rect.width / 2) * minimapFactor
      const y = (evt.clientY - rect.top - 3) * minimapFactor

      if (player?.selectedUnits?.length) {
        const pos = isometricToCartesian(x, y)
        const i = Math.min(Math.max(pos[0], 0), map.size)
        const j = Math.min(Math.max(pos[1], 0), map.size)
        if (map.grid[i] && map.grid[i][j]) {
          const cell = map.grid[i][j]
          controls.sendUnits(cell)
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

    this.updatePlayerMiniMap = throttle(this.updatePlayerMiniMapEvt, 500)
    this.updateResourcesMiniMap = throttle(this.updateResourcesMiniMapEvt, 500)
    this.updateCameraMiniMap = throttle(this.updateCameraMiniMapEvt, 100)

    this.miniMapAlpha = 1.284
    this.updateTopbar()
  }

  destroy() {
    this.bottombar.remove()
    this.topbar.remove()
  }

  init() {
    this.initMiniMap()
    this.updateTopbar()
  }

  getMinimapFactor() {
    const { map } = this.context
    return (CELL_WIDTH / 2 + (map.size * CELL_WIDTH) / 2) / 234 * 2
  }

  getMinimapParams() {
    const factor = this.getMinimapFactor() / this.miniMapAlpha
    const translate = (CELL_WIDTH / 2 + (this.context.map.size * CELL_WIDTH) / 2) / 2 / factor
    return { factor, translate }
  }

  initMiniMap() {
    const { translate } = this.getMinimapParams()
    for (const canvas of [this.terrainMinimap, this.cameraMinimap, this.resourcesMinimap]) {
      canvas.getContext('2d').translate(translate, 0)
    }
    const { map } = this.context
    if (map.revealEverything || map.revealTerrain) {
      this.revealTerrainMinimap()
    }
  }

  revealTerrainMinimap() {
    const { map } = this.context
    const canvas = this.terrainMinimap
    const context = canvas.getContext('2d')
    const { factor, translate } = this.getMinimapParams()

    context.clearRect(-translate, 0, canvas.width, canvas.height)
    for (let i = 0; i <= map.size; i++) {
      for (let j = 0; j <= map.size; j++) {
        const cell = map.grid[i][j]
        canvasDrawDiamond(
          context,
          cell.x / factor + translate,
          cell.y / factor,
          CELL_WIDTH / factor + 1,
          CELL_HEIGHT / factor + 1,
          cell.color
        )
      }
    }
  }

  updateTerrainMiniMap(i, j) {
    const { map } = this.context
    const canvas = this.terrainMinimap
    const context = canvas.getContext('2d')
    const { factor, translate } = this.getMinimapParams()
    const cell = map.grid[i][j]

    canvasDrawDiamond(
      context,
      cell.x / factor + translate,
      cell.y / factor,
      CELL_WIDTH / factor + 1,
      CELL_HEIGHT / factor + 1,
      cell.color
    )
    if (cell.has && cell.has.family === FAMILY_TYPES.resource) {
      this.updateResourceMiniMap(cell.has)
    }
  }

  updateResourceMiniMap(resource) {
    const context = this.resourcesMinimap.getContext('2d')
    const { factor, translate } = this.getMinimapParams()
    const squareSize = 4
    canvasDrawRectangle(
      context,
      resource.x / factor - squareSize / 2 + translate,
      resource.y / factor - squareSize / 2,
      squareSize,
      squareSize,
      resource.color
    )
  }

  updateResourcesMiniMapEvt() {
    const { map, player } = this.context
    const canvas = this.resourcesMinimap
    const context = canvas.getContext('2d')
    const { factor, translate } = this.getMinimapParams()
    const squareSize = 4

    context.clearRect(-translate, 0, canvas.width, canvas.height)
    map.resources.forEach(resource => {
      const cell = player?.views?.[resource.i]?.[resource.j]
      if (resource.color && (cell?.viewed || map.revealEverything)) {
        canvasDrawRectangle(
          context,
          resource.x / factor - squareSize / 2 + translate,
          resource.y / factor - squareSize / 2,
          squareSize,
          squareSize,
          resource.color
        )
      }
    })
  }

  updateCameraMiniMapEvt() {
    const { app, controls } = this.context
    const canvas = this.cameraMinimap
    const context = canvas.getContext('2d')
    const { factor, translate } = this.getMinimapParams()

    context.clearRect(-translate, 0, canvas.width, canvas.height)
    canvasDrawStrokeRectangle(
      context,
      controls.camera.x / factor + translate,
      controls.camera.y / factor,
      app.screen.width / factor,
      app.screen.height / factor,
      'white'
    )
  }

  updatePlayerMiniMapEvt(owner) {
    if (!owner) return

    const squareSize = 4
    const { factor, translate } = this.getMinimapParams()
    const color = owner.colorHex
    const id = `minimap-${owner.label}`

    let canvas, context
    const existing = this.playersMinimap.find(p => p.id === id)
    if (existing) {
      canvas = existing.canvas
      context = existing.context
    } else {
      canvas = document.createElement('canvas')
      context = canvas.getContext('2d')
      context.translate(translate, 0)
      this.playersMinimap.push({ id, canvas, context })
      this.bottombarMap.appendChild(canvas)
    }

    context.clearRect(-translate, 0, canvas.width, canvas.height)

    owner.buildings.forEach(({ x, y, size, selected }) => {
      const finalSize = squareSize + size
      canvasDrawRectangle(context, x / factor - finalSize / 2 + translate, y / factor - finalSize / 2, finalSize, finalSize, selected ? 'white' : color)
    })
    owner.units.forEach(({ x, y, selected }) => {
      canvasDrawRectangle(context, x / factor - squareSize / 2 + translate, y / factor - squareSize / 2, squareSize, squareSize, selected ? 'white' : color)
    })
  }

  getMessage(cost) {
    const {
      context: { player },
    } = this
    const resource = Object.keys(cost).find(prop => player[prop] < cost[prop])
    return `You need more ${resource} !`
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

  updateBottombar() {
    const {
      context: { player },
    } = this
    if (player.selectedBuilding || player.selectedUnit) {
      this.setBottombar(player.selectedBuilding || player.selectedUnit)
    }
  }

  updateTopbar() {
    const {
      context: { player },
    } = this
    const t = {
      0: 'Stone Age',
      1: 'Tool Age',
      2: 'Bronze Age',
      3: 'Iron Age',
    }
    ;['wood', 'food', 'stone', 'gold', 'age'].forEach(prop => {
      const val = Math.min((player && player[prop]) || 0, 99999)
      this[prop].textContent = prop === 'age' ? t[val] : val
    })
  }

  resetInfo() {
    this.bottombarInfo.textContent = ''
    this.bottombarInfo.style.background = 'transparent'
    this._infoCache = null
  }

  generateInfo(selection) {
    this.resetInfo()
    this.bottombarInfo.style.background = 'black'
    if (typeof selection.interface.info === 'function') {
      selection.interface.info(this.bottombarInfo)
    }
  }

  updateInfo(target, action) {
    if (!this._infoCache) this._infoCache = new Map()
    let targetElement = this._infoCache.get(target)
    if (!targetElement) {
      targetElement = this.bottombarInfo.querySelector(`[id=${target}]`)
      if (!targetElement) return
      this._infoCache.set(target, targetElement)
    }
    return typeof action !== 'function' ? (targetElement.textContent = action) : action(targetElement)
  }

  updateButtonContent(target, action) {
    const targetElement = this.bottombarMenu.querySelector(`[id=${target}]`)
    if (!targetElement) {
      return
    }
    const contentElement = targetElement.querySelector('[id=content]')
    if (!contentElement) {
      return
    }
    return typeof action !== 'function' ? (contentElement.textContent = action) : action(contentElement)
  }

  toggleButtonCancel(target, value) {
    const element = this.bottombarMenu.querySelector(`[id=${target}-cancel]`)
    if (!element) {
      return
    }
    element.style.display = value ? 'block' : 'none'
  }

  setBottombar(selection = null) {
    const {
      context: { controls, player },
    } = this

    this.resetInfo()
    this.bottombarMenu.textContent = ''
    this.selection = selection
    if (controls.mouseBuilding) {
      controls.removeMouseBuilding()
    }
    if (selection && selection.interface) {
      this.generateInfo(selection)
      if (selection.family === FAMILY_TYPES.building) {
        if (!selection.isBuilt) {
          setMenuRecurs(selection, this.bottombarMenu, [])
        } else if (selection.technology) {
          setMenuRecurs(selection, this.bottombarMenu, [
            {
              icon: 'assets/interface/50721/003_50721.png',
              id: `${selection.technology}-cancel`,
              onClick: selection => {
                sound.play('5036')
                selection.cancelTechnology()
              },
            },
          ])
        } else {
          setMenuRecurs(selection, this.bottombarMenu, selection.interface.menu || [])
        }
      } else {
        setMenuRecurs(selection, this.bottombarMenu, selection.interface.menu || [])
      }
    }
    function setMenuRecurs(selection, element, menu, parent) {
      menu
        .filter(btn => !btn.hide || !btn.hide())
        .forEach((btn, index) => {
          const box = document.createElement('div')
          box.className = 'bottombar-menu-box'
          box.id = btn.id || `btn-${index}`
          if (typeof btn.onCreate === 'function') {
            btn.onCreate(selection, box)
          } else {
            const img = document.createElement('img')
            img.src = typeof btn.icon === 'function' ? btn.icon() : btn.icon
            img.className = 'img'
            box.appendChild(img)
          }

          if (btn.children) {
            box.addEventListener('pointerup', () => {
              sound.play('5036')
              element.textContent = ''
              controls.removeMouseBuilding()
              setMenuRecurs(selection, element, btn.children, menu)
            })
          } else if (typeof btn.onClick === 'function') {
            box.addEventListener('pointerup', evt => {
              sound.play('5036')
              btn.onClick(selection, evt)
            })
          }
          element.appendChild(box)
        })
      if (parent || selection.selected) {
        const back = document.createElement('div')
        back.className = 'bottombar-menu-box'
        const img = document.createElement('img')
        img.className = 'img'
        back.id = 'interfaceBackBtn'
        img.src = 'assets/interface/50721/010_50721.png'
        if (parent) {
          back.addEventListener('pointerup', () => {
            sound.play('5036')
            element.textContent = ''
            controls.removeMouseBuilding()
            setMenuRecurs(selection, element, parent)
          })
        } else {
          back.addEventListener('pointerup', () => {
            sound.play('5036')
            controls.removeMouseBuilding()
            player.unselectAll()
          })
        }
        back.appendChild(img)
        element.appendChild(back)
      }
    }
  }

  getUnitButton(type) {
    const {
      context: { player },
    } = this
    const unit = player.config.units[type]
    return {
      id: type,
      icon: () => getIconPath(unit.icon),
      hide: () => (unit.conditions || []).some(condition => !isValidCondition(condition, player)),
      onCreate: (selection, element) => {
        const div = document.createElement('div')
        div.className = 'bottombar-menu-column'
        const cancel = document.createElement('img')
        cancel.id = `${type}-cancel`
        cancel.className = 'img'
        cancel.src = 'assets/interface/50721/003_50721.png'
        if (!selection.queue.some(q => q === type)) {
          cancel.style.display = 'none'
        }
        cancel.addEventListener('pointerup', () => {
          sound.play('5036')
          for (let i = 0; i < selection.queue.length; i++) {
            if (selection.queue[i] === type) {
              refundCost(player, unit.cost)
            }
          }
          this.updateTopbar()
          selection.queue = selection.queue.filter(q => q !== type)
          if (selection.queue[0] !== type) {
            this.updateButtonContent(type, '')
            this.toggleButtonCancel(type, false)
          }
        })
        const img = document.createElement('img')
        img.src = getIconPath(unit.icon)
        img.className = 'img'
        img.addEventListener('pointerup', () => {
          sound.play('5036')
          if (canAfford(player, unit.cost)) {
            if (player.population >= player.population_max) {
              this.showMessage('You need to build more houses')
            }
            this.toggleButtonCancel(type, true)
            selection.buyUnit(type)
          } else {
            this.showMessage(this.getMessage(unit.cost))
          }
        })
        const queue = selection.queue.filter(queue => queue === type).length
        const counter = document.createElement('div')
        counter.id = 'content'
        counter.textContent = queue || ''
        counter.style.padding = '1px'
        counter.style.position = 'absolute'
        div.appendChild(img)
        div.appendChild(cancel)
        element.appendChild(div)
        element.appendChild(counter)
      },
    }
  }

  getBuildingButton(type) {
    const {
      context: { controls, player },
    } = this
    const config = player.config.buildings[type]
    return {
      id: type,
      icon: () => {
        const assets = getBuildingAsset(type, player, Assets)
        return getIconPath(assets.icon)
      },
      hide: () => (config.conditions || []).some(condition => !isValidCondition(condition, player)),
      onClick: () => {
        const assets = getBuildingAsset(type, player, Assets)
        controls.removeMouseBuilding()
        if (canAfford(player, config.cost)) {
          controls.setMouseBuilding({ ...config, ...assets, type })
        } else {
          this.showMessage(this.getMessage(config.cost))
        }
      },
    }
  }

  getTechnologyButton(type) {
    const {
      context: { controls, player },
    } = this
    const config = player.techs[type]
    return {
      icon: getIconPath(config.icon),
      id: type,
      hide: () =>
        (config.conditions || []).some(
          condition => player.technologies.includes(type) || !isValidCondition(condition, player)
        ),
      onClick: selection => {
        controls.removeMouseBuilding()
        if (canAfford(player, config.cost)) {
          selection.buyTechnology(type)
        } else {
          this.showMessage(this.getMessage(config.cost))
        }
      },
    }
  }
}
