import { FillGradient, Graphics } from 'pixi.js'
import type { Container } from 'pixi.js'
import {
  COLOR_GOLD,
  ENERGY_BAR_BORDER_COLOR,
  ENERGY_BAR_FILL_GRADIENT_BOTTOM,
  ENERGY_BAR_FILL_GRADIENT_TOP,
  ENERGY_BAR_TRACK_GRADIENT_BOTTOM,
  ENERGY_BAR_TRACK_GRADIENT_TOP,
  HEALTH_BAR_BORDER_COLOR,
  HEALTH_BAR_FILL_GRADIENT_BOTTOM,
  HEALTH_BAR_FILL_GRADIENT_TOP,
  HEALTH_BAR_TRACK_GRADIENT_BOTTOM,
  HEALTH_BAR_TRACK_GRADIENT_TOP,
  FAMILY_TYPES,
  LABEL_TYPES,
} from '../constants'
import { getEntityHudTopY } from '../lib/entities/entityHudPosition'
import type { SchedulerTaskId } from '../types/context'

let healthBarTrackGradient: FillGradient | null = null
let healthBarFillGradient: FillGradient | null = null
let energyBarTrackGradient: FillGradient | null = null
let energyBarFillGradient: FillGradient | null = null

const HUD_BAR_FADE_MS = 140
const HUD_BAR_FADE_STEP_MS = 1000 / 60

type HudBarHost = {
  context?: { scheduler?: { add(callback: () => void, time: number, name?: string): SchedulerTaskId; remove(id: SchedulerTaskId): void } }
  addChild: Container['addChild']
  removeChild: Container['removeChild']
}

export type InstanceHudHost = HudBarHost & {
  alpha?: number
  energy?: number
  family: string
  hitPoints: number
  isDead: boolean
  isDestroyed: boolean
  owner?: { isPlayed?: boolean } | null
  reliefLift?: number
  selected: boolean
  sprite?: { height: number; anchor: { y: number }; scale?: { y: number } }
  spriteScale?: number
  totalEnergy?: number
  totalHitPoints: number
  type?: string
  getChildByLabel(label: string): Container | null
  shouldKeepEnergyBarVisible(): boolean
  shouldKeepHealthBarVisible(): boolean
}

type HudBarFadeState = {
  bar: Container
  mode: 'in' | 'out'
  taskId: SchedulerTaskId
}

const hudBarFadeStates = new WeakMap<Container, HudBarFadeState>()

export function drawInstanceHealthBar(host: InstanceHudHost): void {
  const existing = host.getChildByLabel(LABEL_TYPES.healthBar)
  if (!host.totalHitPoints) {
    if (existing) fadeOutHudBar(host, existing)
    return
  }
  if (!supportsEntityHudBars(host.family)) {
    if (existing) fadeOutHudBar(host, existing)
    return
  }
  if (!host.shouldKeepHealthBarVisible() && !host.selected) {
    if (existing) fadeOutHudBar(host, existing)
    return
  }

  const { bar, innerX, innerY, innerWidth, innerHeight } = createHudBar(host, {
    borderColor: HEALTH_BAR_BORDER_COLOR,
    label: LABEL_TYPES.healthBar,
    height: 6,
    yOffset: 10,
    zIndex: 4,
  })
  const ratio = Math.max(0, Math.min(1, host.hitPoints / host.totalHitPoints))
  bar.fill(getHealthBarTrackGradient())
  if (ratio > 0) {
    bar.rect(innerX, innerY, Math.round(innerWidth * ratio), innerHeight)
    bar.fill(getHealthBarFillGradient())
  }
  replaceHudBar(host, bar, existing)
}

function supportsEntityHudBars(family: string): boolean {
  return family === FAMILY_TYPES.unit || family === FAMILY_TYPES.building || family === FAMILY_TYPES.animal
}

export function drawInstanceEnergyBar(host: InstanceHudHost): void {
  const existing = host.getChildByLabel(LABEL_TYPES.energyBar)
  const totalEnergy = host.totalEnergy ?? 0
  if (!totalEnergy || !host.shouldKeepEnergyBarVisible()) {
    if (existing) fadeOutHudBar(host, existing)
    return
  }

  const { bar, innerX, innerY, innerWidth, innerHeight } = createHudBar(host, {
    borderColor: ENERGY_BAR_BORDER_COLOR,
    label: LABEL_TYPES.energyBar,
    height: 5,
    yOffset: 18,
    zIndex: 6,
  })
  const ratio = Math.max(0, Math.min(1, (host.energy ?? totalEnergy) / totalEnergy))
  bar.fill(getEnergyBarTrackGradient())
  if (ratio > 0) {
    bar.rect(innerX, innerY, Math.round(innerWidth * ratio), innerHeight)
    bar.fill(getEnergyBarFillGradient())
  }
  replaceHudBar(host, bar, existing)
}

