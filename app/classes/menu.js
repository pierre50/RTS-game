import { Assets } from 'pixi.js'
import { getIconPath, canAfford, refundCost, throttle } from '../lib'
import { cellWidth, cellHeight } from '../constants'

export default class Menu {
  constructor(context) {
    this.context = context
    this.topbar = document.createElement('div')
    this.topbar.id = 'topbar'
    this.topbar.className = 'topbar bar'
    this.icons = {
      wood: 'interface/50732/000_50732.png',
      food: 'interface/50732/002_50732.png',
      stone: 'interface/50732/001_50732.png',
      gold: 'interface/50732/003_50732.png',
    }

    this.resources = document.createElement('div')
    this.resources.className = 'resources'
    ;['wood', 'food', 'stone', 'gold'].forEach(res => {
      this.setResourceBox(res)
    })

    this.age = document.createElement('div')
    this.age.className = 'age'
    this.options = document.createElement('div')

    this.topbar.appendChild(this.resources)
    this.topbar.appendChild(this.age)
    this.topbar.appendChild(this.options)
    document.body.prepend(this.topbar)

    this.bottombar = document.createElement('div')
    this.bottombar.className = 'bottombar bar'
    this.bottombarInfo = document.createElement('div')
    this.bottombarInfo.className = 'bottombar-info'
    this.bottombarMenu = document.createElement('div')
    this.bottombarMenu.className = 'bottombar-menu'
    this.bottombarMap = document.createElement('div')
    this.bottombarMap.className = 'bottombar-map'
    this.bottombarMap.addEventListener('pointerup', evt => {
      const {
        context: { controls },
      } = this
      const minimapFactor = this.getMinimapFactor()
      const rect = evt.target.getBoundingClientRect()
      const x = (evt.clientX - rect.left - rect.width / 2) * minimapFactor
      const y = (evt.clientY - rect.top) * minimapFactor
      controls.clearInstancesOnScreen()
      controls.setCamera(x, y)
    })
    this.terrainMinimap = document.createElement('canvas')
    this.playersMinimap = []
    this.cameraMinimap = document.createElement('canvas')
    this.cameraMinimap.style.zIndex = 1

    this.bottombarMap.appendChild(this.terrainMinimap)
    this.bottombarMap.appendChild(this.cameraMinimap)
    this.bottombar.appendChild(this.bottombarInfo)
    this.bottombar.appendChild(this.bottombarMenu)
    this.bottombar.appendChild(this.bottombarMap)
    document.body.appendChild(this.bottombar)

    this.updatePlayerMiniMap = throttle(this.updatePlayerMiniMapEvt, 100)
    this.updateCameraMiniMap = throttle(this.updateCameraMiniMapEvt, 100)

    this.updateTopbar()
  }

  init() {
    this.createMiniMap()
    this.updateTopbar()
  }

  getMinimapFactor() {
    const {
      context: { map },
    } = this
    const mapWidth = cellWidth / 2 + (map.size * cellWidth) / 2
    return (mapWidth / 234) * 2
  }

  createMiniMap() {
    function drawDiamond(context, x, y, width, height, color) {
      context.save()
      context.beginPath()
      context.moveTo(x, y)

      context.lineTo(x - width / 2, y + height / 2)
      context.lineTo(x, y + height)
      context.lineTo(x + width / 2, y + height / 2)
      context.closePath()

      context.fillStyle = color
      context.fill()
      context.restore()
    }
    const canvasElement = this.terrainMinimap
    const context = canvasElement.getContext('2d')
    const cameraContext = this.cameraMinimap.getContext('2d')

    const {
      context: { map },
    } = this

    const minimapFactor = this.getMinimapFactor() / 1.284
    const mapWidth = cellWidth / 2 + (map.size * cellWidth) / 2
    const translate = mapWidth / 2 / minimapFactor
    context.translate(translate, 0)
    cameraContext.translate(translate, 0)

    for (let i = 0; i <= map.size; i++) {
      for (let j = 0; j <= map.size; j++) {
        const cell = map.grid[i][j]
        const x = cell.x
        const y = cell.y
        const color = (cell.has && cell.has.color) || cell.color
        drawDiamond(
          context,
          x / minimapFactor + translate,
          y / minimapFactor,
          cellWidth / minimapFactor + 1,
          cellHeight / minimapFactor + 1,
          color
        )
      }
    }
    context.restore()
  }

  updateCameraMiniMapEvt() {
    function drawStrokeRectangle(context, x, y, width, height, color) {
      context.strokeStyle = color
      context.strokeRect(x, y, width, height)
    }

    const {
      context: { app, map, controls },
    } = this

    const canvas = this.cameraMinimap
    const context = canvas.getContext('2d')

    const minimapFactor = this.getMinimapFactor() / 1.284
    const mapWidth = cellWidth / 2 + (map.size * cellWidth) / 2
    const translate = mapWidth / 2 / minimapFactor

    context.clearRect(-translate, 0, canvas.width, canvas.height)

    const x = controls.camera.x / minimapFactor
    const y = controls.camera.y / minimapFactor
    const w = app.screen.width / minimapFactor
    const h = app.screen.height / minimapFactor
    drawStrokeRectangle(context, x + translate, y, w, h, 'white')
  }

