import { Container, Graphics } from 'pixi.js'
import { isometricToCartesian } from '../lib'
import { CameraController } from '../controllers/CameraController'
import { BuildingPlacer } from '../controllers/BuildingPlacer'
import { SelectionManager } from '../controllers/SelectionManager'

const ARROW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'])

export default class Controls extends Container {
  constructor(context) {
    super()

    this.context = context

    const { map, gamebox } = context

    this.sortableChildren = true

    this.mouse = {
      x: 0,
      y: 0,
      prevent: false,
    }

    this.cameraController = new CameraController(context)
    this.setCamera(Math.floor(map.size / 2), Math.floor(map.size / 2))

    this.mouseHoldTimeout
    this.keysPressed = {}
    this.keyPressedCount = 0
    this.keyInterval
    this.keySpeed = 0
    this.eventMode = 'auto'
    this.allowMove = false
    this.allowClick = false
    this.mouseRectangle
    this.mouseTouch
    this.mouseDrag = false
    this.minimapRectangle = new Graphics()
    this.addChild(this.minimapRectangle)

    this.fpsVisible = false
    this.fpsEl = document.createElement('div')
    this.fpsEl.style.cssText =
      'position:fixed;right:10px;z-index:9999;color:#fff;font:bold 14px monospace;' +
      'background:rgba(0,0,0,0.65);padding:2px 8px;border-radius:3px;display:none;pointer-events:none;'
    document.body.appendChild(this.fpsEl)
    this._fpsTicker = () => {
      if (this.fpsVisible) {
        this.fpsEl.textContent = `FPS: ${Math.round(context.app.ticker.FPS)}`
      }
    }
    context.app.ticker.add(this._fpsTicker)

    this.buildingPlacer = new BuildingPlacer(this)
    this.selectionManager = new SelectionManager(this)

    this._onDocMouseMove = evt => this.moveCameraWithMouse(evt)
    this._onDocMouseOut = () => this.stopMouseCameraMove()
    this._onKeyDown = evt => this.onKeyDown(evt)
    this._onKeyUp = evt => this.onKeyUp(evt)
    this._onTouchStart = evt => this.onTouchStart(evt)
    this._onTouchEnd = evt => this.onTouchEnd(evt)
    this._onTouchMove = evt => this.onTouchMove(evt)
    this._onMouseMove = evt => this.onMouseMove(evt)
    this._onMouseDown = evt => this.onMouseDown(evt)
    this._onMouseUp = evt => this.onMouseUp(evt)

    document.addEventListener('mousemove', this._onDocMouseMove)
    document.addEventListener('mouseout', this._onDocMouseOut)
    document.addEventListener('keydown', this._onKeyDown)
    document.addEventListener('keyup', this._onKeyUp)
    gamebox.addEventListener('touchstart', this._onTouchStart)
    gamebox.addEventListener('touchend', this._onTouchEnd)
    gamebox.addEventListener('touchmove', this._onTouchMove)
    gamebox.addEventListener('mousemove', this._onMouseMove)
    gamebox.addEventListener('mousedown', this._onMouseDown)
    gamebox.addEventListener('mouseup', this._onMouseUp)
  }

  destroy() {
    const {
      context: { gamebox },
    } = this

    this.context.app.ticker.remove(this._fpsTicker)
    this.fpsEl.remove()

    document.removeEventListener('mousemove', this._onDocMouseMove)
    document.removeEventListener('mouseout', this._onDocMouseOut)
    document.removeEventListener('keydown', this._onKeyDown)
    document.removeEventListener('keyup', this._onKeyUp)
    gamebox.removeEventListener('touchstart', this._onTouchStart)
    gamebox.removeEventListener('touchend', this._onTouchEnd)
    gamebox.removeEventListener('touchmove', this._onTouchMove)
    gamebox.removeEventListener('mousemove', this._onMouseMove)
    gamebox.removeEventListener('mousedown', this._onMouseDown)
    gamebox.removeEventListener('mouseup', this._onMouseUp)
    this.stopMouseCameraMove()
  }

