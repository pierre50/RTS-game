import { AnimatedSprite, Assets } from 'pixi.js'
import { BUILDING_TYPES, COLOR_FLASHY_GREEN, COLOR_RED } from '../constants'
import { bindAnimatedSpriteToTicker, drawInstanceBlinkingSelection, getRallyPointFrames } from '../lib'

export class RallyPointController {
  constructor(controls) {
    this.controls = controls
    this.building = null
    this.preview = null
    this.direction = 0
  }

  get active() {
    return Boolean(this.building)
  }

  start(building) {
    this.cancel()
    this.building = building
    this.direction = this.controls.context.map.randomRange(0, 1)
    this.preview = this.createFlag()
    this.preview.visible = false
    this.controls.addChild(this.preview)
    this.handleMouseMove()
  }

  createFlag() {
    const sheet = Assets.cache.get('459')
    const flag = new AnimatedSprite(getRallyPointFrames(sheet.textures, this.direction))
    bindAnimatedSpriteToTicker(flag, this.controls.context.app)
    flag.animationSpeed = sheet.data.animationSpeed ?? 0.2
    flag.anchor.set(flag.texture.defaultAnchor.x, flag.texture.defaultAnchor.y)
    flag.allowMove = false
    flag.allowClick = false
    flag.eventMode = 'none'
    flag.roundPixels = true
    flag.play()
    return flag
  }

  canPlace(cell) {
    if (!cell || !cell.visible) return false
    if (cell.has && !cell.has.isDestroyed && cell.has !== this.building) return true
    if (cell.solid || cell.inclined || cell.border) return false
    if (this.building?.type === BUILDING_TYPES.dock) {
      return cell.category === 'Water' && !cell.waterBorder
    }
    return cell.category !== 'Water' && !cell.waterBorder
  }

  handleMouseMove() {
    if (!this.active || !this.preview) return
    const cell = this.controls.buildingPlacer.getPointerCell()
    if (!cell) return

    this.preview.visible = true
    this.preview.x = cell.x - this.controls.camera.x
    this.preview.y = cell.y - this.controls.camera.y
    this.preview.tint = this.canPlace(cell) ? COLOR_FLASHY_GREEN : COLOR_RED
  }

  handleMouseUp(cell) {
    if (!this.active || !this.canPlace(cell)) return false
    this.building.setRallyPoint(cell, this.direction)
    const entity = cell.has
    if (entity && !entity.isDestroyed) {
      drawInstanceBlinkingSelection(entity)
    }
    this.cancel()
    return true
  }

  handleMouseUpOnEntity(entity) {
    if (!this.active || !entity || entity.isDestroyed) return false
    const {
      context: { map },
    } = this.controls
    const cell = map.grid[entity.i]?.[entity.j]
    if (!cell || !cell.visible) return false
    this.building.setRallyPoint(cell, this.direction)
    drawInstanceBlinkingSelection(entity)
    this.cancel()
    return true
  }

  cancel({ clear = false } = {}) {
    if (clear) this.building?.clearRallyPoint()
    this.preview?.destroy()
    this.preview = null
    this.building = null
    this.direction = 0
  }
}
