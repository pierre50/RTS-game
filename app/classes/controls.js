import { Container, Graphics, AnimatedSprite, Assets, Sprite } from 'pixi.js'
import {
  isometricToCartesian,
  pointIsBetweenTwoPoint,
  pointsDistance,
  pointInRectangle,
  getCellsAroundPoint,
  getPlainCellsAroundPoint,
  changeSpriteColor,
  getTexture,
} from '../lib'
import { colorWhite, colorRed, cellWidth, cellHeight, maxSelectUnits } from '../constants'

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

    this.camera
    this.setCamera(Math.floor(map.size / 2), Math.floor(map.size / 2))

    this.keysPressed = {}
    this.interactive = false

    document.addEventListener('keydown', evt => this.onKeyDown(evt))
    document.addEventListener('keyup', evt => this.onKeyUp(evt))
    document.addEventListener('pointermove', evt => this.onPointerMove(evt))
    document.addEventListener('pointerdown', evt => this.onPointerDown(evt))
    document.addEventListener('pointerup', evt => this.onPointerUp(evt))
  }

  onKeyDown(evt) {
    if (evt.key === 'Delete') {
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
    if (!this.mouseRectangle) {
      //this.moveCameraWithMouse()
    }

    //Mouse building to place construction
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
        getPlainCellsAroundPoint(i, j, map.grid, 1, cell => {
          if (cell.solid || cell.inclined || cell.border || !cell.visible) {
            isFree = false
            return
          }
        })
        //Color image of mouse building depend on buildable or not
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

    //Create and draw mouse selection
    if (
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
        this.mouseRectangle.x,
        this.mouseRectangle.y,
        this.mouseRectangle.width,
        this.mouseRectangle.height
      )
    }
  }

  onPointerDown() {
    if (!this.isMouseInApp()) {
      return
    }
    this.pointerStart = {
      x: this.mouse.x,
      y: this.mouse.y,
    }
  }

  onPointerUp() {
    const {
      context: { menu, map, player },
    } = this
    this.pointerStart = null
    if (!this.isMouseInApp() || this.mouse.prevent) {
      this.mouse.prevent = false
      return
    }
    //Select units on mouse rectangle
    if (this.mouseRectangle) {
      let selectVillager
      let countSelect = 0
      player.unselectAll()
      //Select units inside the rectangle
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
      //Set our bottombar
      if (countSelect) {
        if (selectVillager) {
          player.selectedUnit = selectVillager
          menu.setBottombar(selectVillager)
        } else {
          //TODO SELECT UNITS THAT HAVE THE MOST FREQUENCY
          player.selectedUnit = player.selectedUnits[0]
          menu.setBottombar(player.selectedUnits[0])
        }
      }
      //Reset mouse selection
      if (this.mouseRectangle) {
        this.mouseRectangle.graph.destroy(true)
        this.mouseRectangle = null
      }
      return
    }
    if (this.isMouseInApp()) {
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
          //Pointer animation
          const pointerSheet = Assets.cache.get('50405')
          const pointer = new AnimatedSprite(pointerSheet.animations['animation'])
          pointer.animationSpeed = 0.2
          pointer.loop = false
          pointer.anchor.set(0.5, 0.5)
          pointer.x = this.mouse.x
          pointer.y = this.mouse.y
          pointer.onComplete = () => {
            pointer.destroy()
          }
          pointer.play()
          this.addChild(pointer)
          //Send units
          const minX = Math.min(...player.selectedUnits.map(unit => unit.i))
          const minY = Math.min(...player.selectedUnits.map(unit => unit.j))
          const maxX = Math.max(...player.selectedUnits.map(unit => unit.i))
          const maxY = Math.max(...player.selectedUnits.map(unit => unit.j))
          const centerX = minX + Math.round((maxX - minX) / 2)
          const centerY = minY + Math.round((maxY - minY) / 2)
          for (let u = 0; u < player.selectedUnits.length; u++) {
            const unit = player.selectedUnits[u]
            const distCenterX = unit.i - centerX
            const distCenterY = unit.j - centerY
            const finalX = cell.i + 1 + distCenterX
            const finalY = cell.j + 1 + distCenterY
            if (map.grid[finalX] && map.grid[finalX][finalY]) {
              player.selectedUnits[u].sendTo(map.grid[finalX][finalY])
            } else {
              player.selectedUnits[u].sendTo(cell)
            }
          }
        }
      }
    }
  }

  isMouseInApp() {
    const {
      context: { app, menu },
    } = this
    return this.mouse.y > menu.topbar.clientHeight && this.mouse.y < app.screen.height - menu.bottombar.clientHeight
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
    if (building.images.color) {
      const color = Sprite.from(getTexture(building.images.color, Assets))
      color.name = 'color'
      changeSpriteColor(color, player.color)
      this.mouseBuilding.addChild(color)
    } else {
      changeSpriteColor(sprite, player.color)
    }
    this.mouseBuilding.addChild(sprite)
    this.mouseBuilding.type = building.type
    this.mouseBuilding.size = building.size
    this.mouseBuilding.x = this.mouse.x
    this.mouseBuilding.y = this.mouse.y
    this.mouseBuilding.name = 'mouseBuilding'
    this.addChild(this.mouseBuilding)
  }

  moveCamera(dir, moveSpeed, isSpeedDiveded) {
    /**
     * 	/A\
     * /   \
     *B     D
     * \   /
     *  \C/
     */

    const {
      context: { map, app },
    } = this

    const dividedSpeed = isSpeedDiveded ? 2 : 1
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

    map.setCoordinate(-this.camera.x, -this.camera.y)

    this.displayInstancesOnScreen(true)
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

  clearInstancesOnScreen() {
    const {
      context: { map, app },
    } = this

    map.setCoordinate(-this.camera.x, -this.camera.y)
    const cameraCenter = {
      x: this.camera.x + app.screen.width / 2,
      y: this.camera.y + app.screen.height / 2,
    }
    const coordinate = isometricToCartesian(cameraCenter.x, cameraCenter.y)
    const dist = Math.round(window.innerWidth / cellWidth) + 2
    getCellsAroundPoint(coordinate[0], coordinate[1], map.grid, dist, cell => {
      cell.visible = false
      if (cell.has) {
        cell.has.visible = false
      }
    })
  }

  instanceInCamera(instance) {
    const {
      context: { app },
    } = this
    return pointInRectangle(instance.x, instance.y, this.camera.x, this.camera.y, app.screen.width, app.screen.height)
  }

  displayInstancesOnScreen(light = false) {
    const {
      context: { map, app },
    } = this

    const cameraCenter = {
      x: this.camera.x + app.screen.width / 2,
      y: this.camera.y + app.screen.height / 2,
    }
    const coordinate = isometricToCartesian(cameraCenter.x, cameraCenter.y)
    const dist = Math.round(app.screen.width / cellWidth) + 1
    light
      ? getCellsAroundPoint(coordinate[0], coordinate[1], map.grid, dist, cell => cell.updateVisible())
      : getPlainCellsAroundPoint(coordinate[0], coordinate[1], map.grid, dist, cell => cell.updateVisible())
  }

  init() {
    const {
      context: { player },
    } = this
    //Set camera to player building else unit
    if (player.buildings.length) {
      this.setCamera(player.buildings[0].x, player.buildings[0].y)
    } else if (player.units.length) {
      this.setCamera(player.units[0].x, player.units[0].y)
    }
  }

  setCamera(x, y) {
    const {
      context: { map, app },
    } = this
    this.camera = {
      x: x - app.screen.width / 2,
      y: y - app.screen.height / 2,
    }
    map.setCoordinate(-this.camera.x, -this.camera.y)
    this.displayInstancesOnScreen()
  }
}
