import { Container, FillGradient, Graphics } from 'pixi.js'
import type { AnimatedSprite, Sprite } from 'pixi.js'
import {
  COLOR_WHITE,
  COLOR_GOLD,
  FAMILY_TYPES,
  LABEL_TYPES,
  ENERGY_BAR_BORDER_COLOR,
  ENERGY_BAR_TRACK_GRADIENT_TOP,
  ENERGY_BAR_TRACK_GRADIENT_BOTTOM,
  ENERGY_BAR_FILL_GRADIENT_TOP,
  ENERGY_BAR_FILL_GRADIENT_BOTTOM,
  HEALTH_BAR_BORDER_COLOR,
  HEALTH_BAR_TRACK_GRADIENT_TOP,
  HEALTH_BAR_TRACK_GRADIENT_BOTTOM,
  HEALTH_BAR_FILL_GRADIENT_TOP,
  HEALTH_BAR_FILL_GRADIENT_BOTTOM,
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

let healthBarTrackGradient: FillGradient | null = null
let healthBarFillGradient: FillGradient | null = null
let energyBarTrackGradient: FillGradient | null = null
let energyBarFillGradient: FillGradient | null = null
const HUD_BAR_FADE_MS = 140
const HUD_BAR_FADE_STEP_MS = 1000 / 60

type HudBarHost = {
  context?: GameContextLike
  addChild: Container['addChild']
  removeChild: Container['removeChild']
}

type HudBarFadeState = {
  bar: Container
  mode: 'in' | 'out'
  taskId: SchedulerTaskId
}

const hudBarFadeStates = new WeakMap<Container, HudBarFadeState>()

function getHealthBarTrackGradient(): FillGradient {
  if (!healthBarTrackGradient) {
    healthBarTrackGradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: HEALTH_BAR_TRACK_GRADIENT_TOP },
        { offset: 1, color: HEALTH_BAR_TRACK_GRADIENT_BOTTOM },
      ],
    })
  }
  return healthBarTrackGradient
}

function getHealthBarFillGradient(): FillGradient {
  if (!healthBarFillGradient) {
    healthBarFillGradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: HEALTH_BAR_FILL_GRADIENT_TOP },
        { offset: 1, color: HEALTH_BAR_FILL_GRADIENT_BOTTOM },
      ],
    })
  }
  return healthBarFillGradient
}

function getEnergyBarTrackGradient(): FillGradient {
  if (!energyBarTrackGradient) {
    energyBarTrackGradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: ENERGY_BAR_TRACK_GRADIENT_TOP },
        { offset: 1, color: ENERGY_BAR_TRACK_GRADIENT_BOTTOM },
      ],
    })
  }
  return energyBarTrackGradient
}

function getEnergyBarFillGradient(): FillGradient {
  if (!energyBarFillGradient) {
    energyBarFillGradient = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: ENERGY_BAR_FILL_GRADIENT_TOP },
        { offset: 1, color: ENERGY_BAR_FILL_GRADIENT_BOTTOM },
      ],
    })
  }
  return energyBarFillGradient
}

function isChildOf(host: HudBarHost, child: Container): boolean {
  return child.parent === host || Boolean((host as { children?: Container[] }).children?.includes(child))
}

function stopHudBarFade(host: HudBarHost, bar: Container): void {
  const state = hudBarFadeStates.get(bar)
  if (state) host.context?.scheduler?.remove(state.taskId)
  hudBarFadeStates.delete(bar)
}

function removeHudBarNow(host: HudBarHost, bar: Container, stopFade = true): void {
  if (stopFade) stopHudBarFade(host, bar)
  if (isChildOf(host, bar)) host.removeChild(bar)
}

