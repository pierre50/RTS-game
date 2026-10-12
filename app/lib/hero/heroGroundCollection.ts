import { FAMILY_TYPES, RESOURCE_TYPES } from '../../constants/entities'
import { getUnitResourceCapacityRemaining } from '../resources/resourceDelivery'
import { recordEconomyFlow } from '../economy/economyTelemetry'
import { notifyVillageWorkChanged } from '../units/village/villageWorkEvents'
import { t } from '../lang'
import { isHeroInteractionTargetReachable } from './heroActionRange'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'

export function isCollectableGroundResource(
  target: RuntimeEntity | null | undefined
): target is RuntimeEntity & { type: 'GroundWood' | 'GroundStone' } {
  return Boolean(
    target &&
      target.family === FAMILY_TYPES.resource &&
      [RESOURCE_TYPES.groundWood, RESOURCE_TYPES.groundStone].includes(target.type) &&
      !target.isDead &&
      !target.isDestroyed &&
      (target.quantity ?? 0) > 0
  )
}

/** Collect immediately without changing the equipped appearance or interrupting movement. */
export function collectGroundResource(hero: UnitEntity | null, target: RuntimeEntity): boolean {
  if (
    !hero ||
    hero.isDead ||
    hero.isDestroyed ||
    hero.actionLocked ||
    !isCollectableGroundResource(target) ||
    !isHeroInteractionTargetReachable(hero, null, target)
  )
    return false
  if (!target.die) return false
  const resource = target.type === RESOURCE_TYPES.groundWood ? 'wood' : 'stone'
  const hasRoom = () => getUnitResourceCapacityRemaining(hero, resource) >= 1
  const full = () => {
    if (hero.context?.controls?.heroUnit === hero || hero.type !== 'Villager')
      hero.context?.menu?.showMessage(t('heroBagFull'), 'warning')
  }
  if (!hasRoom()) {
    full()
    return false
  }
  hero.inventory ??= {}
  hero.inventory.resources ??= {}
  hero.inventory.resources[resource] = (hero.inventory.resources[resource] ?? 0) + 1
  target.quantity = Math.max(0, (target.quantity ?? 0) - 1)
  if (target.quantity === 0) target.die(true)
  notifyVillageWorkChanged(hero.owner)
  recordEconomyFlow(hero, 'gathered', { [resource]: 1 })
  hero.context?.menu?.updateTopbar?.()
  hero.context?.menu?.refreshInventory?.()
  return true
}
