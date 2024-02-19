import { sound } from '@pixi/sound'
import { Container, Graphics, AnimatedSprite, Assets, Sprite } from 'pixi.js'
import {
  isometricToCartesian,
  pointIsBetweenTwoPoint,
  pointsDistance,
  pointInRectangle,
  getPlainCellsAroundPoint,
  changeSpriteColor,
  getTexture,
  randomItem,
  debounce,
} from '../lib'
import { colorWhite, colorRed, cellWidth, cellHeight, maxSelectUnits, accelerator, isMobile } from '../constants'

export default class Controls extends Container {
  constructor(context) {
    super()

    this.context = context

    const { map } = context

    this.sortableChildren = true

    this.mouse = {
      x: 0,
      y: 0,
      prevent: false,
    }

    this.camera = {
      x: 0,
      y: 0,
    }

    this.clearInstancesOnScreen = debounce(this.clearInstancesOnScreenEvt, 40)
    this.displayInstancesOnScreen = debounce(this.displayInstancesOnScreenEvt, 40)

    this.setCamera(Math.floor(map.size / 2), Math.floor(map.size / 2))

    this.mouseHoldTimeout
    this.clicked = false
    this.longClick = false
    this.double = null
    this.doubleClicked = false
    this.keysPressed = {}
    this.eventMode = 'auto'
    this.allowMove = false
    this.allowClick = false
    this.mouseRectangle
    this.mouseLongClick

    this.minimapRectangle = new Graphics()
    this.addChild(this.minimapRectangle)

    document.addEventListener('keydown', evt => this.onKeyDown(evt))
    document.addEventListener('keyup', evt => this.onKeyUp(evt))
    document.addEventListener('pointermove', evt => this.onPointerMove(evt))
    document.addEventListener('pointerdown', evt => this.onPointerDown(evt))
    document.addEventListener('pointerup', evt => this.onPointerUp(evt))
  }

  onKeyDown(evt) {
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

    if (!evt.repeat) {
      this.keysPressed[evt.key] = true
    }
    let pressed = false
    if (this.keysPressed['ArrowLeft']) {
      this.moveCamera('left', null, pressed)
      pressed = true
    }
    if (this.keysPressed['ArrowUp']) {
      this.moveCamera('up', null, pressed)
      pressed = true
    }
    if (this.keysPressed['ArrowDown']) {
      this.moveCamera('down', null, pressed)
      pressed = true
    }
    if (this.keysPressed['ArrowRight']) {
      this.moveCamera('right', null, pressed)
      pressed = true
    }
  }

  onKeyUp(evt) {
    if (!evt.repeat) {
      delete this.keysPressed[evt.key]
    }
  }

