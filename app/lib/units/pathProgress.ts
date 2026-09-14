import { STEP_TIME } from '../../constants'

type MovementSprite = { playing?: boolean; play?(): void; stop?(): void }
type PathActor = {
  x: number
  y: number
  label?: string
  type?: string
  spaceId?: string
  path?: unknown[]
  dest?: unknown
  action?: string | null
  isDead?: boolean
  isDestroyed?: boolean
  sprite?: MovementSprite
  shadow?: MovementSprite | null
  horseSprite?: MovementSprite | null
  horseShadow?: MovementSprite | null
  appearanceLayerSprites?: Map<unknown, MovementSprite>
}
type Progress = { x: number; y: number; spaceId?: string; elapsed: number; retries: number }
const progress = new WeakMap<object, Progress>()
const stepping = new WeakSet<object>()
const RETRY_AFTER_MS = 2000
const MAX_RETRIES = 3

function setMovementPlaying(actor: PathActor, playing: boolean): void {
  for (const sprite of [
    actor.sprite,
    actor.shadow,
    actor.horseSprite,
    actor.horseShadow,
    ...(actor.appearanceLayerSprites?.values() ?? []),
  ]) {
    if (!sprite || sprite.playing === playing) continue
    if (playing) sprite.play?.()
    else sprite.stop?.()
  }
}

/** Measure simulated movement time, so pauses cannot trigger a false stall.
 * Keep the guard across repaths; nested immediate steps must not recurse forever.
 */
export function runPathStep(
  actor: PathActor,
  step: () => void,
  recover: () => void,
  stop: () => void,
  keepAnimating = false
): void {
  if (stepping.has(actor) || actor.isDead || actor.isDestroyed) return
  stepping.add(actor)
  const beforeX = actor.x
  const beforeY = actor.y
  try {
    if (!actor.path?.length) {
      progress.delete(actor)
      step()
      return
    }
    let state = progress.get(actor)
    if (!state || state.spaceId !== actor.spaceId || Math.hypot(actor.x - state.x, actor.y - state.y) > 0.1) {
      state = { x: actor.x, y: actor.y, spaceId: actor.spaceId, elapsed: 0, retries: 0 }
      progress.set(actor, state)
    }
    state.elapsed += STEP_TIME
    if (state.elapsed >= RETRY_AFTER_MS) {
      state.elapsed = 0
      state.retries++
      if (state.retries === 1 || state.retries > MAX_RETRIES) {
        console.warn('[movement-stalled]', {
          label: actor.label,
          type: actor.type,
          space: actor.spaceId ?? 'outside',
          x: actor.x,
          y: actor.y,
          action: actor.action,
          pathLength: actor.path.length,
          nextCell: cellSnapshot(actor.path[actor.path.length - 1]),
          recovery: state.retries > MAX_RETRIES ? 'stop' : 'repath',
        })
      }
      if (state.retries > MAX_RETRIES) {
        progress.delete(actor)
        stop()
      } else recover()
      return
    }
    step()
  } finally {
    stepping.delete(actor)
    // A step may have started work, contact approach or a landing animation.
    if (!actor.path?.length) progress.delete(actor)
    else if (!actor.isDead && !actor.isDestroyed) {
      setMovementPlaying(actor, keepAnimating || actor.x !== beforeX || actor.y !== beforeY)
    }
  }
}

function cellSnapshot(value: unknown): object | null {
  if (!value || typeof value !== 'object') return null
  const cell = value as { i?: number; j?: number; solid?: boolean; has?: { label?: string; type?: string } }
  return { i: cell.i, j: cell.j, solid: cell.solid, occupant: cell.has?.label, occupantType: cell.has?.type }
}
