import { BUILDING_TYPES, UNIT_TYPES } from '../constants'
import { getFreeLandCellAroundInstance } from '../lib'
import { isHeroControlled } from '../lib/units/unitControl'
import type { GameContextLike } from '../types/context'
import type { BuildingEntity, RuntimeEntity, UnitEntity, VillagerShelterReason } from '../types/entities'
import type { RuntimeCell } from '../types/map'

export const SHELTER_CHECK_INTERVAL_MS = 1000
export const DANGER_SHELTER_MIN_MS = 8000
const CRITICAL_SHELTER_HITPOINT_RATIO = 0.25
export const SHELTER_ORDER_GRACE_MS = 2500
export const SHELTER_MAX_RETRIES = 3

const SLEEP_START_HOUR = 18
const WAKE_HOUR = 6
const SHELTER_TYPES = new Set<string>([BUILDING_TYPES.house, BUILDING_TYPES.townCenter])

function distance(a: Pick<RuntimeEntity, 'i' | 'j'>, b: Pick<RuntimeEntity, 'i' | 'j'>): number {
  return Math.abs(a.i - b.i) + Math.abs(a.j - b.j)
}

function hitPointRatio(entity: Pick<RuntimeEntity, 'hitPoints' | 'totalHitPoints'>): number {
  const total = entity.totalHitPoints ?? 0
  if (total <= 0) return 1
  return Math.max(0, Math.min(1, (entity.hitPoints ?? total) / total))
}

export function isSleepTime(context: GameContextLike): boolean {
  const hour = context.dayNight?.state?.hour ?? 12
  return hour >= SLEEP_START_HOUR || hour < WAKE_HOUR
}

export function isWakeTime(context: GameContextLike): boolean {
  return !isSleepTime(context)
}

export function isUsableShelter(
  building: BuildingEntity | null | undefined,
  owner: UnitEntity['owner']
): building is BuildingEntity {
  return Boolean(
    building &&
      building.owner === owner &&
      SHELTER_TYPES.has(building.type) &&
      building.isBuilt &&
      !building.isDead &&
      !building.isDestroyed
  )
}

export function isShelterUnsafe(building: BuildingEntity | null | undefined): boolean {
  return Boolean(
    !building ||
      !isUsableShelter(building, building.owner) ||
      hitPointRatio(building) <= CRITICAL_SHELTER_HITPOINT_RATIO
  )
}

export function getShelterEntryCell(unit: UnitEntity, shelter: BuildingEntity): RuntimeCell | null {
  const map = unit.context?.map
  if (!map) return null
  return getFreeLandCellAroundInstance(shelter, map.grid, (items: RuntimeCell[]) => {
    let best: RuntimeCell | null = null
    let bestDistance = Infinity
    for (const cell of items) {
      const dist = Math.abs(cell.i - unit.i) + Math.abs(cell.j - unit.j)
      if (dist < bestDistance) {
        best = cell
        bestDistance = dist
      }
    }
    return best ?? items[0]
  })
}

function getShelterScore(unit: UnitEntity, building: BuildingEntity, reason: VillagerShelterReason): number {
  const townCenterBias = reason === 'danger' && building.type === BUILDING_TYPES.townCenter ? -1000 : 0
  return distance(unit, building) + townCenterBias
}

export function getNearestShelter(
  unit: UnitEntity,
  reason: VillagerShelterReason
): { shelter: BuildingEntity; targetCell: RuntimeCell } | null {
  let best: { shelter: BuildingEntity; targetCell: RuntimeCell; score: number } | null = null
  for (const building of unit.owner?.buildings ?? []) {
    if (!isUsableShelter(building, unit.owner)) continue
    if (hitPointRatio(building) <= CRITICAL_SHELTER_HITPOINT_RATIO) continue
    const targetCell = getShelterEntryCell(unit, building)
    if (!targetCell) continue
    const score = getShelterScore(unit, building, reason)
    if (!best || score < best.score) best = { shelter: building, targetCell, score }
  }
  return best
}

export function shouldShelter(unit: UnitEntity): boolean {
  return Boolean(
    unit.type === UNIT_TYPES.villager &&
      !unit.isDead &&
      !unit.isDestroyed &&
      !isHeroControlled(unit) &&
      unit.controlMode !== 'hero' &&
      !unit.trainingTargetType
  )
}

export function isViolentVillagerThreat(unit: UnitEntity, attacker: RuntimeEntity | null | undefined): boolean {
  if (!attacker || attacker.isDead || attacker.isDestroyed) return false
  if (!shouldShelter(unit)) return false
  if (attacker.family === 'animal') return hitPointRatio(unit) <= 0.35
  return Boolean(attacker.owner && unit.owner?.isEnemy?.(attacker.owner))
}
