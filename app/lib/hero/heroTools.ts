import type { UnitEntity } from '../../types/entities'
import type { Point } from '../../types/grid'
import { isHeroToolAvailable, type HeroEquippedItem } from './heroToolEquipment'
import { getHeroAimDegree } from './heroTargeting'
import { performContextActionAt } from './heroContextActions'
import { playEmptyHandWhiff, triggerInteractMeleeAt } from './heroMeleeTools'
import { cancelHeroDefense } from './heroDefense'
import { beginHeroPowerChargeAt, cancelHeroPowerCharge } from './heroPowerCharge'
import { finishHeroToolAnimation } from './heroToolAnimation'

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
  canHeroDefendWithTool,
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

export function triggerToolAttackAt(hero: UnitEntity, tool: HeroEquippedItem | null, destination: Point): boolean {
  if (!tool || hero.actionLocked) return false
  if (!isHeroToolAvailable(hero, tool)) return false
  hero.degree = getHeroAimDegree(hero, destination)
  if (tool === 'bow' || tool === 'lasso' || tool === 'sword') {
    const triggered = beginHeroPowerChargeAt(hero, destination, null, tool)
    if (!triggered) return false
    hero.followAssistIntent = null
    return true
  }
  hero.followAssistIntent = null
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

export function cancelHeroActiveToolAction(hero: UnitEntity): boolean {
  if (
    hero.heroDefenseActive ||
    hero.heroDefenseReverseTaskId != null ||
    hero.heroDefenseReleaseFallbackTaskId != null
  ) {
    cancelHeroDefense(hero)
    return true
  }
  if (hero.heroPowerChargeStart != null) {
    cancelHeroPowerCharge(hero)
    return true
  }
  if (!hero.actionLocked) return false
  finishHeroToolAnimation(hero)
  return true
}
