import { t } from './lang'
import {
  drainEnergyAmount,
  ensureUnitEnergy,
  getActionEnergyCost,
  spendEnergyForAction,
} from './unitEnergy'
import type { UnitEntity } from '../types/entities'

export type RememberTimedEnergyAt = (now: number) => void

export function spendHeroEnergy(hero: UnitEntity, action: string): boolean {
  if (spendEnergyForAction(hero, action)) return true
  if (hero.owner?.isPlayed) {
    hero.context?.menu?.showMessage(t('heroNotEnoughEnergy'), 'warning')
  }
  return false
}

export function hasEnergyToStartTimedHeroAction(hero: UnitEntity, action: string): boolean {
  ensureUnitEnergy(hero)
  if (getActionEnergyCost(hero, action) <= 0) return true
  if ((hero.energy ?? 0) > 0) return true
  if (hero.owner?.isPlayed) hero.context?.menu?.showMessage(t('heroNotEnoughEnergy'), 'warning')
  return false
}

export function drainTimedHeroEnergy(
  hero: UnitEntity,
  action: string,
  startAt: number | null | undefined,
  lastAt: number | null | undefined,
  rememberLastAt: RememberTimedEnergyAt,
  durationMs: number,
  now = performance.now()
): boolean {
  if (startAt == null) return true
  const totalCost = getActionEnergyCost(hero, action)
  if (totalCost <= 0) return true
  const previous = lastAt ?? startAt
  const elapsed = Math.max(0, now - previous)
  rememberLastAt(now)
  if (elapsed <= 0) return true
  return drainEnergyAmount(hero, (totalCost * elapsed) / durationMs)
}
