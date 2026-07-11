import { Container, Graphics } from 'pixi.js'
import type { AnimatedSprite, Sprite } from 'pixi.js'
import { COLOR_WHITE, COLOR_GREEN, COLOR_RED, FAMILY_TYPES, LABEL_TYPES } from '../constants'
import { getActionCondition, setUnitTexture, uuidv4 } from '../lib'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { PlayerLike } from '../types/player'
import type { CombatEntity, UnitTextureInstance } from '../lib'

export class Instance extends Container {
  context: GameContextLike
  selected: boolean
  isDead: boolean
  isDestroyed: boolean
  interval: SchedulerTaskId | null
  timeoutId: SchedulerTaskId | null
  family!: string
  type!: string
  i!: number
  j!: number
  z!: number | null
  size!: number
  degree!: number
  selectionFactor?: number
  owner!: PlayerLike
  hitPoints!: number
  totalHitPoints!: number
  sprite?: Sprite | AnimatedSprite
  action?: string | null
  die?(immediate?: boolean): void
  hasPath?(): boolean
  moveToPath?(): void

  constructor(context: GameContextLike) {
    super()
    this.context = context
    this.label = uuidv4()
    this.selected = false
    this.isDead = false
    this.isDestroyed = false
    this.interval = null
    this.timeoutId = null
  }

  startInterval(callback: () => void, time: number, immediate = true, name = `${this.family || 'instance'}.interval`): void {
    this.stopInterval()
    this.interval = this.context.scheduler.add(callback, time, name)
    if (immediate) callback()
  }

  stopInterval(): void {
    if (this.interval) {
      this.context.scheduler.remove(this.interval)
      this.interval = null
    }
  }

  stopTimeout(): void {
    if (this.timeoutId != null) {
      this.context.scheduler.remove(this.timeoutId)
      this.timeoutId = null
    }
  }

  pause(): void {
    ;(this.sprite as AnimatedSprite | undefined)?.stop()
  }

  resume(): void {
    ;(this.sprite as AnimatedSprite | undefined)?.play()
  }

  select(): void {
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

  unselect(): void {
    if (!this.selected) return
    this.selected = false
    const selection = this.getChildByLabel(LABEL_TYPES.selection)
    if (selection) this.removeChild(selection)
    const healthBar = this.getChildByLabel(LABEL_TYPES.healthBar)
    if (healthBar) this.removeChild(healthBar)
  }

  drawHealthBar(): void {
    const existing = this.getChildByLabel(LABEL_TYPES.healthBar)
    if (existing) this.removeChild(existing)
    if (!this.totalHitPoints) return
    if (this.family !== FAMILY_TYPES.unit && this.family !== FAMILY_TYPES.building) return
    if (!this.owner?.isPlayed) return
    const barWidth = 20
    const barHeight = 2
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

  step(): void {
    if (this.hitPoints <= 0) {
      this.die?.()
    } else if (this.hasPath?.()) {
      this.moveToPath?.()
    }
  }

  getActionCondition(target: object | null | undefined, action = this.action ?? undefined): boolean {
    return getActionCondition(this, target as CombatEntity, action)
  }

  setTextures(sheet: string): void {
    setUnitTexture(sheet, this as UnitTextureInstance)
  }
}
