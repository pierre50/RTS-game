import type { UnitEntity } from '../types/entities'
import type { Point } from '../types/grid'
import { isHeroToolAvailable, type HeroEquippedItem } from './heroToolEquipment'
import { getHeroAimDegree } from './heroTargeting'
import { performContextActionAt } from './HeroContextActions'
import {
  playEmptyHandWhiff,
  triggerInteractMeleeAt,
} from './HeroMeleeTools'
import { beginHeroPowerChargeAt } from './heroPowerCharge'

export {
  applyToolAppearance,
  EQUIPPED_ITEM_WEAPON,
  getEquippedItemWeapon,
  isHeroToolAvailable,
  type HeroEquippedItem,
  HERO_TOOL_ORDER,
} from './heroToolEquipment'
export {
  aimHeroDefenseAt,
  beginHeroDefense,
  cancelHeroDefense,
  releaseHeroDefense,
  updateHeroDefense,
} from './heroDefense'
export { findFacingEntity, getHeroAimDegree, isMountedAttackAimBlocked } from './heroTargeting'
export {
  aimHeroPowerChargeAt,
  cancelHeroLasso,
  cancelHeroPowerCharge,
  isHeroPowerChargeActiveForTool,
  releaseHeroPowerCharge,
  updateHeroPowerCharge,
} from './heroPowerCharge'

export function triggerToolAttackAt(
  hero: UnitEntity,
  tool: HeroEquippedItem | null,
  destination: Point
): boolean {
  if (!tool || hero.actionLocked) return false
  if (!isHeroToolAvailable(hero, tool)) return false
  hero.degree = getHeroAimDegree(hero, destination)
  if (tool === 'bow' || tool === 'lasso' || tool === 'sword') {
    return beginHeroPowerChargeAt(hero, destination, null, tool)
  }
  if (tool !== 'interact') return false
  const actionResult = performContextActionAt(hero)
  if (actionResult === 'triggered') return true
  const meleeResult = triggerInteractMeleeAt(hero)
  if (meleeResult === 'triggered') return true
  if (meleeResult === 'blocked') return false
  if (actionResult === 'miss') {
    return playEmptyHandWhiff(hero)
  }
  return false
}
