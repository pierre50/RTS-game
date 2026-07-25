import { STEP_TIME } from '../constants'
import { showHealingFeedback } from './combatFeedback'
import { isHeroControlled } from './unitControl'
import type { UnitEntity } from '../types/entities'

export const DEFAULT_HERO_HEALTH_REGEN_PER_SECOND = 1
export const DEFAULT_HERO_HEALTH_REGEN_DELAY_MS = 2500

function notifyHeroHealthChanged(unit: UnitEntity): void {
  const controls = unit.context?.controls
  if (controls?.heroUnit === unit) {
    unit.context?.menu?.updateHeroStatus?.(unit)
  }
}

export function ensureUnitHealthRegen(unit: UnitEntity): void {
  if (!isHeroControlled(unit)) return
  unit.healthRegenRate = Math.max(0, unit.healthRegenRate ?? DEFAULT_HERO_HEALTH_REGEN_PER_SECOND)
  unit.healthRegenDelay = Math.max(0, unit.healthRegenDelay ?? DEFAULT_HERO_HEALTH_REGEN_DELAY_MS)
  unit.healthRegenMultiplier = Math.max(0, unit.healthRegenMultiplier ?? 1)
}

export function markUnitHealthDamaged(unit: UnitEntity): void {
  if (!isHeroControlled(unit)) return
  unit.lastHealthDamagedAt = unit.context?.scheduler?.elapsedMs ?? 0
  notifyHeroHealthChanged(unit)
}

export function updateUnitHealthRegen(unit: UnitEntity, elapsedMs = STEP_TIME): void {
  ensureUnitHealthRegen(unit)
  if (!isHeroControlled(unit)) return
  const totalHitPoints = Math.max(0, unit.totalHitPoints ?? 0)
  if (totalHitPoints <= 0 || unit.isDead || unit.isDestroyed) return
  const currentHitPoints = Math.max(0, unit.hitPoints ?? totalHitPoints)
  if (currentHitPoints >= totalHitPoints) {
    if (unit.hitPoints !== totalHitPoints) {
      unit.hitPoints = totalHitPoints
      notifyHeroHealthChanged(unit)
    }
    return
  }
  const now = unit.context?.scheduler?.elapsedMs ?? 0
  const damagedAt = unit.lastHealthDamagedAt ?? -Infinity
  if (now - damagedAt < (unit.healthRegenDelay ?? 0)) return
  const regenPerMs = ((unit.healthRegenRate ?? 0) * (unit.healthRegenMultiplier ?? 1)) / 1000
  unit.hitPoints = Math.min(totalHitPoints, currentHitPoints + regenPerMs * elapsedMs)
  if (unit.hitPoints !== currentHitPoints) {
    showHealingFeedback(unit)
    notifyHeroHealthChanged(unit)
  }
}