export function drawInstanceHeroPowerBar(host: InstanceHudHost, ratio: number): void {
  const existing = host.getChildByLabel(LABEL_TYPES.powerBar)
  if (host.isDead || host.isDestroyed || !host.owner?.isPlayed) {
    if (existing) fadeOutHudBar(host, existing)
    return
  }

  const { bar, innerX, innerY, innerWidth, innerHeight } = createHudBar(host, {
    borderColor: HEALTH_BAR_BORDER_COLOR,
    label: LABEL_TYPES.powerBar,
    height: 5,
    width: 26,
    yOffset: 18,
    zIndex: 5,
  })
  const clampedRatio = Math.max(0, Math.min(1, ratio))
  bar.fill(0x312319)
  if (clampedRatio > 0) {
    bar.rect(innerX, innerY, Math.round(innerWidth * clampedRatio), innerHeight)
    bar.fill(clampedRatio >= 1 ? COLOR_GOLD : 0xf28722)
  }
  replaceHudBar(host, bar, existing)
}

export function removeInstanceHudBar(host: HudBarHost & { getChildByLabel(label: string): Container | null }, label: string): void {
  const bar = host.getChildByLabel(label)
  if (bar) fadeOutHudBar(host, bar)
}

function createHudBar(
  host: InstanceHudHost,
  options: { borderColor: number; label: string; height: number; width?: number; yOffset: number; zIndex: number }
): { bar: Graphics; innerX: number; innerY: number; innerWidth: number; innerHeight: number } {
  const barWidth = options.width ?? 22
  const borderWidth = 1
  const x = -barWidth / 2
  const y = getEntityHudTopY(host, options.yOffset)
  const innerX = x + borderWidth
  const innerY = y + borderWidth
  const innerWidth = barWidth - borderWidth * 2
  const innerHeight = options.height - borderWidth * 2
  const bar = new Graphics()
  bar.label = options.label
  bar.zIndex = options.zIndex
  bar.rect(x, y, barWidth, options.height)
  bar.fill(options.borderColor)
  bar.rect(innerX, innerY, innerWidth, innerHeight)
  bar.position.y = host.reliefLift ?? 0
  return { bar, innerX, innerY, innerWidth, innerHeight }
}

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

function scheduleHudBarFade(
  host: HudBarHost,
  bar: Container,
  mode: HudBarFadeState['mode'],
  onStep: (bar: Container, step: number, steps: number) => boolean | void,
  initialStep = 0
): void {
  const scheduler = host.context?.scheduler
  if (!scheduler) return
  const steps = Math.max(1, Math.round(HUD_BAR_FADE_MS / HUD_BAR_FADE_STEP_MS))
  let step = initialStep
  const state: HudBarFadeState = { bar, mode, taskId: -1 as SchedulerTaskId }
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
      const shouldStop = onStep(activeBar, step, steps) === true
      if (shouldStop || step >= steps) {
        if (taskId != null && mode === 'in') scheduler.remove(taskId)
        hudBarFadeStates.delete(activeBar)
      }
    },
    HUD_BAR_FADE_STEP_MS,
    `hud.barFade${mode === 'in' ? 'In' : 'Out'}`
  )
  state.taskId = taskId
  hudBarFadeStates.set(bar, state)
}

function fadeInHudBar(host: HudBarHost, bar: Container, fromAlpha = 0): void {
  const scheduler = host.context?.scheduler
  const startAlpha = Math.max(0, Math.min(1, fromAlpha))
  bar.alpha = startAlpha
  if (!scheduler || startAlpha >= 1) {
    bar.alpha = 1
    return
  }
  scheduleHudBarFade(
    host,
    bar,
    'in',
    (activeBar, step, steps) => {
      activeBar.alpha = Math.min(1, step / steps)
    },
    Math.round(startAlpha * Math.max(1, Math.round(HUD_BAR_FADE_MS / HUD_BAR_FADE_STEP_MS)))
  )
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
  scheduleHudBarFade(host, bar, 'out', (activeBar, step, steps) => {
    activeBar.alpha = startAlpha * Math.max(0, 1 - step / steps)
    if (step >= steps) {
      removeHudBarNow(host, activeBar)
      return true
    }
  })
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
