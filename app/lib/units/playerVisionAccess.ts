import { heroCanCommand } from '../chief'
import type { UnitEntity } from '../../types/entities'

export function usesPersonalVision(context?: { controls?: { heroUnit?: UnitEntity | null } | null }): boolean {
  const hero = context?.controls?.heroUnit
  return Boolean(hero && !heroCanCommand(hero))
}

/** During boot, an uninitialized player must not reveal the village before the hero exists. */
export function ownerSharesVision(owner: { isPlayed?: boolean; units?: UnitEntity[] } | null | undefined,
  context?: { controls?: { heroUnit?: UnitEntity | null } | null }): boolean {
  if (!owner?.isPlayed) return true
  const hero = context?.controls?.heroUnit ?? owner.units?.find(unit => unit.type === 'Hero')
  return heroCanCommand(hero)
}
