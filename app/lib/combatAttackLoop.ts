import type { RuntimeCell } from '../types/map'
import type { RuntimeEntity } from '../types/entities'
import type { EnergyEntity } from '../types/entities'
import { instancesDistance } from './maths'
import { onSpriteLoopAtFrame } from './graphics'
import { spendOrWaitForEnergy } from './unitEnergy'

const ATTACK_LOOP_DEBUG_THROTTLE_MS = 250
const lastAttackLoopDebugAt = new WeakMap<object, number>()

function getActorLabel(attacker: AttackFrameActor): string {
  const target = attacker as { family?: string; label?: string; type?: string }
  if (target.label) return `${target.family ?? 'unknown'}:${target.label}`
  if (target.type) return `${target.family ?? 'unknown'}:${target.type}`
  return `${target.family ?? 'unknown'}`
}

function getTargetLabel(target: RuntimeEntity | null): string {
  if (!target) return 'null'
  return `${target.family ?? 'unknown'}:${target.label || target.type || 'unknown'}`
}

function debugAttackLoop(attacker: AttackFrameActor, stage: string, details: Record<string, unknown> = {}): void {
  const actor = attacker as {
    action?: string | null
    label?: string
    type?: string
    family?: string
    actionLocked?: boolean
    path?: unknown[]
    hitPoints?: number
    energy?: number
  }
  if (actor.family !== 'animal') return
  if (!actor.label && !actor.type) return

  const now = performance.now()
  const last = lastAttackLoopDebugAt.get(attacker as object) ?? 0
  if (now - last < ATTACK_LOOP_DEBUG_THROTTLE_MS) return
  lastAttackLoopDebugAt.set(attacker as object, now)

  console.log(
    `[combat-loop] ${getActorLabel(attacker)} ${stage}`,
    Object.assign(
      {
        action: actor.action,
        actionLocked: actor.actionLocked,
        family: actor.family,
        pathLength: (actor.path ?? []).length,
        hp: actor.hitPoints,
        energy: actor.energy,
      },
      details
    )
  )
}

type AttackFrameTarget = RuntimeEntity | RuntimeCell | null

function getRuntimeEntity(target: AttackFrameTarget): RuntimeEntity | null {
  if (!target || typeof target !== 'object') return null
  if (typeof (target as Partial<RuntimeEntity>).family !== 'string') return null
  return target as RuntimeEntity
}

type AttackFrameActor = Partial<
  Pick<EnergyEntity, 'action' | 'dest'> & {
    getActionCondition?: (target: object | null | undefined, action?: string | null) => boolean
    sprite?: {
      onFrameChange?: ((currentFrame: number) => void) | null
      onComplete?: (() => void) | null
      onLoop?: (() => void) | null
      loop?: boolean
    }
    isUnitAtDest?: (action: string | null | undefined, dest: AttackFrameTarget) => boolean
    sendToEvt?: (
      dest: AttackFrameTarget,
      action?: string | null,
      options?: { forceRepath?: boolean; allowBlockedGatherApproach?: boolean; preserveAutonomy?: boolean }
    ) => void
    sendTo?: (dest: AttackFrameTarget, action?: string | null, options?: { forceRepath?: boolean }) => void
    syncMovingTargetDirection?: () => void
  }
>

type AttackFrameCallbacks = {
  releaseFrame: number
  prepareAttackSheet: () => void
  onOutOfRange: (target: RuntimeEntity) => void
  onTargetUnavailable: (target: RuntimeEntity | null) => void
  onReadyToAttack: (target: RuntimeEntity) => void
}

export function runAttackLoopOnFrame(attacker: AttackFrameActor, callbacks: AttackFrameCallbacks): void {
  const sprite = attacker.sprite
  if (!sprite) return

  const clearAttackCallbacks = (): void => {
    sprite.onFrameChange = undefined
    if ('onLoop' in sprite) sprite.onLoop = undefined
  }

  sprite.loop = true
  if ('onComplete' in sprite) sprite.onComplete = undefined
  callbacks.prepareAttackSheet()

  onSpriteLoopAtFrame(sprite, callbacks.releaseFrame, () => {
    const actor = attacker as {
      action?: string | null
      family?: string
      path?: unknown[]
      actionLocked?: boolean
      energy?: number
      hitPoints?: number
    }
    const target = getRuntimeEntity(attacker.dest)
    try {
      debugAttackLoop(attacker, 'frame', {
        target: getTargetLabel(target),
      })
      if (actor.actionLocked) return

      if (!attacker.getActionCondition?.(target, attacker.action)) {
        debugAttackLoop(attacker, 'target-unavailable', {
          target: getTargetLabel(target),
        })
        callbacks.onTargetUnavailable(target)
        return
      }
      if (!target) return
    
      if (attacker.syncMovingTargetDirection) {
        attacker.syncMovingTargetDirection()
      }

      if (!attacker.isUnitAtDest?.(attacker.action, target)) {
        debugAttackLoop(attacker, 'out-of-range', {
          target: getTargetLabel(target),
          distance: instancesDistance(attacker as { i: number; j: number }, target),
          targetI: target.i,
          targetJ: target.j,
          animalI: (attacker as { i: number; j: number }).i,
          animalJ: (attacker as { j: number; i: number }).j,
        })
        callbacks.onOutOfRange(target)
        return
      }

      if (!spendOrWaitForEnergy(attacker as EnergyEntity, attacker.action ?? null, target)) {
        debugAttackLoop(attacker, 'waiting-energy', {
          target: getTargetLabel(target),
          energy: (attacker as { energy?: number }).energy ?? 0,
        })
        return
      }

      debugAttackLoop(attacker, 'ready-to-attack', {
        target: getTargetLabel(target),
      })
      callbacks.onReadyToAttack(target)
    } catch {
      if (actor.family === 'animal') {
        console.error('[combat-loop] exception', {
          actor: getActorLabel(attacker),
          target: getTargetLabel(target),
          action: actor.action,
          pathLength: (actor.path ?? []).length,
        })
      }
      clearAttackCallbacks()
      callbacks.onTargetUnavailable(target)
    }
  })
}
