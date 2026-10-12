import { consumeHeroEquippedItem } from '../../equipment/equipmentLoot'
import { isSlingshot } from '../../equipment/rangedWeapon'
import { getRangedWeapon, hasRangedAmmunition } from './rangedAmmunition'
import { arrowProjectileType, consumeNpcArrow } from './unitArrows'
import type { UnitEntity } from '../../../types/entities'

/** Check again at release, consume one real item, and return its projectile type. */
export function consumeRangedAmmunition(unit: UnitEntity): string | null {
  if (!hasRangedAmmunition(unit)) return null
  if (isSlingshot(getRangedWeapon(unit))) {
    unit.inventory!.resources!.stone! -= 1
    return 'Pebble'
  }
  if (unit.type === 'Hero' || unit.controlMode === 'hero') {
    const arrow = unit.inventory?.equipped?.arrow
    if (!arrow) return null
    consumeHeroEquippedItem(unit, 'arrow')
    return arrowProjectileType(arrow)
  }
  const arrow = consumeNpcArrow(unit)
  return arrow ? arrowProjectileType(arrow) : null
}