function fadeInHudBar(host: HudBarHost, bar: Container, fromAlpha = 0): void {
  const scheduler = host.context?.scheduler
  const startAlpha = Math.max(0, Math.min(1, fromAlpha))
  bar.alpha = startAlpha
  if (!scheduler || startAlpha >= 1) {
    bar.alpha = 1
    return
  }
  const steps = Math.max(1, Math.round(HUD_BAR_FADE_MS / HUD_BAR_FADE_STEP_MS))
  let step = Math.round(startAlpha * steps)
  const state: HudBarFadeState = { bar, mode: 'in', taskId: -1 as SchedulerTaskId }
  let taskId: SchedulerTaskId | null = null
  taskId = scheduler.add(
    () => {
      const activeBar = state.bar
      if ((activeBar as { destroyed?: boolean }).destroyed || !isChildOf(host, activeBar)) {
        if (taskId != null) scheduler.remove(taskId)
        hudBarFadeStates.delete(activeBar)
        return
      }
      step += 1
      activeBar.alpha = Math.min(1, step / steps)
      if (step >= steps) {
        if (taskId != null) scheduler.remove(taskId)
        hudBarFadeStates.delete(activeBar)
      }
    },
    HUD_BAR_FADE_STEP_MS,
    'hud.barFadeIn'
  )
  state.taskId = taskId
  hudBarFadeStates.set(bar, state)
}

function fadeOutHudBar(host: HudBarHost, bar: Container): void {
  const scheduler = host.context?.scheduler
  if (!scheduler) {
    removeHudBarNow(host, bar)
    return
  }
  stopHudBarFade(host, bar)
  const startAlpha = Math.max(0, Math.min(1, bar.alpha ?? 1))
  if (startAlpha <= 0) {
    removeHudBarNow(host, bar)
    return
  }
  const steps = Math.max(1, Math.round(HUD_BAR_FADE_MS / HUD_BAR_FADE_STEP_MS))
  let step = 0
  const state: HudBarFadeState = { bar, mode: 'out', taskId: -1 as SchedulerTaskId }
  let taskId: SchedulerTaskId | null = null
  taskId = scheduler.add(
    () => {
      const activeBar = state.bar
      if ((activeBar as { destroyed?: boolean }).destroyed || !isChildOf(host, activeBar)) {
        if (taskId != null) scheduler.remove(taskId)
        hudBarFadeStates.delete(activeBar)
        return
      }
      step += 1
      activeBar.alpha = startAlpha * Math.max(0, 1 - step / steps)
      if (step >= steps) {
        removeHudBarNow(host, activeBar)
      }
    },
    HUD_BAR_FADE_STEP_MS,
    'hud.barFadeOut'
  )
  state.taskId = taskId
  hudBarFadeStates.set(bar, state)
}

