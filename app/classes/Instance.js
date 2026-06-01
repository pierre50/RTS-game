import { Container, Graphics } from 'pixi.js'
import { ACCELERATOR, COLOR_WHITE, LABEL_TYPES } from '../constants'
import { getActionCondition, setUnitTexture, uuidv4 } from '../lib'

export class Instance extends Container {
  constructor(context) {
    super()
    this.context = context
    this.label = uuidv4()
    this.selected = false
    this.isDead = false
    this.isDestroyed = false
    this.interval = null
    this.timeoutId = null
  }

  startInterval(callback, time, immediate = true) {
    this.stopInterval()
    if (immediate) callback()
    this.interval = this.context.scheduler.add(callback, time)
  }

  stopInterval() {
    if (this.interval) {
      this.context.scheduler.remove(this.interval)
      this.interval = null
    }
  }

  stopTimeout() {
    if (this.timeoutId != null) {
      this.context.scheduler.remove(this.timeoutId)
      this.timeoutId = null
    }
  }

  pause() {
    this.sprite?.stop()
  }

  resume() {
    this.sprite?.play()
  }

  select() {
    if (this.selected) return
    this.selected = true
    const f = this.selectionFactor ?? this.size
    const selection = new Graphics()
    selection.label = LABEL_TYPES.selection
    selection.zIndex = 3
    selection.poly([-32 * f, 0, 0, -16 * f, 32 * f, 0, 0, 16 * f])
    selection.stroke(COLOR_WHITE)
    this.addChildAt(selection, 0)
  }

  unselect() {
    if (!this.selected) return
    this.selected = false
    const selection = this.getChildByLabel(LABEL_TYPES.selection)
    if (selection) this.removeChild(selection)
  }

  step() {
    if (this.hitPoints <= 0) {
      this.die()
    } else if (this.hasPath()) {
      this.moveToPath()
    }
  }

  getActionCondition(target, action = this.action) {
    return getActionCondition(this, target, action)
  }

  setTextures(sheet) {
    setUnitTexture(sheet, this, ACCELERATOR)
  }
}
