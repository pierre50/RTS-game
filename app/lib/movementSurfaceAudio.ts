import { CELL_HEIGHT, CELL_WIDTH, FAMILY_TYPES, RESOURCE_TYPES, SOUND_CUES } from '../constants'
import { isHeroControlled } from './unitControl'
import { playSoundCue } from './sound'
import type { RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'

type SurfaceAudioRule = {
  key: string
  resourceTypes?: Set<string>
  cellTypes?: Set<string>
  cue: string[]
  cooldownMs: number
  maxDistance: number
  minVolume: number
  volume: number
}
type MovementSurfaceAudioOptions = {
  previousX?: number
  previousY?: number
}

const MOVEMENT_SURFACE_AUDIO_RULES: SurfaceAudioRule[] = [
  {
    key: 'bush-rustle',
    resourceTypes: new Set([RESOURCE_TYPES.wheat, RESOURCE_TYPES.berrybush]),
    cue: SOUND_CUES.surface.bushRustle,
    cooldownMs: 360,
    maxDistance: 620,
    minVolume: 0.06,
    volume: 0.58,
  },
]

const lastPlayedAtByUnit = new WeakMap<object, Map<string, number>>()
const RESOURCE_CONTACT_MARGIN = 0.28
const RESOURCE_DIRECTION_DOT_MIN = 0.18

function getNow(unit: UnitEntity): number {
  return unit.context?.scheduler?.elapsedMs ?? performance.now()
}

function getHero(unit: UnitEntity): UnitEntity | null {
  return unit.context?.controls?.heroUnit ?? null
}

function getListenerDistance(unit: UnitEntity): number {
  const hero = getHero(unit)
  if (!hero || hero === unit) return 0
  return Math.hypot((unit.x ?? 0) - (hero.x ?? 0), (unit.y ?? 0) - (hero.y ?? 0))
}

function getDistanceVolume(rule: SurfaceAudioRule, unit: UnitEntity): number {
  const distance = getListenerDistance(unit)
  if (distance >= rule.maxDistance) return 0
  const ratio = Math.max(0, Math.min(1, 1 - distance / rule.maxDistance))
  const faded = rule.minVolume + (rule.volume - rule.minVolume) * ratio * ratio
  return Math.max(0, Math.min(1, faded))
}

function canPlayRule(unit: UnitEntity, rule: SurfaceAudioRule): boolean {
  const now = getNow(unit)
  let lastPlayedAt = lastPlayedAtByUnit.get(unit)
  if (!lastPlayedAt) {
    lastPlayedAt = new Map()
    lastPlayedAtByUnit.set(unit, lastPlayedAt)
  }
  const previous = lastPlayedAt.get(rule.key) ?? -Infinity
  if (now - previous < rule.cooldownMs) return false
  lastPlayedAt.set(rule.key, now)
  return true
}

function isAudibleMover(unit: UnitEntity): boolean {
  return Boolean(isHeroControlled(unit) || unit.visible)
}

function getResourceNormalizedDistance(point: { x?: number; y?: number }, entity: RuntimeEntity): number {
  const halfWidth = (CELL_WIDTH * Math.max(1, entity.size ?? 1)) / 2
  const halfHeight = (CELL_HEIGHT * Math.max(1, entity.size ?? 1)) / 2
  return Math.abs((point.x ?? 0) - (entity.x ?? 0)) / halfWidth + Math.abs((point.y ?? 0) - (entity.y ?? 0)) / halfHeight
}

function isMovingTowardResource(unit: UnitEntity, entity: RuntimeEntity, options: MovementSurfaceAudioOptions): boolean {
  if (options.previousX == null || options.previousY == null) return false
  const moveX = (unit.x ?? 0) - options.previousX
  const moveY = (unit.y ?? 0) - options.previousY
  const moveLength = Math.hypot(moveX, moveY)
  if (moveLength <= 0.01) return false
  const toResourceX = (entity.x ?? 0) - options.previousX
  const toResourceY = (entity.y ?? 0) - options.previousY
  const toResourceLength = Math.hypot(toResourceX, toResourceY)
  if (toResourceLength <= 0.01) return true
  return (moveX * toResourceX + moveY * toResourceY) / (moveLength * toResourceLength) >= RESOURCE_DIRECTION_DOT_MIN
}

function isResourceContact(
  unit: UnitEntity,
  entity: RuntimeEntity,
  rule: SurfaceAudioRule,
  options: MovementSurfaceAudioOptions
): boolean {
  if (entity === unit || entity.isDestroyed || entity.family !== FAMILY_TYPES.resource) return false
  if (!rule.resourceTypes?.has(entity.type)) return false
  const normalizedDistance = getResourceNormalizedDistance(unit, entity)
  if (normalizedDistance <= 1) return true
  if (normalizedDistance > 1 + RESOURCE_CONTACT_MARGIN) return false
  const previousDistance =
    options.previousX == null || options.previousY == null
      ? Infinity
      : getResourceNormalizedDistance({ x: options.previousX, y: options.previousY }, entity)
  if (previousDistance < normalizedDistance) return false
  if (previousDistance <= 1) return true
  return isMovingTowardResource(unit, entity, options)
}

function findContactingRule(
  unit: UnitEntity,
  cell: RuntimeCell | null | undefined,
  options: MovementSurfaceAudioOptions
): SurfaceAudioRule | null {
  const map = unit.context?.map
  if (!map || !cell) return null
  const scanRadius = 1
  for (const rule of MOVEMENT_SURFACE_AUDIO_RULES) {
    if (rule.cellTypes?.has(cell.type)) return rule
    for (let i = cell.i - scanRadius; i <= cell.i + scanRadius; i++) {
      const row = map.grid[i]
      if (!row) continue
      for (let j = cell.j - scanRadius; j <= cell.j + scanRadius; j++) {
        const entity = row[j]?.has
        if (entity && isResourceContact(unit, entity, rule, options)) return rule
      }
    }
  }
  return null
}

export function playMovementSurfaceAudio(
  unit: UnitEntity,
  movedDistance: number,
  options: MovementSurfaceAudioOptions = {}
): void {
  if (movedDistance <= 0.01 || !isAudibleMover(unit)) return
  const rule = findContactingRule(unit, unit.currentCell, options)
  if (!rule) return
  const volume = getDistanceVolume(rule, unit)
  if (volume <= 0) return
  if (!canPlayRule(unit, rule)) return
  playSoundCue(rule.cue, { volume })
}
