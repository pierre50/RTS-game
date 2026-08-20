import type { RuntimeCell } from '../types/map'
import type { RuntimeEntity } from '../types/entities'
import type { EnergyEntity } from '../types/entities'
import type { UnitCreationExtra } from '../types/entities'
import type { ActionProps } from './combat'
import { instancesDistance } from './maths'
import { onSpriteLoopAtFrame } from './graphics'
import { hasEnergyForAction, spendOrWaitForEnergy, waitForEnergy } from './unitEnergy'

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

type AttackFrameTarget = RuntimeEntity | RuntimeCell | null | undefined

function getRuntimeEntity(target: AttackFrameTarget): RuntimeEntity | null {
  if (!target || typeof target !== 'object') return null
  if (typeof (target as Partial<RuntimeEntity>).family !== 'string') return null
  return target as RuntimeEntity
}

type AttackFrameActor = Partial<
  Pick<EnergyEntity, 'action' | 'dest'> & {
    getActionCondition?: (
      target: object | null | undefined,
      action?: string,
      props?: ActionProps | UnitCreationExtra
    ) => boolean
    attackRecoveryMs?: number
    attackRecoveryTaskId?: number | null
    context?: EnergyEntity['context']
    flushPendingOrder?: () => boolean
    sprite?: {
      onFrameChange?: ((currentFrame: number) => void) | undefined
      onComplete?: (() => void) | undefined
      onLoop?: (() => void) | undefined
      loop?: boolean
    }
    isUnitAtDest?: (action: string | null | undefined, dest: AttackFrameTarget) => boolean
    isAnimalAtDest?: (action: string | null, dest: RuntimeEntity | RuntimeCell | null) => boolean
    sendToEvt?: (
      dest: RuntimeEntity | RuntimeCell | null,
      action?: string | null,
      options?: { forceRepath?: boolean; allowBlockedGatherApproach?: boolean; preserveAutonomy?: boolean }
    ) => void
    sendTo?: (
      dest: RuntimeEntity | RuntimeCell,
      action?: string,
      options?: { forceRepath?: boolean; movementSheet?: string }
    ) => void
    syncMovingTargetDirection?: () => void
  }
>

type AttackFrameCallbacks = {
  releaseFrame: number
  prepareAttackSheet: () => void
  prepareRecoverySheet?: () => void
  syncMovingTargetDirection?: () => void
  onOutOfRange: (target: RuntimeEntity | null) => void
  onTargetUnavailable: (target: RuntimeEntity | null, phase: 'preflight' | 'release') => void
  onReadyToAttack: (target: RuntimeEntity) => boolean | void
}

type AttackLoopActorState = {
  action?: string | null
  family?: string
  path?: unknown[]
  actionLocked?: boolean
  energy?: number
  hitPoints?: number
  isDead?: boolean
  isDestroyed?: boolean
}

type AttackLoopReadiness = { status: 'ready'; target: RuntimeEntity } | { status: 'blocked' } | { status: 'not-ready' }

type AttackRecoveryHandle = Pick<EnergyEntity, 'attackRecoveryTaskId' | 'context'> & {
  sprite?: { onLoop?: (() => void) | undefined } | null
}

function getAttackLoopActorState(attacker: AttackFrameActor): AttackLoopActorState {
  return attacker as AttackLoopActorState
}

function syncAttackTargetDirection(attacker: AttackFrameActor, callbacks: AttackFrameCallbacks): void {
  if (callbacks.syncMovingTargetDirection) {
    callbacks.syncMovingTargetDirection()
  } else if (attacker.syncMovingTargetDirection) {
    attacker.syncMovingTargetDirection()
  }
}

function getAttackRecoveryMs(attacker: AttackFrameActor): number {
  const value = attacker.attackRecoveryMs
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0
}

export function clearCombatAttackRecovery(attacker: AttackRecoveryHandle): void {
  if (attacker.attackRecoveryTaskId == null) return
  attacker.context?.scheduler?.remove?.(attacker.attackRecoveryTaskId)
  attacker.attackRecoveryTaskId = null
  if (attacker.sprite && 'onLoop' in attacker.sprite) attacker.sprite.onLoop = undefined
}

function finishAttackRecovery(
  attacker: AttackFrameActor,
  callbacks: AttackFrameCallbacks,
  actionAtAttack: string | null,
  targetAtAttack: RuntimeEntity,
  taskId: number | null
): void {
  const actor = getAttackLoopActorState(attacker)
  if (taskId != null && attacker.attackRecoveryTaskId !== taskId) return
  attacker.attackRecoveryTaskId = null
  actor.actionLocked = false

  if (attacker.flushPendingOrder?.()) return
  if (actor.isDead || actor.isDestroyed) return
  if ((actor.action ?? null) !== actionAtAttack) return

  const target = getRuntimeEntity(attacker.dest)
  if (target !== targetAtAttack || !attacker.getActionCondition?.(target, actionAtAttack ?? undefined)) {
    callbacks.onTargetUnavailable(target, 'preflight')
    return
  }

  runAttackLoopOnFrame(attacker, callbacks)
}

