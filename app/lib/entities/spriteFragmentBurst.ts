import { Rectangle, Sprite, Texture, type Container } from 'pixi.js'
import { CELL_HEIGHT, CELL_WIDTH } from '../../constants'
import type { GameContextLike, SchedulerLike, SchedulerTaskId } from '../../types/context'

export type SpriteFragmentBurstGroundTarget = {
  x: number
  y: number
  zIndex?: number
}

export type SpriteFragmentBurstSourcePoint = {
  x: number
  y: number
  groundY?: number
  radiusX?: number
  radiusY?: number
  zIndex?: number
}

type FragmentState = {
  sprite: Sprite
  texture: Texture
  vx: number
  vy: number
  angularVelocity: number
  ageMs: number
  durationMs: number
  fadeStartMs: number
  settleX?: number
  settleY?: number
  groundY?: number
}

export type SpriteFragmentBurstOptions = {
  context: Pick<GameContextLike, 'app' | 'scheduler'>
  host: { x: number; y: number; zIndex?: number; parent?: Container | null }
  sprite: Sprite
  layer?: Container | null
  fragmentSize?: number
  maxFragments?: number
  durationMs?: number
  stepMs?: number
  gravity?: number
  minSpeed?: number
  maxSpeed?: number
  upwardVelocity?: number
  settleToBottom?: boolean
  lockX?: boolean
  sourcePoint?: SpriteFragmentBurstSourcePoint
  groundTargets?: SpriteFragmentBurstGroundTarget[]
  settleSpread?: number
  settleStrength?: number
  groundBounce?: number
  zIndexOffset?: number
  random?: () => number
}

type OpaqueBounds = {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

type TileCandidateResult = {
  bounds: OpaqueBounds | null
  tiles: Rectangle[]
}

const DEFAULT_FRAGMENT_SIZE = 6
const DEFAULT_MAX_FRAGMENTS = 44
const DEFAULT_DURATION_MS = 620
const DEFAULT_STEP_MS = 16
const DEFAULT_GRAVITY = 0.0018
const DEFAULT_MIN_SPEED = 0.045
const DEFAULT_MAX_SPEED = 0.18
const DEFAULT_UPWARD_VELOCITY = 0.11
const DEFAULT_SETTLE_SPREAD = 18
const DEFAULT_SETTLE_STRENGTH = 0.00006
const DEFAULT_GROUND_BOUNCE = 0.16
const DEFAULT_Z_INDEX_OFFSET = 0.35
const OPAQUE_ALPHA_THRESHOLD = 16
const ISO_CELL_INSET = 0.86
const ISO_CELL_DEPTH_SCALE = 1 / (CELL_HEIGHT / 2)
const ISO_HALF_DEPTH_BIAS = 0.04
const DEFAULT_SOURCE_RADIUS_X = CELL_WIDTH * 0.82
const DEFAULT_SOURCE_RADIUS_Y = CELL_HEIGHT * 1.4

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function destroyFragment(fragment: FragmentState): void {
  fragment.sprite.parent?.removeChild(fragment.sprite)
  fragment.sprite.destroy({ children: true, texture: false })
  fragment.texture.destroy(false)
}

function hasOpaquePixels(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  x: number,
  y: number,
  w: number,
  h: number
): boolean {
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      if (pixels[(py * width + px) * 4 + 3] > OPAQUE_ALPHA_THRESHOLD) return true
    }
  }
  return false
}

function findOpaqueBounds(pixels: Uint8ClampedArray | Uint8Array, width: number, height: number): OpaqueBounds | null {
  let minX = width
  let maxX = -1
  let minY = height
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] <= OPAQUE_ALPHA_THRESHOLD) continue
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }

  return maxX >= minX && maxY >= minY ? { minX, maxX, minY, maxY } : null
}

