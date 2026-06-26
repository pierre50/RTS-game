import { Container, Graphics } from 'pixi.js'
import { COLOR_WHITE, COLOR_GREEN, COLOR_RED, FAMILY_TYPES, LABEL_TYPES } from '../constants'
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

  startInterval(callback, time, immediate = true, name = `${this.family || 'instance'}.interval`) {
    this.stopInterval()
    this.interval = this.context.scheduler.add(callback, time, name)
    if (immediate) callback()
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
    selection.zIndex = -1
    selection.poly([-32 * f, 0, 0, -16 * f, 32 * f, 0, 0, 16 * f])
    selection.stroke(COLOR_WHITE)
    this.addChildAt(selection, 0)
    this.drawHealthBar()
  }

  unselect() {
    if (!this.selected) return
    this.selected = false
    const selection = this.getChildByLabel(LABEL_TYPES.selection)
    if (selection) this.removeChild(selection)
    const healthBar = this.getChildByLabel(LABEL_TYPES.healthBar)
    if (healthBar) this.removeChild(healthBar)
  }

  drawHealthBar() {
    const existing = this.getChildByLabel(LABEL_TYPES.healthBar)
    if (existing) this.removeChild(existing)
    if (!this.totalHitPoints) return
    if (this.family !== FAMILY_TYPES.unit && this.family !== FAMILY_TYPES.building) return
    if (!this.owner?.isPlayed) return
    const barWidth = 26
    const barHeight = 5
    const x = -barWidth / 2
    const spriteTop = this.sprite ? -(this.sprite.height * this.sprite.anchor.y) : -40
    const y = spriteTop - 10
    const ratio = Math.max(0, Math.min(1, this.hitPoints / this.totalHitPoints))
    const bar = new Graphics()
    bar.label = LABEL_TYPES.healthBar
    bar.zIndex = 4
    bar.rect(x, y, barWidth, barHeight)
    bar.fill(COLOR_RED)
    if (ratio > 0) {
      bar.rect(x, y, Math.round(barWidth * ratio), barHeight)
      bar.fill(COLOR_GREEN)
    }
    this.addChild(bar)
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
    setUnitTexture(sheet, this)
  }
}