  onPointerMove(evt) {
    const {
      context: { map, player, app },
    } = this

    this.mouse.x = evt.pageX
    this.mouse.y = evt.pageY

    // Mouse building to place construction
    if (this.mouseBuilding) {
      const pos = isometricToCartesian(
        this.mouse.x - map.x,
        this.mouse.y >= app.screen.height ? app.screen.height - map.y : this.mouse.y - map.y
      )
      const i = Math.min(Math.max(pos[0], 0), map.size)
      const j = Math.min(Math.max(pos[1], 0), map.size)
      if (map.grid[i] && map.grid[i][j]) {
        const cell = map.grid[i][j]
        this.mouseBuilding.x = cell.x - this.camera.x
        this.mouseBuilding.y = cell.y - this.camera.y
        let isFree = true

        const dist = this.mouseBuilding.size === 3 ? 1 : 0
        if (this.mouseBuilding.buildOnWater) {
          let waterBorderedCells = 0
          let waterCells = 0
          getPlainCellsAroundPoint(i, j, map.grid, dist, cell => {
            if (cell.inclined || cell.solid || !cell.visible) {
              isFree = false
              return
            }
            if (cell.waterBorder) {
              waterBorderedCells++
            } else if (cell.category === 'Water') {
              waterCells++
            }
          })
          if (waterBorderedCells < 2 || waterCells < 4) {
            isFree = false
          }
        } else {
          getPlainCellsAroundPoint(i, j, map.grid, dist, cell => {
            if (cell.category === 'Water' || cell.solid || cell.inclined || cell.border || !cell.visible) {
              isFree = false
              return
            }
          })
        }
        // Color image of mouse building depend on buildable or not
        const sprite = this.mouseBuilding.getChildByName('sprite')
        const color = this.mouseBuilding.getChildByName('color')
        if (isFree) {
          sprite.tint = colorWhite
          if (color) {
            color.tint = colorWhite
          }
        } else {
          sprite.tint = colorRed
          if (color) {
            color.tint = colorRed
          }
        }
        this.mouseBuilding.isFree = isFree
      }
      return
    }

    console.log(isMobile)
    if (isMobile && this.longClick) {
      if (this.mouseLongClick) {
        const speedX = Math.abs(this.mouse.x - this.mouseLongClick.x) * 2
        const speedY = Math.abs(this.mouse.y - this.mouseLongClick.y) * 2
        if (this.mouse.x > this.mouseLongClick.x) {
          this.moveCamera('left', speedX, false)
        }
        if (this.mouse.y > this.mouseLongClick.y) {
          this.moveCamera('up', speedY, false)
        }
        if (this.mouse.y < this.mouseLongClick.y) {
          this.moveCamera('down', speedY, false)
        }
        if (this.mouse.x < this.mouseLongClick.x) {
          this.moveCamera('right', speedX, false)
        }
      }
      this.mouseLongClick = {
        x: this.mouse.x,
        y: this.mouse.y,
      }
      return
    }

    // Create and draw mouse selection
    if (
      !isMobile &&
      !this.mouseRectangle &&
      this.pointerStart &&
      pointsDistance(this.mouse.x, this.mouse.y, this.pointerStart.x, this.pointerStart.y) > 5
    ) {
      this.mouseRectangle = {
        x: this.pointerStart.x,
        y: this.pointerStart.y,
        width: 0,
        height: 0,
        graph: new Graphics(),
      }
      this.addChild(this.mouseRectangle.graph)
    }

    if (this.mouseRectangle && !this.mouseBuilding) {
      if (player.selectedUnits.length || player.selectedBuilding) {
        player.unselectAll()
      }
      this.mouseRectangle.graph.clear()
      this.mouseRectangle.width = Math.round(this.mouse.x - this.mouseRectangle.x)
      this.mouseRectangle.height =
        this.mouse.y >= app.screen.height
          ? Math.round(app.screen.height - 2 - this.mouseRectangle.y)
          : Math.round(this.mouse.y - this.mouseRectangle.y)
      this.mouseRectangle.graph.lineStyle(1, colorWhite, 1)
      this.mouseRectangle.graph.drawRect(
        Math.min(this.mouseRectangle.x, this.mouseRectangle.x + this.mouseRectangle.width),
        Math.min(this.mouseRectangle.y, this.mouseRectangle.y + this.mouseRectangle.height),
        Math.abs(this.mouseRectangle.width),
        Math.abs(this.mouseRectangle.height)
      )
    }
  }

  onPointerDown(evt) {
    if (isMobile) {
      this.mouse.x = evt.pageX
      this.mouse.y = evt.pageY
    }
    if (!this.isMouseInApp(evt)) {
      return
    }
    this.pointerStart = {
      x: this.mouse.x,
      y: this.mouse.y,
    }
    if (isMobile) {
      this.mouseHoldTimeout = setTimeout(() => {
        this.longClick = true
      }, 200)
    }
  }