  updatePlayerMiniMapEvt(owner) {
    function drawRectangle(context, x, y, width, height, color) {
      context.fillStyle = color
      context.fillRect(x, y, width, height)
      context.fill()
    }

    if (!owner) {
      return
    }

    const {
      context: { map },
    } = this

    const squareSize = 5
    const playerMinimap = this.playersMinimap.find(({ id }) => id === `minimap-${owner.id}`)
    const color = owner.colorHex

    let canvas
    let context

    const minimapFactor = this.getMinimapFactor() / 1.284
    const mapWidth = cellWidth / 2 + (map.size * cellWidth) / 2
    const translate = mapWidth / 2 / minimapFactor

    if (playerMinimap) {
      canvas = playerMinimap.canvas
      context = playerMinimap.context
    } else {
      canvas = document.createElement('canvas')
      context = canvas.getContext('2d')
      context.translate(translate, 0)
      this.playersMinimap.push({
        id: `minimap-${owner.id}`,
        canvas,
        context,
      })
      this.bottombarMap.appendChild(canvas)
    }

    context.clearRect(-translate, 0, canvas.width, canvas.height)

    owner.buildings.forEach(({ x, y, size, selected }) => {
      const finalSize = squareSize + size
      const finalX = x / minimapFactor - finalSize / 2
      const finalY = y / minimapFactor - finalSize / 2
      drawRectangle(context, finalX + translate, finalY, finalSize, finalSize, selected ? 'white' : color)
    })

    owner.units.forEach(({ x, y, selected }) => {
      const finalX = x / minimapFactor - squareSize / 2
      const finalY = y / minimapFactor - squareSize / 2
      drawRectangle(context, finalX + translate, finalY, squareSize, squareSize, selected ? 'white' : color)
    })

    context.restore()
  }

  getMessage(cost) {
    const {
      context: { player },
    } = this
    const resource = Object.keys(cost).find(prop => player[prop] < cost[prop])
    return `You need more ${resource} !`
  }

  showMessage(message) {
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
    window.gamebox.appendChild(box)
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

  updateTopbar() {
    const {
      context: { player },
    } = this
    ;['wood', 'food', 'stone', 'gold', 'age'].forEach(prop => {
      this[prop].textContent = (player && player[prop]) || 0
    })
  }

  resetInfo() {
    this.bottombarInfo.textContent = ''
    this.bottombarInfo.style.background = 'transparent'
  }

  generateInfo(selection) {
    this.resetInfo()
    this.bottombarInfo.style.background = 'black'
    if (typeof selection.interface.info === 'function') {
      selection.interface.info(this.bottombarInfo)
    }
  }

  updateInfo(target, action) {
    const targetElement = this.bottombarInfo.querySelector(`[id=${target}]`)
    if (!targetElement || typeof action !== 'function') {
      return
    }
    return action(targetElement)
  }

  updateButtonContent(target, action) {
    const targetElement = this.bottombarMenu.querySelector(`[id=${target}]`)
    if (!targetElement || typeof action !== 'function') {
      return
    }
    const contentElement = targetElement.querySelector('[id=content]')
    if (!contentElement) {
      return
    }
    return action(contentElement)
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
      if (selection.name === 'building') {
        if (!selection.isBuilt) {
          setMenuRecurs(selection, this.bottombarMenu, [])
          return
        }
      }
      setMenuRecurs(selection, this.bottombarMenu, selection.interface.menu || [])
    }
    function setMenuRecurs(selection, element, menu, parent) {
      menu.forEach(btn => {
        const box = document.createElement('div')
        box.className = 'bottombar-menu-box'
        box.id = btn.id
        if (typeof btn.onCreate === 'function') {
          btn.onCreate(selection, box)
        } else {
          const img = document.createElement('img')
          img.src = btn.icon
          img.className = 'img'
          box.appendChild(img)
        }

        if (btn.children) {
          box.addEventListener('pointerup', () => {
            element.textContent = ''
            controls.removeMouseBuilding()
            setMenuRecurs(selection, element, btn.children, menu)
          })
        } else if (typeof btn.onClick === 'function') {
          box.addEventListener('pointerup', evt => btn.onClick(selection, evt))
        }
        element.appendChild(box)
      })
      if (parent || selection.selected) {
        const back = document.createElement('div')
        back.className = 'bottombar-menu-box'
        const img = document.createElement('img')
        img.className = 'img'
        back.id = 'interfaceBackBtn'
        img.src = 'interface/50721/010_50721.png'
        if (parent) {
          back.addEventListener('pointerup', () => {
            element.textContent = ''
            controls.removeMouseBuilding()
            setMenuRecurs(selection, element, parent)
          })
        } else {
          back.addEventListener('pointerup', () => {
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
    const unit = Assets.cache.get('config').units[type]
    return {
      icon: getIconPath(unit.icon),
      id: type,
      onCreate: (selection, element) => {
        const div = document.createElement('div')
        div.className = 'bottombar-menu-column'
        const cancel = document.createElement('img')
        cancel.id = `${type}-cancel`
        cancel.className = 'img'
        cancel.src = 'interface/50721/003_50721.png'
        if (!selection.queue.filter(q => q === type).length) {
          cancel.style.display = 'none'
        }
        cancel.addEventListener('pointerup', () => {
          for (let i = 0; i < selection.queue.length; i++) {
            if (selection.queue[i] === type) {
              refundCost(player, unit.cost)
            }
          }
          this.updateTopbar()
          selection.queue = selection.queue.filter(q => q !== type)
          if (selection.queue[0] !== type) {
            this.updateButtonContent(type, element => (element.textContent = ''))
            this.toggleButtonCancel(type, false)
          }
        })
        const img = document.createElement('img')
        img.src = getIconPath(unit.icon)
        img.className = 'img'
        img.addEventListener('pointerup', () => {
          if (canAfford(player, unit.cost)) {
            if (player.population >= player.populationMax) {
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
    const building = Assets.cache.get('config').buildings[player.civ][player.age][type]
    return {
      icon: getIconPath(building.icon),
      onClick: () => {
        controls.removeMouseBuilding()
        if (canAfford(player, building.cost)) {
          controls.setMouseBuilding({ ...building, type })
        } else {
          this.showMessage(this.getMessage(building.cost))
        }
      },
    }
  }
}
