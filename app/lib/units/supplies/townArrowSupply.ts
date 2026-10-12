import { canForgeProduce } from '../../equipment/forgeProduction'
import { observeEconomyChange, recordEconomyFlow } from '../../economy/economyTelemetry'
import { ARROW_BATCH_SIZE, ARROW_RECIPES } from '../../equipment/arrowRecipes'
import { townSupplies, storeTownEquipment } from './townSupplies'
import {
  getPlayerResourceTotals,
  getMissingPlayerResources,
  withdrawChestResources,
} from '../../resources/playerResourceTotals'
import { getUnitResourceCarryRemaining } from '../../resources/resourceDelivery'
import type { UnitEntity } from '../../../types/entities'
import type { PlayerLike } from '../../../types/player'
import type { SaveEntityState, SavePlayerState } from '../../../types/save'
import { npcArrowCapacity } from '../combat/unitArrows'

/** Local, paid supplies. Preview is read-only so target selection cannot consume materials. */
export function supplyTownArrows(
  unit: UnitEntity | SaveEntityState,
  owner: PlayerLike | SavePlayerState | null | undefined = (unit as UnitEntity).owner,
  options: { hunting?: boolean; preview?: boolean } = {}
): number {
  const live = unit as UnitEntity & { isFleeing?: boolean }
  const capacity = npcArrowCapacity(unit)
  if (
    !owner ||
    !capacity ||
    unit.isDead ||
    unit.isDestroyed ||
    unit.inventory?.toolsStowed ||
    live.isFleeing ||
    live.campBehavior?.phase === 'pursue' ||
    (unit.type === 'Villager' && !options.hunting) ||
    (live.combatMode === 'recover' && live.waitingForEnergyAction === 'attack') ||
    (live.combatMode === 'flee' && unit.dest) ||
    live.spacePortalState?.combatTarget ||
    ['attack', 'flee', 'hunt', 'train'].includes(unit.action ?? '')
  )
    return 0
  const missing = capacity - (unit.inventory?.equipment?.filter(item => item.startsWith('arrow_')).length ?? 0)
  const amount = Math.min(missing, getUnitResourceCarryRemaining(live))
  if (amount <= 0) return 0
  const supplies = townSupplies(unit, owner)
  if (!supplies) return 0
  const { ledger, payment, forge, stores, depot } = supplies
  // Hunters use stone; soldiers follow the best material already present in their equipment.
  const gear = [...(unit.inventory?.equipment ?? []), ...Object.values(unit.inventory?.equipped ?? {})]
  const tier =
    unit.type === 'Villager'
      ? 0
      : gear.some(item => /_iron(?:_|~|$)/.test(item))
        ? 2
        : gear.some(item => /_bronze(?:_|~|$)/.test(item))
          ? 1
          : 0
  const recipes = ARROW_RECIPES.slice(0, tier + 1).reverse()
  const availableStock = () =>
    recipes
      .flatMap(recipe =>
        stores.map(store => ({ recipe, store, index: store.inventory?.equipment?.indexOf(recipe.item) ?? -1 }))
      )
      .find(entry => entry.index >= 0)
  const craftableRecipe = () =>
    recipes.find(
      recipe =>
        (recipe.item === 'arrow_ceramic' || forge) &&
        canForgeProduce(recipe, forge) &&
        Object.keys(getMissingPlayerResources(ledger, recipe.cost, payment)).length === 0
    )
  if (options.preview) {
    const stock = stores.reduce(
      (sum, store) =>
        sum + (store.inventory?.equipment?.filter(item => recipes.some(recipe => recipe.item === item)).length ?? 0),
      0
    )
    return Math.min(amount, stock + (craftableRecipe() ? ARROW_BATCH_SIZE : 0))
  }
  let supplied = 0
  while (supplied < amount) {
    let stock = availableStock()
    if (!stock) {
      const recipe = craftableRecipe()
      if (
        !recipe ||
        !observeEconomyChange(
          owner,
          'craftConsumed',
          () => getPlayerResourceTotals(ledger, payment),
          'removed',
          () => withdrawChestResources(ledger, recipe.cost, payment)
        )
      )
        break
      recordEconomyFlow(owner, 'craftProduced', { ['item:' + recipe.item]: ARROW_BATCH_SIZE })
      storeTownEquipment(depot, recipe.item, ARROW_BATCH_SIZE)
      stock = availableStock()!
    }
    const item = stock.store.inventory!.equipment!.splice(stock.index, 1)[0]!
    unit.inventory ??= {}
    unit.inventory.equipment ??= []
    unit.inventory.equipment.push(item)
    // Receiving real supplies must not trigger a fresh spawn allowance on a later load.
    unit.inventory.npcArrows ??= { initialized: true }
    supplied++
  }
  return supplied
}
