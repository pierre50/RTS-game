import { CONTACT_APPROACH } from '../../config/contactProfiles'
import type { ContactActor, ContactApproachSample } from './contactTypes'

export type ContactApproachAdapter = {
  actor: ContactActor & { actionLocked?: boolean }
  isTargetValid(): boolean
  isCurrent(): boolean
  sample(): ContactApproachSample
  move(sample: ContactApproachSample): boolean
  begin(): void
  arrive(sample: ContactApproachSample): void
  schedule(callback: () => void): void
  stop(): void
  retry(): void
  tick?(): void
  stallPolicy?: { maxTicks: number; probeEvery: number; minimumProgress: number }
  wait?(): void
}

const activeApproaches = new WeakMap<object, object>()
const routingFallback = new WeakSet<object>()

function canStartApproach(adapter: ContactApproachAdapter): boolean {
  const { actor } = adapter
  return (
    !routingFallback.has(actor) && !actor.actionLocked && !actor.isDead && !actor.isDestroyed && adapter.isTargetValid()
  )
}

function isApproachInterrupted(adapter: ContactApproachAdapter): boolean {
  const { actor } = adapter
  return Boolean(actor.isDead || actor.isDestroyed || actor.actionLocked || !adapter.isCurrent())
}

export function startContactApproach(adapter: ContactApproachAdapter): boolean {
  const { actor } = adapter
  if (!canStartApproach(adapter)) return false
  let sample = adapter.sample()
  if (sample.distance > CONTACT_APPROACH.activationDistance) return false
  const policy = adapter.stallPolicy
  let blocked = false
  // Leave the current route untouched when its first precise movement is blocked.
  if (!sample.reachable) {
    blocked = !adapter.move(sample)
    if (blocked && !policy) return false
    sample = adapter.sample()
  }
  adapter.begin()
  const token = {}
  activeApproaches.set(actor, token)
  const stop = () => {
    activeApproaches.delete(actor)
    adapter.stop()
  }
  const arrive = (current: ContactApproachSample) => {
    stop()
    adapter.arrive(current)
  }
  if (sample.reachable) {
    arrive(sample)
    return true
  }
  let bestDistance = sample.distance
  let stalledTicks = 0
  if (blocked) adapter.wait?.()
  let remainingSteps: number = CONTACT_APPROACH.maxSteps
  adapter.schedule(() => {
    if (activeApproaches.get(actor) !== token) return
    if (isApproachInterrupted(adapter)) {
      stop()
      return
    }
    adapter.tick?.()
    // Check target validity before arrival: a depleted target must not restart work.
    if (adapter.isTargetValid()) {
      const current = adapter.sample()
      if (current.reachable) return arrive(current)
      if (policy) {
        if (current.distance <= bestDistance - policy.minimumProgress) {
          bestDistance = current.distance
          stalledTicks = 0
        } else stalledTicks++
        if (--remainingSteps > 0 && stalledTicks < policy.maxTicks) {
          if (!blocked || stalledTicks % policy.probeEvery === 0) blocked = !adapter.move(current)
          if (blocked) adapter.wait?.()
          return
        }
      } else if (--remainingSteps > 0 && adapter.move(current)) return
    }
    stop()
    routingFallback.add(actor)
    try {
      adapter.retry()
    } finally {
      routingFallback.delete(actor)
    }
  })
  return true
}
