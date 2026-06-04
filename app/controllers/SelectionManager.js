import { Assets, AnimatedSprite, Graphics } from 'pixi.js'
import { sound } from '@pixi/sound'
import { bindAnimatedSpriteToTicker, pointsDistance, pointInRectangle, randomItem, getAnimationFrames } from '../lib'
import { COLOR_WHITE, MAX_SELECT_UNITS, UNIT_TYPES } from '../constants'

export class SelectionManager {
  constructor(controls) {
    this.controls = controls
  }

  handleMouseMove() {
    const { controls } = this
    const {
      context: { player, app },
    } = controls

    if (
      !controls.mouseRectangle &&
      controls.pointerStart &&
      pointsDistance(controls.mouse.x, controls.mouse.y, controls.pointerStart.x, controls.pointerStart.y) > 5
    ) {
      controls.mouseRectangle = {
        x: controls.pointerStart.x,
        y: controls.pointerStart.y,
        width: 0,
        height: 0,
        graph: new Graphics(),
      }
      app.stage.addChild(controls.mouseRectangle.graph)
    }

    if (controls.mouseRectangle) {
      if (player.selectedUnits.length || player.selectedBuilding) {
        player.unselectAll()
      }
      const graph = controls.mouseRectangle.graph
      graph.clear()

      controls.mouseRectangle.width = controls.mouse.x - controls.mouseRectangle.x
      controls.mouseRectangle.height = controls.mouse.y - controls.mouseRectangle.y

      const x = Math.min(controls.mouseRectangle.x, controls.mouseRectangle.x + controls.mouseRectangle.width)
      const y = Math.min(controls.mouseRectangle.y, controls.mouseRectangle.y + controls.mouseRectangle.height)
      const w = Math.abs(controls.mouseRectangle.width)
      const h = Math.abs(controls.mouseRectangle.height)

      graph.rect(x, y, w, h).stroke(COLOR_WHITE)
    }
  }

  handleMouseUp() {
    const { controls } = this
    const {
      context: { menu, player },
    } = controls

    let selectVillager
    let countSelect = 0
    player.unselectAll()
    const rectangle = controls.mouseRectangle
    for (let i = 0; i < player.units.length; i++) {
      const unit = player.units[i]
      if (player.selectedUnits.length < MAX_SELECT_UNITS && this.isUnitInsideSelection(unit, rectangle)) {
        unit.select()
        countSelect++
        if (unit.type === UNIT_TYPES.villager) selectVillager = unit
        player.selectedUnits.push(unit)
      }
    }
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
    if (controls.mouseRectangle) {
      controls.mouseRectangle.graph.destroy(true)
      controls.mouseRectangle = null
    }
  }

  handleClick(cell) {
    const { controls } = this
    const pointerSheet = Assets.cache.get('50405')
    const pointer = new AnimatedSprite(getAnimationFrames(pointerSheet.textures))
    bindAnimatedSpriteToTicker(pointer, controls.context.app)
    pointer.animationSpeed = 0.2
    pointer.loop = false
    pointer.anchor.set(0.5, 0.5)
    pointer.x = controls.mouse.x
    pointer.y = controls.mouse.y
    pointer.allowMove = false
    pointer.allowClick = false
    pointer.eventMode = 'auto'
    pointer.roundPixels = true
    pointer.onComplete = () => {
      pointer.destroy()
    }
    pointer.play()
    controls.addChild(pointer)
    this.sendUnits(cell)
  }

  sendUnits(cell) {
    const { controls } = this
    const {
      context: { player, map },
    } = controls
    const { minX, minY, maxX, maxY } = this.getSelectionGridBounds(player.selectedUnits)
    const centerX = minX + Math.round((maxX - minX) / 2)
    const centerY = minY + Math.round((maxY - minY) / 2)
    let hasSentVillager = false
    let hasSentSoldier = false
    for (let u = 0; u < player.selectedUnits.length; u++) {
      const unit = player.selectedUnits[u]
      const finalX = cell.i + (unit.i - centerX)
      const finalY = cell.j + (unit.j - centerY)
      if (unit.type === UNIT_TYPES.villager) hasSentVillager = true
      else hasSentSoldier = true
      if (map.grid[finalX] && map.grid[finalX][finalY]) {
        player.selectedUnits[u].sendTo(map.grid[finalX][finalY])
      } else {
        player.selectedUnits[u].sendTo(cell)
      }
    }
    if (hasSentSoldier) {
      sound.play(randomItem(['5075', '5076', '5128', '5164']))
    } else if (hasSentVillager) {
      sound.play('5006')
    }
  }

  isUnitInsideSelection(unit, rectangle) {
    return pointInRectangle(
      unit.x - this.controls.camera.x,
      unit.y - this.controls.camera.y,
      rectangle.x,
      rectangle.y,
      rectangle.width,
      rectangle.height,
      true
    )
  }

  getSelectionGridBounds(units) {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (let i = 0; i < units.length; i++) {
      const unit = units[i]
      if (unit.i < minX) minX = unit.i
      if (unit.j < minY) minY = unit.j
      if (unit.i > maxX) maxX = unit.i
      if (unit.j > maxY) maxY = unit.j
    }

    return { minX, minY, maxX, maxY }
  }
}
