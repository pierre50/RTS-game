import { Assets } from 'pixi.js'
import type { Graphics } from 'pixi.js'
import { cartesianToIsometric, drawRoundedIsoShape, getRoundedIsoShapePoints } from '../lib'
import {
  COLOR_GOLD,
  COMM_INDICATOR_FILL_ALPHA,
  COMM_INDICATOR_STROKE_ALPHA,
  COMM_INDICATOR_STROKE_WIDTH,
  HERO_LOCKED_BACKPEDAL_MOVE_SPEED_FACTOR,
  HERO_LOCKED_STRAFE_MOVE_SPEED_FACTOR,
  SHEET_TYPES,
} from '../constants'
import { getCommCellsInRadius } from '../lib/npcInteraction'
import { applyBakedLpcUnitAssets } from '../lib/lpc'
import type { ControlBindingAction } from '../lib/settings'
import type { AnimalEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'

export const TARGET_FRAME_MS = 1000 / 60
const HERO_MOVE_DEBUG_THROTTLE_MS = 250
export const COMPANION_HORSE_CALL_MIN_RADIUS = 10
export const COMPANION_HORSE_CALL_MAX_RADIUS = 36
export const MOUNT_TRANSITION_FADE_OUT_MS = 120
export const MOUNT_TRANSITION_FADE_IN_MS = 140
export const MOUNT_TRANSITION_CAMERA_MS = 180
export const MOUNT_TRANSITION_TICK_MS = 40
export const MOUNT_TRANSITION_HIDDEN_ALPHA = 0.05

export type HeroAimPoint = { x: number; y: number }
export type MoveVector = { dx: number; dy: number }
type HorseCallDestination = Pick<RuntimeCell, 'i' | 'j' | 'x' | 'y' | 'z'>
export type CompanionHorse = AnimalEntity & {
  degree?: number
  companionOwner?: UnitEntity | null
  companionHitCount?: number
  strategy?: string
  ambientMovement?: boolean
  stop?: () => void
  sendTo?: (
    target: RuntimeEntity | RuntimeCell | HorseCallDestination | null,
    action?: string | null,
    options?: { forceRepath?: boolean }
  ) => void
}
export type ViewportMetrics = { visibleLeft: number; visibleTop: number; visibleWidth: number; visibleHeight: number }
type HeroDirectionLockHost = {
  shiftKeyActive?: boolean
  isHeroDirectionLockActive?: () => boolean
}

const HERO_MOVE_DIRECTIONS: Partial<Record<ControlBindingAction, MoveVector>> = {
  heroUp: { dx: 0, dy: -1 },
  heroDown: { dx: 0, dy: 1 },
  heroLeft: { dx: -1, dy: 0 },
  heroRight: { dx: 1, dy: 0 },
}

let lastHeroMoveDebugAt = 0

export function debugHeroMove(message: string, unit: UnitEntity, details: Record<string, unknown>): void {
  const now = performance.now()
  if (now - lastHeroMoveDebugAt < HERO_MOVE_DEBUG_THROTTLE_MS) return
  lastHeroMoveDebugAt = now
  console.debug('[hero-controlled unit move]', {
    message,
    details,
    unit: {
      controlMode: unit.controlMode,
      actionLocked: unit.actionLocked,
      isDead: unit.isDead,
      isDestroyed: unit.isDestroyed,
      currentSheet: unit.currentSheet,
      speed: unit.speed,
      i: unit.i,
      j: unit.j,
      x: Math.round(unit.x),
      y: Math.round(unit.y),
      visible: unit.visible,
      currentCell: {
        i: unit.currentCell?.i,
        j: unit.currentCell?.j,
        solid: unit.currentCell?.solid,
        border: unit.currentCell?.border,
        category: unit.currentCell?.category,
        has: unit.currentCell?.has
          ? { type: unit.currentCell.has.type, family: unit.currentCell.has.family, label: unit.currentCell.has.label }
          : null,
      },
    },
  })
}

export function getKeyboardMoveVector(keysPressed: Set<ControlBindingAction>): MoveVector {
  let dx = 0
  let dy = 0
  for (const action of keysPressed) {
    const dir = HERO_MOVE_DIRECTIONS[action]
    if (!dir) continue
    dx += dir.dx
    dy += dir.dy
  }
  return { dx, dy }
}

export function isHeroMoveAction(action: ControlBindingAction): boolean {
  return Boolean(HERO_MOVE_DIRECTIONS[action])
}

export function easeInOut(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return clamped * clamped * (3 - 2 * clamped)
}

export function isHeroDirectionLockActive(controls: HeroDirectionLockHost): boolean {
  return controls.isHeroDirectionLockActive?.() ?? Boolean(controls.shiftKeyActive)
}

export function getVectorFromDegree(degree: number): MoveVector {
  const radians = ((degree - 180) * Math.PI) / 180
  return { dx: Math.cos(radians), dy: Math.sin(radians) }
}

export function getPointInDirection(unit: UnitEntity, degree: number, distance = 100): HeroAimPoint {
  const vector = getVectorFromDegree(degree)
  return {
    x: unit.x + vector.dx * distance,
    y: unit.y + vector.dy * distance,
  }
}

export function getLockedMoveSpeedFactor(move: MoveVector, facing: MoveVector): number {
  const moveLength = Math.hypot(move.dx, move.dy)
  const facingLength = Math.hypot(facing.dx, facing.dy)
  if (moveLength <= 0 || facingLength <= 0) return 1

  const alignment = (move.dx * facing.dx + move.dy * facing.dy) / (moveLength * facingLength)
  if (alignment >= 0) {
    return HERO_LOCKED_STRAFE_MOVE_SPEED_FACTOR + (1 - HERO_LOCKED_STRAFE_MOVE_SPEED_FACTOR) * alignment
  }
  return (
    HERO_LOCKED_STRAFE_MOVE_SPEED_FACTOR +
    (HERO_LOCKED_STRAFE_MOVE_SPEED_FACTOR - HERO_LOCKED_BACKPEDAL_MOVE_SPEED_FACTOR) * alignment
  )
}

export function refreshBakedAppearance(unit: UnitEntity): void {
  applyBakedLpcUnitAssets(unit)
  Object.assign(
    unit,
    Object.fromEntries(Object.entries(unit.assets ?? {}).map(([key, value]) => [key, Assets.cache.get(value)]))
  )
  unit.setTextures?.(unit.currentSheet ?? SHEET_TYPES.standing)
}

export function drawCommIndicatorCells(indicator: Graphics, hero: UnitEntity, radius: number): void {
  const cells = getCommCellsInRadius(hero, radius)
  for (const cell of cells) {
    const [cellX, cellY] = cartesianToIsometric(cell.i, cell.j)
    drawRoundedIsoShape(
      indicator,
      getRoundedIsoShapePoints({
        x: cellX - hero.x,
        y: cellY - hero.y,
        factor: 1,
      })
    )
  }
  if (!cells.length) return
  indicator.fill({ color: COLOR_GOLD, alpha: COMM_INDICATOR_FILL_ALPHA })
  indicator.stroke({
    color: COLOR_GOLD,
    width: COMM_INDICATOR_STROKE_WIDTH,
    alpha: COMM_INDICATOR_STROKE_ALPHA,
  })
}

function isFreeHorseCell(cell?: RuntimeCell | null): cell is RuntimeCell {
  return Boolean(cell && !cell.solid && !cell.has && cell.category !== 'Water' && !cell.waterBorder && !cell.border)
}

function cellIsOutsideViewport(cell: RuntimeCell, viewport: ViewportMetrics, margin = 48): boolean {
  return (
    cell.x < viewport.visibleLeft - margin ||
    cell.x > viewport.visibleLeft + viewport.visibleWidth + margin ||
    cell.y < viewport.visibleTop - margin ||
    cell.y > viewport.visibleTop + viewport.visibleHeight + margin
  )
}

export function findCompanionHorseSpawnCell(
  hero: UnitEntity,
  radiusLimit = COMPANION_HORSE_CALL_MAX_RADIUS,
  options: { minRadius?: number; viewport?: ViewportMetrics | null } = {}
): RuntimeCell | null {
  const grid = hero.context?.map?.grid
  if (!grid) return null
  const minRadius = Math.max(1, Math.min(options.minRadius ?? 1, radiusLimit))
  const viewport = options.viewport ?? null
  if (radiusLimit > 1 && !viewport) {
    const preferred: Array<[number, number]> = [
      [0, radiusLimit],
      [-radiusLimit, 0],
      [radiusLimit, 0],
      [0, -radiusLimit],
    ]
    for (const [di, dj] of preferred) {
      const cell = grid[hero.i + di]?.[hero.j + dj]
      if (isFreeHorseCell(cell)) return cell
    }
  }
  let firstFreeCell: RuntimeCell | null = null
  for (let radius = minRadius; radius <= radiusLimit; radius++) {
    for (let di = -radius; di <= radius; di++) {
      const djAbs = radius - Math.abs(di)
      const offsets: Array<[number, number]> = djAbs === 0 ? [[di, 0]] : [[di, djAbs], [di, -djAbs]]
      for (const [oi, oj] of offsets) {
        const cell = grid[hero.i + oi]?.[hero.j + oj]
        if (!isFreeHorseCell(cell)) continue
        if (!firstFreeCell) firstFreeCell = cell
        if (!viewport || cellIsOutsideViewport(cell, viewport)) return cell
      }
    }
  }
  return firstFreeCell
}