  get camera() {
    return this.cameraController.camera
  }

  onKeyDown(evt) {
    if (this.context.devConsoleOpen) return

    if (evt.key === 'f' || evt.key === 'F') {
      this.fpsVisible = !this.fpsVisible
      this.fpsEl.style.display = this.fpsVisible ? 'block' : 'none'
      return
    }

    if (evt.key === 'Delete' || evt.keyCode === 8) {
      const {
        context: { player },
      } = this
      for (let i = 0; i < player.selectedUnits.length; i++) {
        player.selectedUnits[i].die()
      }
      if (player.selectedBuilding) {
        player.selectedBuilding.die()
      }
      return
    }

    const handleMoveCamera = () => {
      if (!this.keyInterval) {
        this.keyInterval = setInterval(() => {
          const double = this.keyPressedCount > 1
          if (this.keySpeed < 4) {
            this.keySpeed += 0.2
          }
          if (this.keysPressed['ArrowLeft']) this.moveCamera('left', this.keySpeed, double)
          if (this.keysPressed['ArrowUp']) this.moveCamera('up', this.keySpeed, double)
          if (this.keysPressed['ArrowDown']) this.moveCamera('down', this.keySpeed, double)
          if (this.keysPressed['ArrowRight']) this.moveCamera('right', this.keySpeed, double)
        }, 1)
      }
    }
    if (!evt.repeat) {
      this.keysPressed[evt.key] = true
      this.keyPressedCount++
    }
    if (ARROW_KEYS.has(evt.key)) {
      handleMoveCamera()
    }
  }

  onKeyUp(evt) {
    if (this.context.devConsoleOpen) {
      this.stopKeyboardMove()
      return
    }

    if (!evt.repeat && this.keysPressed[evt.key]) {
      delete this.keysPressed[evt.key]
      this.keyPressedCount--
    }
    if (this.keyPressedCount <= 0) {
      this.keyPressedCount = 0
      clearInterval(this.keyInterval)
      this.keyInterval = null
      this.keySpeed = 0
    }
  }

  onTouchStart(evt) {
    const touch = evt.touches[0]
    if (evt.touches.length === 2) {
      this.mouseTouch = { x: touch.pageX, y: touch.pageY }
    } else {
      this.onMouseDown(touch)
    }
  }

  onTouchMove(evt) {
    const touch = evt.touches[0]
    if (evt.touches.length === 2) {
      this.mouse.x = touch.pageX
      this.mouse.y = touch.pageY

      if (this.mouseTouch) {
        const speedX = Math.abs(this.mouse.x - this.mouseTouch.x) * 2
        const speedY = Math.abs(this.mouse.y - this.mouseTouch.y) * 2
        if (this.mouse.x > this.mouseTouch.x) this.moveCamera('left', speedX, false)
        if (this.mouse.y > this.mouseTouch.y) this.moveCamera('up', speedY, false)
        if (this.mouse.y < this.mouseTouch.y) this.moveCamera('down', speedY, false)
        if (this.mouse.x < this.mouseTouch.x) this.moveCamera('right', speedX, false)
      }
      this.mouseTouch = { x: this.mouse.x, y: this.mouse.y }
    } else {
      this.onMouseMove(touch)
    }
  }

  onTouchEnd(evt) {
    const touch = evt.changedTouches[0]
    if (evt.changedTouches.length === 1) {
      this.onMouseUp(touch)
    }
  }

  onMouseDown(evt) {
    if (this.context.devConsoleOpen) return

    this.mouse.x = evt.pageX
    this.mouse.y = evt.pageY
    if (!this.isMouseInApp(evt)) return
    this.pointerStart = { x: this.mouse.x, y: this.mouse.y }
  }

