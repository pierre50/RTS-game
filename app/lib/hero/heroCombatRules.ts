import { getEquippedWorkTool } from '../equipment/workTools'
import type { UnitEntity } from '../../types/entities'
import type { HeroEquippedItem } from './heroToolEquipment'

export const HERO_POWER_CHARGE_MS = 700

export function getHeroSwordChargeDamageMultiplier(power: number): number {
  return 1 + Math.max(0, Math.min(1, power)) * 0.5
}

export function canHeroDefendWithTool(tool: HeroEquippedItem | null | undefined, hero?: UnitEntity | null): boolean {
  return tool === 'sword' || (tool === 'interact' && Boolean(getEquippedWorkTool(hero)))
}