  onPointerUp(evt) {
    const {
      context: { menu, map, player },
    } = this
    this.pointerStart = null
    this.mouseLongClick = null
    clearTimeout(this.mouseHoldTimeout)
    if (!this.isMouseInApp(evt) || this.mouse.prevent || this.doubleClicked || this.longClick) {
      this.longClick = false
      this.mouse.prevent = false
      return
    }
    // Select units on mouse rectangle
    if (this.mouseRectangle) {
      let selectVillager
      let countSelect = 0
      player.unselectAll()
      // Select units inside the rectangle
      for (let i = 0; i < player.units.length; i++) {
        const unit = player.units[i]
        if (
          player.selectedUnits.length < maxSelectUnits &&
          pointInRectangle(
            unit.x - this.camera.x,
            unit.y - this.camera.y,
            this.mouseRectangle.x,
            this.mouseRectangle.y,
            this.mouseRectangle.width,
            this.mouseRectangle.height,
            true
          )
        ) {
          unit.select()
          countSelect++
          if (unit.type === 'Villager') {
            selectVillager = unit
          }
          player.selectedUnits.push(unit)
        }
      }
      // Set our bottombar
      if (countSelect) {
        if (selectVillager) {
          player.selectedUnit = selectVillager
          menu.setBottombar(selectVillager)
        } else {
          // TODO SELECT UNITS THAT HAVE THE MOST FREQUENCY
          player.selectedUnit = player.selectedUnits[0]
          menu.setBottombar(player.selectedUnits[0])
        }
      }
      // Reset mouse selection
      if (this.mouseRectangle) {
        this.mouseRectangle.graph.destroy(true)
        this.mouseRectangle = null
      }
      return
    }
    if (this.isMouseInApp(evt)) {
      const pos = isometricToCartesian(this.mouse.x - map.x, this.mouse.y - map.y)
      const i = Math.min(Math.max(pos[0], 0), map.size)
      const j = Math.min(Math.max(pos[1], 0), map.size)
      if (map.grid[i] && map.grid[i][j]) {
        const cell = map.grid[i][j]
        if ((cell.solid || cell.has) && cell.visible) {
          return
        }
        if (this.mouseBuilding) {
          if (cell.inclined || cell.border) {
            return
          }
          if (this.mouseBuilding.isFree) {
            if (player.buyBuilding(i, j, this.mouseBuilding.type)) {
              this.removeMouseBuilding()
              if (menu.selection) {
                menu.setBottombar(menu.selection)
              }
            }
          }
        } else if (player.selectedUnits.length) {
          // Pointer animation
          const pointerSheet = Assets.cache.get('50405')
          const pointer = new AnimatedSprite(pointerSheet.animations['animation'])
          pointer.animationSpeed = 0.2 * accelerator
          pointer.loop = false
          pointer.anchor.set(0.5, 0.5)
          pointer.x = this.mouse.x
          pointer.y = this.mouse.y
          pointer.allowMove = false
          pointer.allowClick = false
          pointer.eventMode = 'auto'
          pointer.roundPixels = true
          pointer.onComplete = () => {
            pointer.destroy()
          }
          pointer.play()
          this.addChild(pointer)
          // Send units
          const minX = Math.min(...player.selectedUnits.map(unit => unit.i))
          const minY = Math.min(...player.selectedUnits.map(unit => unit.j))
          const maxX = Math.max(...player.selectedUnits.map(unit => unit.i))
          const maxY = Math.max(...player.selectedUnits.map(unit => unit.j))
          const centerX = minX + Math.round((maxX - minX) / 2)
          const centerY = minY + Math.round((maxY - minY) / 2)
          let hasSentVillager = false
          let hasSentSoldier = false
          for (let u = 0; u < player.selectedUnits.length; u++) {
            const unit = player.selectedUnits[u]
            const distCenterX = unit.i - centerX
            const distCenterY = unit.j - centerY
            const finalX = cell.i + distCenterX
            const finalY = cell.j + distCenterY
            if (unit.type === 'Villager') {
              hasSentVillager = true
            } else {
              hasSentSoldier = true
            }
            if (map.grid[finalX] && map.grid[finalX][finalY]) {
              player.selectedUnits[u].sendTo(map.grid[finalX][finalY])
            } else {
              player.selectedUnits[u].sendTo(cell)
            }
          }
          if (hasSentSoldier) {
            const voice = randomItem(['5075', '5076', '5128', '5164'])
            sound.play(voice)
          } else if (hasSentVillager) {
            sound.play('5006')
          }
        }
      }
    }
  }

