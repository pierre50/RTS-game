import { Container } from 'pixi.js'
import type { AnimatedSprite, Sprite } from 'pixi.js'
import {
  COLOR_WHITE,
  FAMILY_TYPES,
  LABEL_TYPES,
} from '../constants'
import {
  createIsoSelectionMarker,
  getActionCondition,
  getSelectionMarkerOffset,
  setUnitTexture,
  uuidv4,
} from '../lib'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { PlayerLike } from '../types/player'
import type { CombatEntity, UnitTextureInstance } from '../lib'
import { drawInstanceEnergyBar, drawInstanceHealthBar, drawInstanceHeroPowerBar, removeInstanceHudBar } from './InstanceHudBars'

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
  energy?: number
  totalEnergy?: number
  sprite?: Sprite | AnimatedSprite
  reliefLift?: number
  action?: string | null
  die?(immediate?: boolean): void
  hasPath?(): boolean
  moveToPath?(): void

  shouldKeepHealthBarVisible(): boolean {
    const showEntityBars = Boolean(this.context?.map?.debugEntityBarsVisible)
    const showForFamily =
      this.family === FAMILY_TYPES.unit ||
      this.family === FAMILY_TYPES.animal
    const heroOwner = this.context?.controls?.heroUnit?.owner
    const showForHeroPlayer =
      this.family === FAMILY_TYPES.unit &&
      this.owner &&
      (this.owner.isPlayed ||
        this.owner.label === this.context?.player?.label ||
        this.owner.label === heroOwner?.label)
    const isHeroUnit = this.context?.controls?.heroUnit?.label === this.label
    return Boolean(
      showForFamily &&
        (showEntityBars || showForHeroPlayer) &&
        !isHeroUnit &&
        !this.isDead &&
        !this.isDestroyed
    )
  }

  shouldKeepEnergyBarVisible(): boolean {
    const showEntityBars = Boolean(this.context?.map?.debugEntityBarsVisible)
    const showForFamily =
      this.family === FAMILY_TYPES.unit ||
      this.family === FAMILY_TYPES.building ||
      this.family === FAMILY_TYPES.animal
    const isHeroUnit = this.context?.controls?.heroUnit?.label === this.label
    return Boolean(showForFamily && showEntityBars && !isHeroUnit && !this.isDead && !this.isDestroyed)
  }

  removeHealthBar(): void {
    removeInstanceHudBar(this, LABEL_TYPES.healthBar)
  }

  removeEnergyBar(): void {
    removeInstanceHudBar(this, LABEL_TYPES.energyBar)
  }

  removeHeroPowerBar(): void {
    removeInstanceHudBar(this, LABEL_TYPES.powerBar)
  }

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

  protected assignProperties(source: object | null | undefined): void {
    if (!source) return
    for (const [key, value] of Object.entries(source)) {
      if (key === 'name') {
        Object.defineProperty(this, key, {
          configurable: true,
          enumerable: true,
          writable: true,
          value,
        })
      } else {
        ;(this as Record<string, unknown>)[key] = value
      }
    }
  }

  syncSelectionMarkersToRelief(): void {
    const markerOffset = getSelectionMarkerOffset(this)
    const y = markerOffset.y + (this.reliefLift ?? 0)
    const selection = this.getChildByLabel(LABEL_TYPES.selection)
    if (selection) {
      selection.position.x = markerOffset.x
      selection.position.y = y
    }
    const commSelection = this.getChildByLabel(LABEL_TYPES.commSelection)
    if (commSelection) {
      commSelection.position.x = markerOffset.x
      commSelection.position.y = y
    }
  }

  startInterval(
    callback: () => void,
    time: number,
    immediate = true,
    name = `${this.family || 'instance'}.interval`
  ): void {
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
    if (typeof (this.sprite as AnimatedSprite | undefined)?.stop === 'function') {
      ;(this.sprite as AnimatedSprite).stop()
    }
  }

  resume(): void {
    if (typeof (this.sprite as AnimatedSprite | undefined)?.play === 'function') {
      ;(this.sprite as AnimatedSprite).play()
    }
  }

  select(): void {
    if (this.selected) return
    this.selected = true
    const f = this.selectionFactor ?? this.size
    const selection = createIsoSelectionMarker({ color: COLOR_WHITE, factor: f, zIndex: -1 })
    const markerOffset = getSelectionMarkerOffset(this)
    selection.position.x = markerOffset.x
    selection.position.y = markerOffset.y + (this.reliefLift ?? 0)
    const shadowIndex = this.getChildByLabel(LABEL_TYPES.shadow) ? 1 : 0
    this.addChildAt(selection, shadowIndex)
    this.drawHealthBar()
    this.drawEnergyBar()
  }

  unselect(): void {
    if (!this.selected) return
    this.selected = false
    const selection = this.getChildByLabel(LABEL_TYPES.selection)
    if (selection) this.removeChild(selection)
    if (this.shouldKeepHealthBarVisible()) {
      this.drawHealthBar()
      this.drawEnergyBar()
    } else {
      this.removeHealthBar()
      this.removeEnergyBar()
    }
  }

  drawHealthBar(): void {
    drawInstanceHealthBar(this)
  }

  drawEnergyBar(): void {
    drawInstanceEnergyBar(this)
  }

  drawHeroPowerBar(ratio: number): void {
    drawInstanceHeroPowerBar(this, ratio)
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