function getOpaqueTileCandidates(
  context: Pick<GameContextLike, 'app'>,
  texture: Texture,
  fragmentSize: number
): TileCandidateResult {
  const frameWidth = Math.floor(texture.frame.width)
  const frameHeight = Math.floor(texture.frame.height)
  const tiles: Rectangle[] = []
  let bounds: OpaqueBounds | null = null
  let pixels: Uint8ClampedArray | Uint8Array | null = null
  let extractedWidth = frameWidth

  try {
    const extracted = context.app.renderer.extract.pixels(texture)
    pixels = extracted.pixels
    extractedWidth = extracted.width
    bounds = findOpaqueBounds(extracted.pixels, extracted.width, extracted.height)
  } catch {
    pixels = null
  }

  for (let y = 0; y < frameHeight; y += fragmentSize) {
    for (let x = 0; x < frameWidth; x += fragmentSize) {
      const w = Math.min(fragmentSize, frameWidth - x)
      const h = Math.min(fragmentSize, frameHeight - y)
      if (!pixels || hasOpaquePixels(pixels, extractedWidth, x, y, w, h)) {
        tiles.push(new Rectangle(x, y, w, h))
      }
    }
  }

  return { bounds, tiles }
}

function pickCandidates(candidates: Rectangle[], maxFragments: number, random: () => number): Rectangle[] {
  if (candidates.length <= maxFragments) return candidates
  const picked = [...candidates]
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[picked[i], picked[j]] = [picked[j], picked[i]]
  }
  return picked.slice(0, maxFragments)
}

function getTileWorldCenter(
  host: SpriteFragmentBurstOptions['host'],
  sprite: Sprite,
  texture: Texture,
  tile: Rectangle
): { x: number; y: number } {
  const frameWidth = texture.frame.width
  const frameHeight = texture.frame.height
  const originX = sprite.position.x - sprite.anchor.x * frameWidth * sprite.scale.x
  const originY = sprite.position.y - sprite.anchor.y * frameHeight * sprite.scale.y
  return {
    x: host.x + originX + (tile.x + tile.width / 2) * sprite.scale.x,
    y: host.y + originY + (tile.y + tile.height / 2) * sprite.scale.y,
  }
}

function focusTileCandidates(
  candidates: Rectangle[],
  sourcePoint: SpriteFragmentBurstSourcePoint | undefined,
  host: SpriteFragmentBurstOptions['host'],
  sprite: Sprite,
  texture: Texture,
  maxFragments: number
): Rectangle[] {
  if (!sourcePoint || !candidates.length) return candidates

  const radiusX = sourcePoint.radiusX ?? DEFAULT_SOURCE_RADIUS_X
  const radiusY = sourcePoint.radiusY ?? DEFAULT_SOURCE_RADIUS_Y
  const scored = candidates
    .map(tile => {
      const center = getTileWorldCenter(host, sprite, texture, tile)
      const dx = (center.x - sourcePoint.x) / radiusX
      const dy = (center.y - sourcePoint.y) / radiusY
      return { score: dx * dx + dy * dy, tile }
    })
    .sort((a, b) => a.score - b.score)

  const inside = scored.filter(candidate => candidate.score <= 1).map(candidate => candidate.tile)
  if (inside.length) return inside
  return scored.slice(0, Math.max(1, maxFragments * 2)).map(candidate => candidate.tile)
}

function createFragmentTexture(texture: Texture, tile: Rectangle): Texture {
  return new Texture({
    source: texture.source,
    frame: new Rectangle(texture.frame.x + tile.x, texture.frame.y + tile.y, tile.width, tile.height),
    orig: new Rectangle(0, 0, tile.width, tile.height),
    rotate: texture.rotate,
    defaultAnchor: { x: 0.5, y: 0.5 },
  })
}

function pickGroundTarget(
  groundTargets: SpriteFragmentBurstGroundTarget[] | undefined,
  random: () => number
): SpriteFragmentBurstGroundTarget | null {
  if (!groundTargets?.length) return null
  return groundTargets[Math.floor(random() * groundTargets.length)] ?? null
}

function randomPointInIsoCell(
  target: SpriteFragmentBurstGroundTarget,
  random: () => number
): SpriteFragmentBurstGroundTarget & { offsetY: number } {
  const halfWidth = (CELL_WIDTH / 2) * ISO_CELL_INSET
  const halfHeight = (CELL_HEIGHT / 2) * ISO_CELL_INSET
  let rx = 0
  let ry = 0
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidateX = (random() * 2 - 1) * halfWidth
    const candidateY = (random() * 2 - 1) * halfHeight
    if (Math.abs(candidateX) / halfWidth + Math.abs(candidateY) / halfHeight > 1) continue
    rx = candidateX
    ry = candidateY
    break
  }
  return {
    x: target.x + rx,
    y: target.y + ry,
    offsetY: ry,
    zIndex: target.zIndex,
  }
}

