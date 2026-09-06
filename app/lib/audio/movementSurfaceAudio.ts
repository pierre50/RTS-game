import { CELL_HEIGHT, CELL_WIDTH, FAMILY_TYPES, RESOURCE_TYPES, SOUND_CUES } from '../constants'
import type { SoundDistanceProfileId } from '../../config/soundDistance'
import { isHeroControlled } from '../units/unitControl'
import { isUnitWalkSpeedFactor } from '../units/unitLocomotion'
import { getHeroDistanceSoundVolume, playSoundCue } from './sound'
import { getEntitySpaceGrid } from '../mapSpaces'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

type SurfaceAudioRule = {
  key: string
  resourceTypes?: Set<string>
  cellTypes?: Set<string>
  cue: string[]
  cooldownMs: number
  profile: SoundDistanceProfileId
}
type MovementSurfaceAudioOptions = {
  previousX?: number
  previousY?: number
}

const HERO_FOOTSTEP_COOLDOWN_MS = 330
const HERO_FOOTSTEP_VOLUME = 0.16
const UNIT_FOOTSTEP_COOLDOWN_MS = 360
const UNIT_FOOTSTEP_VOLUME = 0.11
const MOVEMENT_SURFACE_AUDIO_RULES: SurfaceAudioRule[] = [
  {
    key: 'bush-rustle',
    resourceTypes: new Set([
      RESOURCE_TYPES.wheat,
      RESOURCE_TYPES.berrybush,
      RESOURCE_TYPES.medicinalHerb,
      RESOURCE_TYPES.toxicHerb,
      RESOURCE_TYPES.fiberPlant,
    ]),
    cue: SOUND_CUES.surface.bushRustle,
    cooldownMs: 360,
    profile: 'surface',
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

function getDistanceVolume(rule: SurfaceAudioRule, unit: UnitEntity): number {
  return getHeroDistanceSoundVolume(unit, rule.profile, 1)
}

function getUnitFootstepVolume(unit: UnitEntity): number {
  if (!getHero(unit)) return 0
  return getHeroDistanceSoundVolume(unit, 'footstep', UNIT_FOOTSTEP_VOLUME)
}

function canPlayRule(unit: UnitEntity, rule: Pick<SurfaceAudioRule, 'cooldownMs' | 'key'>): boolean {
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

function isHeroFootstepAllowed(unit: UnitEntity): boolean {
  return Boolean(isHeroControlled(unit) && !unit.mountedOnHorse && unit.context?.controls?.shiftKeyActive !== true)
}

function getFootstepCue(unit: UnitEntity): string[] {
  switch (unit.currentCell?.type) {
    case 'Desert':
      return SOUND_CUES.hero.footstepStone
    case 'Dirt':
    case 'Snow':
      return SOUND_CUES.hero.footstepDirt
    default:
      return SOUND_CUES.hero.footstepGrass
  }
}

function playHeroFootstep(unit: UnitEntity): void {
  if (!isHeroFootstepAllowed(unit)) return
  if (!canPlayRule(unit, { key: 'hero-footstep', cooldownMs: HERO_FOOTSTEP_COOLDOWN_MS })) return
  playSoundCue(getFootstepCue(unit), { volume: HERO_FOOTSTEP_VOLUME })
}

function playUnitFootstep(unit: UnitEntity): void {
  if (isHeroControlled(unit) || unit.mountedOnHorse || !unit.visible) return
  if (isUnitWalkSpeedFactor(unit.requestedMoveSpeedFactor ?? 1)) return
  const volume = getUnitFootstepVolume(unit)
  if (volume <= 0) return
  if (!canPlayRule(unit, { key: 'unit-footstep', cooldownMs: UNIT_FOOTSTEP_COOLDOWN_MS })) return
  playSoundCue(getFootstepCue(unit), { volume })
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
  const grid = getEntitySpaceGrid(unit, unit.context?.map)
  if (!grid || !cell) return null
  const scanRadius = 1
  for (const rule of MOVEMENT_SURFACE_AUDIO_RULES) {
    if (rule.cellTypes?.has(cell.type)) return rule
    for (let i = cell.i - scanRadius; i <= cell.i + scanRadius; i++) {
      const row = grid[i]
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
  playHeroFootstep(unit)
  playUnitFootstep(unit)
  const rule = findContactingRule(unit, unit.currentCell, options)
  if (!rule) return
  const volume = getDistanceVolume(rule, unit)
  if (volume <= 0) return
  if (!canPlayRule(unit, rule)) return
  playSoundCue(rule.cue, { volume })
}
