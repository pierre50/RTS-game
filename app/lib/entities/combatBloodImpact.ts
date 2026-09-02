import { Graphics, type Container } from 'pixi.js'
import { FAMILY_TYPES } from '../constants'
import { getBloodEffectsEnabled } from '../audio/settings'
import type { RuntimeEntity } from '../../types/entities'
import type { Point } from '../../types/grid'

type BloodDrop = {
  graphic: Graphics
  vx: number
  vy: number
  ageMs: number
  durationMs: number
  groundY: number
  radius: number
  settled: boolean
}

export type CombatBloodImpactOptions = {
  damage?: number
  hitDirection?: Point
  random?: () => number
}

const BLOOD_IMPACT_THROTTLE_MS = 75
const BLOOD_STEP_MS = 16
const BLOOD_GRAVITY = 0.0017
const BLOOD_COLORS = [0x8f1010, 0x6e0909, 0xb01b16]
const bloodImpactTimes = new WeakMap<RuntimeEntity, number>()

function getCombatBloodDropCount(damage: number): number {
  const safeDamage = Math.max(1, Number.isFinite(damage) ? damage : 1)
  return Math.max(3, Math.min(10, 2 + Math.ceil(Math.sqrt(safeDamage) * 1.5)))
}

function canShowBloodImpact(target: RuntimeEntity): boolean {
  return (
    (target.family === FAMILY_TYPES.unit || target.family === FAMILY_TYPES.animal) &&
    !target.context?.defeat &&
    !target.isDead &&
    !target.isDestroyed
  )
}

function getImpactDirection(
  attacker: RuntimeEntity | null | undefined,
  target: RuntimeEntity,
  hitDirection?: Point
): Point {
  const dx = hitDirection?.x ?? (attacker ? target.x - attacker.x : 1)
  const dy = hitDirection?.y ?? (attacker ? target.y - attacker.y : -0.35)
  const length = Math.hypot(dx, dy) || 1
  return { x: dx / length, y: dy / length }
}

function canEmitBloodImpact(target: RuntimeEntity, now: number): boolean {
  const previous = bloodImpactTimes.get(target) ?? -Infinity
  if (now - previous < BLOOD_IMPACT_THROTTLE_MS) return false
  bloodImpactTimes.set(target, now)
  return true
}

function createBloodDrops(
  target: RuntimeEntity,
  attacker: RuntimeEntity | null | undefined,
  { damage = 1, hitDirection, random = Math.random }: CombatBloodImpactOptions
): BloodDrop[] {
  const sprite = target.sprite
  if (!sprite) return []
  const direction = getImpactDirection(attacker, target, hitDirection)
  const amount = getCombatBloodDropCount(damage)
  const force = Math.min(1.8, 0.75 + Math.sqrt(Math.max(1, damage)) * 0.16)
  const startX = sprite.x
  const startY = sprite.y - sprite.height * sprite.anchor.y * 0.45
  const groundY = sprite.y + sprite.height * (1 - sprite.anchor.y)

  return Array.from({ length: amount }, () => {
    const radius = 1.2 + random() * 1.9
    const graphic = new Graphics()
    graphic.circle(0, 0, radius)
    graphic.fill({ color: BLOOD_COLORS[Math.floor(random() * BLOOD_COLORS.length)], alpha: 0.86 })
    graphic.position.set(startX + (random() - 0.5) * 7, startY + (random() - 0.5) * 5)
    graphic.eventMode = 'none'
    graphic.zIndex = (target.zIndex ?? 0) + 0.55 + random() * 0.08

    const speed = (0.06 + random() * 0.075) * force
    return {
      graphic,
      vx: direction.x * speed + (random() - 0.5) * 0.035,
      vy: direction.y * speed - (0.035 + random() * 0.045),
      ageMs: 0,
      durationMs: 300 + random() * 180,
      groundY,
      radius,
      settled: false,
    }
  })
}

function animateBloodDrops(target: RuntimeEntity, drops: BloodDrop[], parent: Container): void {
  const scheduler = target.context?.scheduler
  if (!scheduler || !drops.length) return
  let taskId: number | null = null
  taskId = scheduler.add(
    () => {
      let alive = 0
      for (const drop of drops) {
        if (drop.graphic.destroyed) continue
        drop.ageMs += BLOOD_STEP_MS
        if (drop.ageMs >= drop.durationMs || target.context?.defeat || parent.destroyed) {
          drop.graphic.parent?.removeChild(drop.graphic)
          drop.graphic.destroy()
          continue
        }
        if (!drop.settled) {
          drop.vy += BLOOD_GRAVITY * BLOOD_STEP_MS
          drop.graphic.x += drop.vx * BLOOD_STEP_MS
          drop.graphic.y += drop.vy * BLOOD_STEP_MS
          if (drop.graphic.y >= drop.groundY) {
            drop.graphic.y = drop.groundY
            drop.vx = 0
            drop.vy = 0
            drop.settled = true
          }
        }
        drop.graphic.scale.set(Math.max(0.55, 1 - drop.ageMs / drop.durationMs) * (drop.radius / 2))
        drop.graphic.alpha = Math.max(0, 1 - drop.ageMs / drop.durationMs)
        alive++
      }
      if (alive <= 0 && taskId != null) scheduler.remove(taskId)
    },
    BLOOD_STEP_MS,
    'combat.bloodImpact'
  )
}

export function spawnCombatBloodImpact(
  attacker: RuntimeEntity | null | undefined,
  target: RuntimeEntity,
  options: CombatBloodImpactOptions = {}
): void {
  const parent = target.sprite?.parent
  if (
    !getBloodEffectsEnabled() ||
    !parent ||
    !canShowBloodImpact(target) ||
    !canEmitBloodImpact(target, performance.now())
  )
    return
  const drops = createBloodDrops(target, attacker, options)
  if (!drops.length) return
  for (const drop of drops) parent.addChild(drop.graphic)
  animateBloodDrops(target, drops, parent)
}