function replaceHudBar(host: HudBarHost, bar: Container, previous: Container | null): void {
  const previousFadeState = previous ? hudBarFadeStates.get(previous) : null
  if (previous && previousFadeState?.mode === 'in') {
    bar.alpha = previous.alpha ?? 0
    hudBarFadeStates.delete(previous)
    removeHudBarNow(host, previous, false)
    host.addChild(bar)
    previousFadeState.bar = bar
    hudBarFadeStates.set(bar, previousFadeState)
    return
  }
  const fadeFromAlpha = previous ? (previous.alpha ?? 1) : 0
  if (previous) removeHudBarNow(host, previous)
  host.addChild(bar)
  fadeInHudBar(host, bar, fadeFromAlpha)
}

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
      this.family === FAMILY_TYPES.building ||
      this.family === FAMILY_TYPES.animal
    const heroOwner = this.context?.controls?.heroUnit?.owner
    const showForHeroPlayer =
      (this.family === FAMILY_TYPES.unit || this.family === FAMILY_TYPES.building) &&
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
    const healthBar = this.getChildByLabel(LABEL_TYPES.healthBar)
    if (healthBar) fadeOutHudBar(this, healthBar)
  }

  removeEnergyBar(): void {
    const energyBar = this.getChildByLabel(LABEL_TYPES.energyBar)
    if (energyBar) fadeOutHudBar(this, energyBar)
  }

  removeHeroPowerBar(): void {
    const powerBar = this.getChildByLabel(LABEL_TYPES.powerBar)
    if (powerBar) fadeOutHudBar(this, powerBar)
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
    const existing = this.getChildByLabel(LABEL_TYPES.healthBar)
    if (!this.totalHitPoints) {
      if (existing) fadeOutHudBar(this, existing)
      return
    }
    if (
      this.family !== FAMILY_TYPES.unit &&
      this.family !== FAMILY_TYPES.building &&
      this.family !== FAMILY_TYPES.animal
    ) {
      if (existing) fadeOutHudBar(this, existing)
      return
    }
    if (!this.shouldKeepHealthBarVisible() && !this.selected) {
      if (existing) fadeOutHudBar(this, existing)
      return
    }
    const barWidth = 22
    const barHeight = 6
    const borderWidth = 1
    const x = -barWidth / 2
    const spriteTop = this.sprite ? -(this.sprite.height * this.sprite.anchor.y) : -40
    const y = spriteTop - 10
    const innerX = x + borderWidth
    const innerY = y + borderWidth
    const innerWidth = barWidth - borderWidth * 2
    const innerHeight = barHeight - borderWidth * 2
    const ratio = Math.max(0, Math.min(1, this.hitPoints / this.totalHitPoints))
    const bar = new Graphics()
    bar.label = LABEL_TYPES.healthBar
    bar.zIndex = 4
    bar.rect(x, y, barWidth, barHeight)
    bar.fill(HEALTH_BAR_BORDER_COLOR)
    bar.rect(innerX, innerY, innerWidth, innerHeight)
    bar.fill(getHealthBarTrackGradient())
    if (ratio > 0) {
      bar.rect(innerX, innerY, Math.round(innerWidth * ratio), innerHeight)
      bar.fill(getHealthBarFillGradient())
    }
    // Tracks relief the same way the shadow does — see Unit.applyReliefLift.
    bar.position.y = this.reliefLift ?? 0
    replaceHudBar(this, bar, existing)
  }

  drawEnergyBar(): void {
    const existing = this.getChildByLabel(LABEL_TYPES.energyBar)
    const totalEnergy = this.totalEnergy ?? 0
    if (!totalEnergy) {
      if (existing) fadeOutHudBar(this, existing)
      return
    }
    if (!this.shouldKeepEnergyBarVisible()) {
      if (existing) fadeOutHudBar(this, existing)
      return
    }
    const barWidth = 22
    const barHeight = 5
    const borderWidth = 1
    const x = -barWidth / 2
    const spriteTop = this.sprite ? -(this.sprite.height * this.sprite.anchor.y) : -40
    const y = spriteTop - 18
    const innerX = x + borderWidth
    const innerY = y + borderWidth
    const innerWidth = barWidth - borderWidth * 2
    const innerHeight = barHeight - borderWidth * 2
    const ratio = Math.max(0, Math.min(1, (this.energy ?? totalEnergy) / totalEnergy))
    const bar = new Graphics()
    bar.label = LABEL_TYPES.energyBar
    bar.zIndex = 6
    bar.rect(x, y, barWidth, barHeight)
    bar.fill(ENERGY_BAR_BORDER_COLOR)
    bar.rect(innerX, innerY, innerWidth, innerHeight)
    bar.fill(getEnergyBarTrackGradient())
    if (ratio > 0) {
      bar.rect(innerX, innerY, Math.round(innerWidth * ratio), innerHeight)
      bar.fill(getEnergyBarFillGradient())
    }
    bar.position.y = this.reliefLift ?? 0
    replaceHudBar(this, bar, existing)
  }

  drawHeroPowerBar(ratio: number): void {
    const existing = this.getChildByLabel(LABEL_TYPES.powerBar)
    if (this.isDead || this.isDestroyed || !this.owner?.isPlayed) {
      if (existing) fadeOutHudBar(this, existing)
      return
    }
    const clampedRatio = Math.max(0, Math.min(1, ratio))
    const barWidth = 26
    const barHeight = 5
    const borderWidth = 1
    const x = -barWidth / 2
    const spriteTop = this.sprite ? -(this.sprite.height * this.sprite.anchor.y) : -40
    const y = spriteTop - 18
    const innerX = x + borderWidth
    const innerY = y + borderWidth
    const innerWidth = barWidth - borderWidth * 2
    const innerHeight = barHeight - borderWidth * 2
    const bar = new Graphics()
    bar.label = LABEL_TYPES.powerBar
    bar.zIndex = 5
    bar.rect(x, y, barWidth, barHeight)
    bar.fill(HEALTH_BAR_BORDER_COLOR)
    bar.rect(innerX, innerY, innerWidth, innerHeight)
    bar.fill(0x312319)
    if (clampedRatio > 0) {
      bar.rect(innerX, innerY, Math.round(innerWidth * clampedRatio), innerHeight)
      bar.fill(clampedRatio >= 1 ? COLOR_GOLD : 0xf28722)
    }
    bar.position.y = this.reliefLift ?? 0
    replaceHudBar(this, bar, existing)
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
