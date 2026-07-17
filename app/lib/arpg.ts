import type { UnitEntity } from '../types/entities'
import { isHeroControlled } from './unitControl'

export function isArpgHero(unit: UnitEntity): boolean {
  return isHeroControlled(unit)
}
