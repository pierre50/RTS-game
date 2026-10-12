import type { UnitEntity } from '../../types/entities'
import type { Point } from '../../types/grid'
import { getHeroPowerChargeToolForEquippedItem, isHeroToolAvailable, type HeroEquippedItem } from './heroToolEquipment'
import { getHeroAimDegree } from './heroTargeting'
import { performContextActionAt } from './heroContextActions'
import { playEmptyHandWhiff, triggerInteractMeleeAt } from './heroMeleeTools'
import { cancelHeroDefense } from './heroDefense'
import {
  aimHeroPowerChargeAt,
  beginHeroPowerChargeAt,
  cancelHeroPowerCharge,
  releaseHeroPowerCharge,
} from './heroPowerCharge'
import { finishHeroToolAnimation } from './heroToolAnimation'
import { getEquippedWorkTool } from '../equipment/workTools'

export { triggerSwordAttackAt } from './heroMeleeTools'

export {
  applyToolAppearance,
  getEquippedItemWeapon,
  isHeroCatchingPoleEquipped,
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
  cancelHeroCatchingPole,
  cancelHeroPowerCharge,
  isHeroPowerChargeActiveForTool,
  releaseHeroPowerCharge,
  updateHeroPowerCharge,
} from './heroPowerCharge'

export function triggerToolAttackAt(
  hero: UnitEntity,
  tool: HeroEquippedItem | null,
  destination: Point,
  repeat = false
): boolean {
  if (hero.actionLocked) return false
  tool ??= 'interact'
  if (!isHeroToolAvailable(hero, tool)) return false
  hero.degree = getHeroAimDegree(hero, destination)
  const powerChargeTool = getHeroPowerChargeToolForEquippedItem(hero, tool)
  if (powerChargeTool) {
    const triggered = beginHeroPowerChargeAt(hero, destination, null, powerChargeTool)
    if (!triggered) return false
    hero.followAssistIntent = null
    return true
  }
  hero.followAssistIntent = null
  if (tool !== 'interact') return false
  const actionResult = performContextActionAt(hero, destination)
  if (actionResult === 'triggered') return true
  // A held work gesture must never turn into a combat gesture when its target disappears.
  if (repeat) return false
  const equippedTool = getEquippedWorkTool(hero)
  if (equippedTool) {
    return beginHeroPowerChargeAt(hero, destination, null, 'tool')
  }
  const meleeResult = triggerInteractMeleeAt(hero)
  if (meleeResult === 'triggered') return true
  if (meleeResult === 'blocked') return false
  if (actionResult === 'miss') {
    return playEmptyHandWhiff(hero)
  }
  return false
}

export function releaseHeroToolStrike(hero: UnitEntity, destination: Point): boolean {
  if (hero.heroPowerChargeTool !== 'tool') return false
  aimHeroPowerChargeAt(hero, destination)
  return releaseHeroPowerCharge(hero)
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