function getGroundSettleZIndex(
  target: (SpriteFragmentBurstGroundTarget & { offsetY: number }) | null,
  fallbackZIndex: number | undefined,
  random: () => number
): number {
  const baseZIndex = target?.zIndex ?? fallbackZIndex ?? 0
  if (!target) return baseZIndex + DEFAULT_Z_INDEX_OFFSET + random() * 0.08
  const halfBias = target.offsetY < 0 ? -ISO_HALF_DEPTH_BIAS : ISO_HALF_DEPTH_BIAS
  return baseZIndex + target.offsetY * ISO_CELL_DEPTH_SCALE + halfBias + random() * 0.01
}

function createFragmentStates({
  host,
  sprite,
  texture,
  bounds,
  candidates,
  durationMs,
  minSpeed,
  maxSpeed,
  upwardVelocity,
  settleToBottom,
  lockX,
  groundTargets,
  settleSpread,
  zIndexOffset,
  sourcePoint,
  random,
}: Required<
  Pick<
    SpriteFragmentBurstOptions,
    | 'host'
    | 'sprite'
    | 'durationMs'
    | 'minSpeed'
    | 'maxSpeed'
    | 'upwardVelocity'
    | 'settleToBottom'
    | 'lockX'
    | 'settleSpread'
    | 'zIndexOffset'
    | 'random'
  >
> & {
  bounds: OpaqueBounds | null
  candidates: Rectangle[]
  groundTargets?: SpriteFragmentBurstGroundTarget[]
  sourcePoint?: SpriteFragmentBurstSourcePoint
  texture: Texture
}): FragmentState[] {
  const frameWidth = texture.frame.width
  const frameHeight = texture.frame.height
  const originX = sprite.position.x - sprite.anchor.x * frameWidth * sprite.scale.x
  const originY = sprite.position.y - sprite.anchor.y * frameHeight * sprite.scale.y
  const centerX = frameWidth / 2
  const centerY = frameHeight / 2
  const groundY = host.y + originY + ((bounds?.maxY ?? frameHeight - 1) + 1) * sprite.scale.y
  const fallbackGroundY = sourcePoint?.groundY ?? groundY
  const fallbackZIndex = sourcePoint?.zIndex ?? host.zIndex
  const settleCenterX = host.x + originX + (bounds ? (bounds.minX + bounds.maxX) / 2 : centerX) * sprite.scale.x

  return candidates.map(tile => {
    const fragmentTexture = createFragmentTexture(texture, tile)
    const fragment = new Sprite(fragmentTexture)
    const localX = originX + (tile.x + tile.width / 2) * sprite.scale.x
    const localY = originY + (tile.y + tile.height / 2) * sprite.scale.y
    const dx = tile.x + tile.width / 2 - centerX
    const dy = tile.y + tile.height / 2 - centerY
    const distance = Math.hypot(dx, dy) || 1
    const speed = minSpeed + random() * (maxSpeed - minSpeed)
    const groundTarget = settleToBottom ? pickGroundTarget(groundTargets, random) : null
    const settleTarget = groundTarget ? randomPointInIsoCell(groundTarget, random) : null

    fragment.anchor.set(0.5)
    fragment.position.set(host.x + localX, host.y + localY)
    fragment.scale.set(sprite.scale.x, sprite.scale.y)
    fragment.rotation = sprite.rotation
    fragment.alpha = sprite.alpha
    fragment.tint = sprite.tint
    fragment.eventMode = 'none'
    fragment.roundPixels = true
    fragment.zIndex = settleTarget
      ? getGroundSettleZIndex(settleTarget, fallbackZIndex, random)
      : (fallbackZIndex ?? 0) + zIndexOffset + random() * 0.08

    return {
      sprite: fragment,
      texture: fragmentTexture,
      vx: lockX ? 0 : (dx / distance) * speed + (random() - 0.5) * speed * 0.55,
      vy: (dy / distance) * speed - upwardVelocity * (0.65 + random() * 0.7),
      angularVelocity: (random() - 0.5) * 0.012,
      ageMs: 0,
      durationMs: durationMs * (0.78 + random() * 0.34),
      fadeStartMs: durationMs * (0.34 + random() * 0.22),
      settleX:
        !lockX && settleTarget
          ? settleTarget.x
          : settleToBottom && !lockX
            ? settleCenterX + (random() - 0.5) * settleSpread
            : undefined,
      settleY: settleTarget?.y,
      groundY: settleTarget?.y ?? (settleToBottom ? fallbackGroundY : undefined),
    }
  })
}