function beginAttackRecovery(
  attacker: AttackFrameActor,
  callbacks: AttackFrameCallbacks,
  targetAtAttack: RuntimeEntity,
  clearAttackCallbacks: () => void
): void {
  const recoveryMs = getAttackRecoveryMs(attacker)
  if (!recoveryMs) return

  const sprite = attacker.sprite
  const actor = getAttackLoopActorState(attacker)
  const actionAtAttack = attacker.action ?? null
  let animationComplete = !sprite || !('onLoop' in sprite)
  let timerComplete = false
  let taskId: number | null = null
  const isCurrentRecovery = (): boolean => taskId == null || attacker.attackRecoveryTaskId === taskId
  const finishIfReady = (): void => {
    if (!timerComplete || !animationComplete) return
    finishAttackRecovery(attacker, callbacks, actionAtAttack, targetAtAttack, taskId)
  }

  clearCombatAttackRecovery(attacker)
  actor.actionLocked = true
  clearAttackCallbacks()

  if (sprite && 'onLoop' in sprite) {
    sprite.onLoop = () => {
      sprite.onLoop = undefined
      if (!isCurrentRecovery()) return
      animationComplete = true
      callbacks.prepareRecoverySheet?.()
      finishIfReady()
    }
  }

  const scheduler = attacker.context?.scheduler
  if (!scheduler?.addOneShot) {
    timerComplete = true
    finishIfReady()
    return
  }

  taskId = scheduler.addOneShot(
    () => {
      if (!isCurrentRecovery()) return
      timerComplete = true
      finishIfReady()
    },
    recoveryMs,
    'combat.attackRecovery'
  )
  attacker.attackRecoveryTaskId = taskId
}

function resolveReadyAttackTarget(
  attacker: AttackFrameActor,
  callbacks: AttackFrameCallbacks,
  phase: 'preflight' | 'release'
): AttackLoopReadiness {
  const actor = getAttackLoopActorState(attacker)
  const target = getRuntimeEntity(attacker.dest)
  if (actor.actionLocked) return { status: 'not-ready' }

  if (!attacker.getActionCondition?.(target, attacker.action ?? undefined)) {
    debugAttackLoop(attacker, 'target-unavailable', {
      target: getTargetLabel(target),
    })
    callbacks.onTargetUnavailable(target, phase)
    return { status: 'not-ready' }
  }
  if (!target) return { status: 'not-ready' }

  const isAtDest =
    attacker.isUnitAtDest?.(attacker.action, target) ??
    attacker.isAnimalAtDest?.(attacker.action ?? null, target) ??
    false
  if (!isAtDest) {
    debugAttackLoop(attacker, 'out-of-range', {
      target: getTargetLabel(target),
      distance: instancesDistance(attacker as { i: number; j: number }, target),
      targetI: target.i,
      targetJ: target.j,
      animalI: (attacker as { i: number; j: number }).i,
      animalJ: (attacker as { j: number; i: number }).j,
    })
    callbacks.onOutOfRange(target)
    return { status: 'not-ready' }
  }

  if (!hasEnergyForAction(attacker as EnergyEntity, attacker.action ?? null)) {
    waitForEnergy(attacker as EnergyEntity, attacker.action ?? null, target)
    debugAttackLoop(attacker, 'waiting-energy', {
      target: getTargetLabel(target),
      energy: actor.energy ?? 0,
    })
    return { status: 'blocked' }
  }

  syncAttackTargetDirection(attacker, callbacks)
  return { status: 'ready', target }
}

export function runAttackLoopOnFrame(attacker: AttackFrameActor, callbacks: AttackFrameCallbacks): void {
  const sprite = attacker.sprite
  if (!sprite) return

  const clearAttackCallbacks = (): void => {
    sprite.onFrameChange = undefined
    if ('onLoop' in sprite) sprite.onLoop = undefined
  }

  if (resolveReadyAttackTarget(attacker, callbacks, 'preflight').status !== 'ready') return

  sprite.loop = true
  if ('onComplete' in sprite) sprite.onComplete = undefined
  callbacks.prepareAttackSheet()

  onSpriteLoopAtFrame(sprite, callbacks.releaseFrame, () => {
    const actor = getAttackLoopActorState(attacker)
    try {
      const target = getRuntimeEntity(attacker.dest)
      debugAttackLoop(attacker, 'frame', {
        target: getTargetLabel(target),
      })
      const readiness = resolveReadyAttackTarget(attacker, callbacks, 'release')
      if (readiness.status === 'blocked') {
        clearAttackCallbacks()
        return
      }
      if (readiness.status !== 'ready') return
      const readyTarget = readiness.target

      if (!spendOrWaitForEnergy(attacker as EnergyEntity, attacker.action ?? null, readyTarget)) {
        debugAttackLoop(attacker, 'waiting-energy', {
          target: getTargetLabel(readyTarget),
          energy: (attacker as { energy?: number }).energy ?? 0,
        })
        clearAttackCallbacks()
        return
      }

      debugAttackLoop(attacker, 'ready-to-attack', {
        target: getTargetLabel(readyTarget),
      })
      const shouldRecover = callbacks.onReadyToAttack(readyTarget) !== false
      if (shouldRecover) beginAttackRecovery(attacker, callbacks, readyTarget, clearAttackCallbacks)
    } catch {
      if (actor.family === 'animal') {
        console.error('[combat-loop] exception', {
          actor: getActorLabel(attacker),
          target: getTargetLabel(getRuntimeEntity(attacker.dest)),
          action: actor.action,
          pathLength: (actor.path ?? []).length,
        })
      }
      clearAttackCallbacks()
      callbacks.onTargetUnavailable(getRuntimeEntity(attacker.dest), 'release')
    }
  })
}
