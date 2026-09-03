import { FAMILY_TYPES } from '../constants'
import type { RuntimeEntity } from '../../types/entities'
import { spawnSpriteFragmentBurst } from './spriteFragmentBurst'
import type { Container } from 'pixi.js'
import { getEntityFragmentGroundTargets } from './fragmentGroundTargets'

const BUILDING_FRAGMENT_IMPACT_THROTTLE_MS = 95
const buildingImpactTimes = new WeakMap<RuntimeEntity, number>()

type FragmentLayerTarget = RuntimeEntity & {
  parent?: Container | null
}

function getCombatBuildingFragmentCount(damage: number): number {
  const safeDamage = Math.max(1, Number.isFinite(damage) ? damage : 1)
  return Math.max(3, Math.min(24, 2 + Math.ceil(Math.sqrt(safeDamage) * 2.2)))
}

function canShowBuildingImpactFragments(target: RuntimeEntity): boolean {
  return target.family === FAMILY_TYPES.building && !target.context?.defeat && !target.isDead && !target.isDestroyed
}

function canEmitBuildingImpact(target: RuntimeEntity, now: number): boolean {
  const previous = buildingImpactTimes.get(target) ?? -Infinity
  if (now - previous < BUILDING_FRAGMENT_IMPACT_THROTTLE_MS) return false
  buildingImpactTimes.set(target, now)
  return true
}

export function spawnCombatBuildingImpactFragments(target: RuntimeEntity, damage: number): void {
  const context = target.context
  const sprite = target.sprite
  const layer = (target as FragmentLayerTarget).parent ?? sprite?.parent
  if (!context || !sprite || !layer || !canShowBuildingImpactFragments(target)) return
  if (!canEmitBuildingImpact(target, performance.now())) return

  const fragmentCount = getCombatBuildingFragmentCount(damage)
  const force = Math.min(1.9, 0.75 + Math.sqrt(Math.max(1, damage)) * 0.14)

  spawnSpriteFragmentBurst({
    context,
    host: target,
    sprite,
    layer,
    fragmentSize: 10,
    maxFragments: fragmentCount,
    durationMs: 500 + fragmentCount * 18,
    gravity: 0.0024 + force * 0.00025,
    minSpeed: 0.006 * force,
    maxSpeed: 0.035 * force,
    upwardVelocity: 0.022 * force,
    settleToBottom: true,
    groundTargets: getEntityFragmentGroundTargets(target),
    settleSpread: 14 + fragmentCount,
    settleStrength: 0.00005,
    groundBounce: 0.07,
    zIndexOffset: 0.46,
  })
}