  isMouseInApp(evt) {
    return evt.target && (!evt.target.tagName || (evt.target.tagName || '').toLowerCase() === 'canvas')
  }

  removeMouseBuilding() {
    if (!this.mouseBuilding) {
      return
    }
    this.removeChild(this.mouseBuilding)
    this.mouseBuilding.destroy()
    this.mouseBuilding = null
  }

  setMouseBuilding(building) {
    const {
      context: { player },
    } = this
    this.mouseBuilding = new Container()
    const sprite = Sprite.from(getTexture(building.images.final, Assets))
    sprite.name = 'sprite'
    this.mouseBuilding.addChild(sprite)
    Object.keys(building).forEach(prop => {
      this.mouseBuilding[prop] = building[prop]
    })
    this.mouseBuilding.x = this.mouse.x
    this.mouseBuilding.y = this.mouse.y
    this.mouseBuilding.name = 'mouseBuilding'
    if (building.images.color) {
      const color = Sprite.from(getTexture(building.images.color, Assets))
      color.name = 'color'
      changeSpriteColor(color, player.color)
      this.mouseBuilding.addChild(color)
    } else {
      changeSpriteColor(sprite, player.color)
    }
    this.addChild(this.mouseBuilding)
  }

  moveCamera(dir, moveSpeed, isSpeedDivided) {
    /**
     * 	/A\
     * /   \
     *B     D
     * \   /
     *  \C/
     */

    const {
      context: { map, app, menu },
    } = this

    const dividedSpeed = isSpeedDivided ? 2 : 1
    const speed = (moveSpeed || 20) / dividedSpeed
    const A = { x: cellWidth / 2 - this.camera.x, y: -this.camera.y }
    const B = {
      x: cellWidth / 2 - (map.size * cellWidth) / 2 - this.camera.x,
      y: (map.size * cellHeight) / 2 - this.camera.y,
    }
    const D = {
      x: cellWidth / 2 + (map.size * cellWidth) / 2 - this.camera.x,
      y: (map.size * cellHeight) / 2 - this.camera.y,
    }
    const C = { x: cellWidth / 2 - this.camera.x, y: map.size * cellHeight - this.camera.y }
    const cameraCenter = {
      x: this.camera.x + app.screen.width / 2 - this.camera.x,
      y: this.camera.y + app.screen.height / 2 - this.camera.y,
    }
    this.clearInstancesOnScreen()

    if (dir === 'left') {
      if (cameraCenter.x - 100 > B.x && pointIsBetweenTwoPoint(A, B, cameraCenter, 50)) {
        this.camera.y += speed / (cellWidth / cellHeight)
        this.camera.x -= speed
      } else if (cameraCenter.x - 100 > B.x && pointIsBetweenTwoPoint(B, C, cameraCenter, 50)) {
        this.camera.y -= speed / (cellWidth / cellHeight)
        this.camera.x -= speed
      } else if (cameraCenter.x - 100 > B.x) {
        this.camera.x -= speed
      }
    } else if (dir === 'right') {
      if (cameraCenter.x + 100 < D.x && pointIsBetweenTwoPoint(A, D, cameraCenter, 50)) {
        this.camera.y += speed / (cellWidth / cellHeight)
        this.camera.x += speed
      } else if (cameraCenter.x + 100 < D.x && pointIsBetweenTwoPoint(D, C, cameraCenter, 50)) {
        this.camera.y -= speed / (cellWidth / cellHeight)
        this.camera.x += speed
      } else if (cameraCenter.x + 100 < D.x) {
        this.camera.x += speed
      }
    }
    if (dir === 'up') {
      if (cameraCenter.y - 50 > A.y && pointIsBetweenTwoPoint(A, B, cameraCenter, 50)) {
        this.camera.y -= speed / (cellWidth / cellHeight)
        this.camera.x += speed
      } else if (cameraCenter.y - 50 > A.y && pointIsBetweenTwoPoint(A, D, cameraCenter, 50)) {
        this.camera.y -= speed / (cellWidth / cellHeight)
        this.camera.x -= speed
      } else if (cameraCenter.y - 50 > A.y) {
        this.camera.y -= speed
      }
    } else if (dir === 'down') {
      if (cameraCenter.y + 50 < C.y && pointIsBetweenTwoPoint(D, C, cameraCenter, 50)) {
        this.camera.y += speed / (cellWidth / cellHeight)
        this.camera.x -= speed
      } else if (cameraCenter.y + 50 < C.y && pointIsBetweenTwoPoint(B, C, cameraCenter, 50)) {
        this.camera.y += speed / (cellWidth / cellHeight)
        this.camera.x += speed
      } else if (cameraCenter.y + 100 < C.y) {
        this.camera.y += speed
      }
    }

    menu.updateCameraMiniMap()
    map.setCoordinate(-this.camera.x, -this.camera.y)
    this.displayInstancesOnScreen()
  }