function animateFragments(
  fragments: FragmentState[],
  scheduler: Pick<SchedulerLike, 'add' | 'remove'>,
  stepMs: number,
  gravity: number,
  settleStrength: number,
  groundBounce: number
): SchedulerTaskId {
  let taskId: SchedulerTaskId | null = null
  taskId = scheduler.add(
    () => {
      let aliveCount = 0
      for (const fragment of fragments) {
        if (fragment.sprite.destroyed) continue
        fragment.ageMs += stepMs
        if (fragment.ageMs >= fragment.durationMs) {
          destroyFragment(fragment)
          continue
        }

        fragment.vy += gravity * stepMs
        if (fragment.settleX != null) {
          fragment.vx += (fragment.settleX - fragment.sprite.x) * settleStrength * stepMs
        }
        if (fragment.settleY != null) {
          fragment.vy += (fragment.settleY - fragment.sprite.y) * settleStrength * stepMs
        }
        fragment.sprite.x += fragment.vx * stepMs
        fragment.sprite.y += fragment.vy * stepMs
        fragment.sprite.rotation += fragment.angularVelocity * stepMs
        if (fragment.groundY != null && fragment.sprite.y > fragment.groundY) {
          fragment.sprite.y = fragment.groundY
          fragment.vy = -Math.abs(fragment.vy) * groundBounce
          fragment.vx *= 0.72
          fragment.angularVelocity *= 0.6
        }

        const fadeRatio = clamp(
          (fragment.ageMs - fragment.fadeStartMs) / (fragment.durationMs - fragment.fadeStartMs),
          0,
          1
        )
        fragment.sprite.alpha = 1 - fadeRatio
        aliveCount += 1
      }

      if (aliveCount <= 0 && taskId != null) {
        scheduler.remove(taskId)
      }
    },
    stepMs,
    'sprite.fragmentBurst'
  )
  return taskId
}

export function spawnSpriteFragmentBurst(options: SpriteFragmentBurstOptions): void {
  const {
    context,
    host,
    sprite,
    layer = host.parent,
    fragmentSize = DEFAULT_FRAGMENT_SIZE,
    maxFragments = DEFAULT_MAX_FRAGMENTS,
    durationMs = DEFAULT_DURATION_MS,
    stepMs = DEFAULT_STEP_MS,
    gravity = DEFAULT_GRAVITY,
    minSpeed = DEFAULT_MIN_SPEED,
    maxSpeed = DEFAULT_MAX_SPEED,
    upwardVelocity = DEFAULT_UPWARD_VELOCITY,
    settleToBottom = false,
    lockX = false,
    sourcePoint,
    groundTargets,
    settleSpread = DEFAULT_SETTLE_SPREAD,
    settleStrength = DEFAULT_SETTLE_STRENGTH,
    groundBounce = DEFAULT_GROUND_BOUNCE,
    zIndexOffset = DEFAULT_Z_INDEX_OFFSET,
    random = Math.random,
  } = options

  if (!layer || sprite.destroyed || !sprite.texture?.source) return

  const safeFragmentSize = Math.max(2, Math.floor(fragmentSize))
  const safeMaxFragments = Math.max(1, Math.floor(maxFragments))
  const candidateResult = getOpaqueTileCandidates(context, sprite.texture, safeFragmentSize)
  const focusedTiles = focusTileCandidates(
    candidateResult.tiles,
    sourcePoint,
    host,
    sprite,
    sprite.texture,
    safeMaxFragments
  )
  const candidates = pickCandidates(focusedTiles, safeMaxFragments, random)
  if (!candidates.length) return

  const fragments = createFragmentStates({
    host,
    sprite,
    texture: sprite.texture,
    bounds: candidateResult.bounds,
    candidates,
    durationMs,
    minSpeed,
    maxSpeed,
    upwardVelocity,
    settleToBottom,
    lockX,
    groundTargets,
    settleSpread,
    zIndexOffset,
    sourcePoint,
    random,
  })
  for (const fragment of fragments) layer.addChild(fragment.sprite)
  animateFragments(fragments, context.scheduler, Math.max(8, stepMs), gravity, settleStrength, groundBounce)
}
