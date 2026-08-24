import { CELL_HEIGHT, CELL_WIDTH, SHEET_TYPES, SOUND_CUES } from '../constants'
import { HeroLassoThrow } from '../classes/HeroLassoThrow'
import { consumeHeroEquippedItem } from './equipmentLoot'
import { getUnitCombatRange } from './equipmentStats'
import { BOW_SHOOT_RELEASE_FRAME, LASSO_SHOOT_RELEASE_FRAME } from './graphics'
import { t } from './lang'
import { degreeToDirection, getReliefOffset } from './maths'
import { playSoundCue } from './sound'
import { debugLog } from './debug'
import type { UnitEntity } from '../types/entities'
import type { Point } from '../types/grid'

const HERO_BOW_RANGE_DEBUG = false
const HERO_BOW_MIN_POWER = 0.2
const HERO_SWORD_CHARGE_HOLD_FRAME = 0
const HERO_ARROW_FORWARD_OFFSET = 16
const HERO_ARROW_HEIGHT_OFFSET = 18
const HERO_ARROW_DIRECTION_OFFSETS: Record<string, Partial<Point>> = {
  east: { y: -8 },
  south: { x: 4 },
  west: { y: 8 },
  north: { x: -4 },
  northwest: { y: 4 },
  southwest: { y: 4 },
}
const HERO_ARROW_CELL_DISTANCE = Math.hypot(CELL_WIDTH, CELL_HEIGHT)

function getHeroBowRange(hero: UnitEntity): number {
  return getUnitCombatRange(hero) ?? 0
}

export function getHeroMaxArrowDistance(hero: UnitEntity, power = 1): number {
  const rangePower = Math.max(HERO_BOW_MIN_POWER, Math.min(1, power))
  const baseRange = getHeroBowRange(hero)
  const maxDistance = baseRange * HERO_ARROW_CELL_DISTANCE * rangePower
  debugLog(HERO_BOW_RANGE_DEBUG, '[hero-bow-range]', {
    unitLabel: hero.label,
    work: hero.work,
    ownerAge: hero.owner?.age ?? 0,
    baseRange,
    rangePower: Number(rangePower.toFixed(2)),
    maxDistance: Number(maxDistance.toFixed(2)),
  })
  return maxDistance
}

export function getHeroShootReleaseFrame(tool: 'bow' | 'lasso' | null | undefined): number {
  return tool === 'lasso' ? LASSO_SHOOT_RELEASE_FRAME : BOW_SHOOT_RELEASE_FRAME
}

function getHeroShootHoldFrame(tool: 'bow' | 'lasso' | null | undefined): number {
  return tool === 'lasso' ? Math.max(0, LASSO_SHOOT_RELEASE_FRAME - 1) : BOW_SHOOT_RELEASE_FRAME
}

export function getHeroPowerChargeHoldFrame(tool: 'bow' | 'lasso' | 'sword' | null | undefined): number {
  return tool === 'sword' ? HERO_SWORD_CHARGE_HOLD_FRAME : getHeroShootHoldFrame(tool)
}

export function hideReleasedBowArrowLayer(hero: UnitEntity, sprite: UnitEntity['sprite']): void {
  if (!sprite || sprite.currentFrame < BOW_SHOOT_RELEASE_FRAME) return
  const nextFrame = Math.min(Math.floor(sprite.currentFrame) + 1, Math.max(0, sprite.textures.length - 1))
  sprite.gotoAndStop?.(nextFrame)
  hero.syncAppearanceLayers?.(SHEET_TYPES.action)
}

export function hasHeroEquippedArrow(hero: UnitEntity): boolean {
  return Boolean(hero.inventory?.equipped?.arrow)
}

export function warnHeroNoArrowEquipped(hero: UnitEntity): void {
  if (hero.owner?.isPlayed) hero.context?.menu?.showMessage(t('heroNoArrowsEquipped'), 'warning')
}

export function consumeHeroArrow(hero: UnitEntity): void {
  consumeHeroEquippedItem(hero, 'arrow')
  hero.context?.menu?.refreshInventory?.()
}

function getHeroArrowVisualY(hero: UnitEntity): number {
  const mountedRiderY = hero.getMountedRiderY?.()
  return typeof mountedRiderY === 'number' && Number.isFinite(mountedRiderY) ? mountedRiderY : getReliefOffset(hero)
}

export function getHeroArrowSpawnPoint(hero: UnitEntity): Point {
  const rad = ((hero.degree ?? 0) - 180) * (Math.PI / 180)
  const direction = degreeToDirection(hero.degree ?? 0)
  const directionOffset = direction ? (HERO_ARROW_DIRECTION_OFFSETS[direction] ?? {}) : {}
  return {
    x: hero.x + Math.cos(rad) * HERO_ARROW_FORWARD_OFFSET + (directionOffset.x ?? 0),
    y: hero.y + getHeroArrowVisualY(hero) - HERO_ARROW_HEIGHT_OFFSET + (directionOffset.y ?? 0),
  }
}

export function throwLassoAt(hero: UnitEntity, destination: Point, power = 1): void {
  const map = hero.context?.map
  if (!map || !hero.context) return
  const rangePower = Math.max(HERO_BOW_MIN_POWER, Math.min(1, power))
  const origin = getHeroArrowSpawnPoint(hero)
  const maxDestination = {
    x: origin.x + (destination.x - origin.x) * rangePower,
    y: origin.y + (destination.y - origin.y) * rangePower,
  }
  playSoundCue(SOUND_CUES.projectile.arrowLaunch)
  const lasso = new HeroLassoThrow(hero, maxDestination, hero.context)
  map.addChild(lasso)
}