  /*moveCameraWithMouse() {
    const { mouse } = this
    const coef = 1.2
    const moveDist = 10
    if (mouse.x >= 0 && mouse.x <= 0 + moveDist && mouse.y >= 0 && mouse.y <= window.innerHeight) {
      this.moveCamera('left', (0 + moveDist - mouse.x) * coef)
    } else if (
      mouse.x > window.innerWidth - moveDist &&
      mouse.x <= window.innerWidth &&
      mouse.y >= 0 &&
      mouse.y <= window.innerHeight
    ) {
      this.moveCamera('right', (mouse.x - (window.innerWidth - moveDist)) * coef)
    }
    if (mouse.x >= 0 && mouse.x <= window.innerWidth && mouse.y >= 0 && mouse.y <= 0 + moveDist) {
      this.moveCamera('up', (0 + moveDist - mouse.y) * coef)
    } else if (
      mouse.x >= 0 &&
      mouse.x <= window.innerWidth &&
      mouse.y > window.innerHeight - moveDist &&
      mouse.y <= window.innerHeight
    ) {
      this.moveCamera('down', (mouse.y - (window.innerHeight - moveDist)) * coef)
    }
  }*/

  instanceInCamera(instance) {
    const {
      context: { app },
    } = this
    return pointInRectangle(instance.x, instance.y, this.camera.x, this.camera.y, app.screen.width, app.screen.height)
  }

  getCellOnCamera(callback) {
    const {
      context: { map, app },
    } = this
    const cameraFloor = {
      x: Math.floor(this.camera.x),
      y: Math.floor(this.camera.y),
    }
    const margin = cellWidth
    for (let i = cameraFloor.x - margin; i <= cameraFloor.x + app.screen.width + margin; i += cellWidth / 2) {
      for (let j = cameraFloor.y - margin; j <= cameraFloor.y + app.screen.height + margin; j += cellHeight / 2) {
        const coordinate = isometricToCartesian(i, j)
        const x = Math.min(Math.max(coordinate[0], 0), map.size)
        const y = Math.min(Math.max(coordinate[1], 0), map.size)
        if (map.grid[x] && map.grid[x][y]) {
          callback(map.grid[x][y])
        }
      }
    }
  }

  clearInstancesOnScreenEvt() {
    this.getCellOnCamera(cell => {
      cell.visible = false
      if (cell.has) {
        cell.has.visible = false
      }
    })
  }

  displayInstancesOnScreenEvt() {
    this.getCellOnCamera(cell => cell.updateVisible())
  }

  init() {
    const {
      context: { player },
    } = this
    // Set camera to player building else unit
    if (player.buildings.length) {
      this.setCamera(player.buildings[0].x, player.buildings[0].y)
    } else if (player.units.length) {
      this.setCamera(player.units[0].x, player.units[0].y)
    }
  }

  setCamera(x, y) {
    const {
      context: { map, app, menu },
    } = this
    this.camera && this.clearInstancesOnScreen()
    this.camera = {
      x: x - app.screen.width / 2,
      y: y - app.screen.height / 2,
    }
    menu && menu.updateCameraMiniMap()
    map.setCoordinate(-this.camera.x, -this.camera.y)
    this.displayInstancesOnScreen()
  }
}