  onMouseMove(evt) {
    this.mouse.x = evt.pageX
    this.mouse.y = evt.pageY

    if (this.context.devConsoleOpen) return

    if (this.mouseBuilding) {
      this.buildingPlacer.handleMouseMove()
      return
    }
    this.selectionManager.handleMouseMove()
  }

  onMouseUp(evt) {
    if (this.context.devConsoleOpen) return

    const {
      context: { map, player },
    } = this
    this.pointerStart = null
    clearTimeout(this.mouseHoldTimeout)
    if (!this.isMouseInApp(evt) || this.mouse.prevent || this.mouseDrag) {
      this.mouse.prevent = false
      return
    }
    player?.selectedBuilding && player.unselectAll()

    if (this.mouseRectangle) {
      this.selectionManager.handleMouseUp()
      return
    }

    if (this.isMouseInApp(evt)) {
      const pos = isometricToCartesian(this.mouse.x - map.x, this.mouse.y - map.y)
      const i = Math.min(Math.max(pos[0], 0), map.size)
      const j = Math.min(Math.max(pos[1], 0), map.size)
      if (map.grid[i] && map.grid[i][j]) {
        const cell = map.grid[i][j]
        if ((cell.solid || cell.has) && cell.visible) return
        if (this.mouseBuilding) {
          this.buildingPlacer.handleMouseUp(cell)
        } else if (player?.selectedUnits.length) {
          this.selectionManager.handleClick(cell)
        }
      }
    }
  }

  sendUnits(cell) {
    return this.selectionManager.sendUnits(cell)
  }

  getCellUnderCursor() {
    const {
      context: { map },
    } = this
    const pos = isometricToCartesian(this.mouse.x - map.x, this.mouse.y - map.y)
    const i = Math.min(Math.max(pos[0], 0), map.size)
    const j = Math.min(Math.max(pos[1], 0), map.size)
    return map.grid[i]?.[j] || null
  }

  isMouseInApp(evt) {
    return evt.target && (!evt.target.tagName || evt.target.closest('#game'))
  }

  removeMouseBuilding() {
    return this.buildingPlacer.removeMouseBuilding()
  }

  setMouseBuilding(building) {
    return this.buildingPlacer.setMouseBuilding(building)
  }

  moveCamera(dir, moveSpeed, isSpeedDivided) {
    this.cameraController.move(dir, moveSpeed, isSpeedDivided)
  }

  moveCameraWithMouse(evt) {
    this.cameraController.moveWithMouse(evt)
  }

  stopMouseCameraMove() {
    this.cameraController.stopMouseMove()
  }

  stopKeyboardMove() {
    this.keysPressed = {}
    this.keyPressedCount = 0
    clearInterval(this.keyInterval)
    this.keyInterval = null
    this.keySpeed = 0
  }

  instanceInCamera(instance) {
    return this.cameraController.instanceInCamera(instance)
  }

  instanceIsAudible(instance) {
    const {
      context: { map },
    } = this

    if (!this.instanceInCamera(instance)) return false
    if (map.revealEverything) return true
    if (instance.owner?.isPlayed || instance.owner?.owner?.isPlayed) return true

    return Boolean(instance.visible || instance.owner?.visible || instance.target?.visible)
  }

  getCellOnCamera(callback) {
    this.cameraController.getCellOnCamera(callback)
  }

  updateVisibleCells() {
    this.cameraController.updateVisibleCells()
  }

  init() {
    const {
      context: { player, map },
    } = this

    const topbar = document.getElementById('topbar')
    this.fpsEl.style.top = (topbar ? topbar.clientHeight + 5 : 50) + 'px'

    if (player?.buildings?.length) {
      this.setCamera(player.buildings[0].x, player.buildings[0].y)
    } else if (player?.units?.length) {
      this.setCamera(player.units[0].x, player.units[0].y)
    } else {
      this.setCamera(map.size / 2, map.size / 2)
    }
  }

  setCamera(x, y, direct) {
    this.cameraController.set(x, y, direct)
  }
}
