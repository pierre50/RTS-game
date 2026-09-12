import type { UnitEntity } from '../../types/entities'

export function notifyHeroHealthChanged(unit: UnitEntity): void {
  if (unit.context?.controls?.heroUnit === unit) {
    unit.context?.menu?.updateHeroStatus?.(unit)
  }
}
