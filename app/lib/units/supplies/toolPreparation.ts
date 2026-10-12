import { HERO_CRAFT_RECIPES } from '../../hero/heroCraftRecipes'
import { isEquipmentBroken } from '../../equipment/equipmentCondition'
import { workToolFamily, type WorkToolFamily } from '../../equipment/workTools'
import { hasConstructionWork, remainingConstructionMaterials } from '../../economy/constructionMaterials'
import { VILLAGE_ACTIVITY_RADIUS } from '../../../config/villageActivity'
import type { CollectiveMember, Owner, Point } from '../../economy/collectiveConstruction'
import type { ResourceAmount } from '../../../types/common'

export function toolActivityAnchor(unit: CollectiveMember, owner?: Owner | null): Point {
  if (unit.villageHome) return unit.villageHome
  if (unit.collectiveHome) return unit.collectiveHome
  return (
    owner?.buildings
      ?.filter(
        site =>
          !site.isDead &&
          !site.isDestroyed &&
          site.isBuilt &&
          ['FireCamp', 'TownCenter'].includes(site.type) &&
          (site.spaceId ?? 'outside') === (unit.spaceId ?? 'outside') &&
          Math.hypot(site.i - unit.i, site.j - unit.j) <= VILLAGE_ACTIVITY_RADIUS
      )
      .sort((a, b) => Math.hypot(a.i - unit.i, a.j - unit.j) - Math.hypot(b.i - unit.i, b.j - unit.j))[0] ?? unit
  )
}

export function ownsUsableTool(unit: Pick<CollectiveMember, 'inventory'>, family: WorkToolFamily): boolean {
  return [unit.inventory?.activeWeapons?.tool, ...(unit.inventory?.equipment ?? [])].some(
    item => workToolFamily(item) === family && !isEquipmentBroken(item!)
  )
}

/** A bounded dependency list: production tools first, construction tool last. Never a full loadout. */
export function constructionToolPreparation(unit: CollectiveMember, owner?: Owner | null) {
  if (
    !owner ||
    unit.type !== 'Villager' ||
    unit.controlMode === 'hero' ||
    unit.followingHero ||
    unit.isDead ||
    unit.isDestroyed ||
    unit.inventory?.toolsStowed
  )
    return undefined
  const anchor = toolActivityAnchor(unit, owner)
  const local = (site: Point) =>
    (site.spaceId ?? 'outside') === (anchor.spaceId ?? 'outside') &&
    Math.hypot(site.i - anchor.i, site.j - anchor.j) <= VILLAGE_ACTIVITY_RADIUS
  const site = owner.buildings?.find(site => hasConstructionWork(site) && local(site))
  if (!site) return undefined
  const remaining = remainingConstructionMaterials(site)
  const stock: ResourceAmount = { ...unit.inventory?.resources }
  for (const store of owner.buildings ?? []) {
    if (
      !store.isBuilt ||
      store.isDead ||
      store.isDestroyed ||
      !local(store) ||
      !['TownCenter', 'StoragePit'].includes(store.type)
    )
      continue
    for (const key of ['wood', 'stone'] as const)
      stock[key] = (stock[key] ?? 0) + (store.inventory?.resources?.[key] ?? 0)
  }
  const hammer = ownsUsableTool(unit, 'hammer')
  const hammerCost = hammer ? {} : HERO_CRAFT_RECIPES.find(recipe => recipe.outputEquipment === 'hammer_ceramic')!.cost
  const needed: WorkToolFamily[] = []
  // Reserve production capacity for both the site and the tools needed to build it.
  for (const [material, family] of [
    ['wood', 'axe'],
    ['stone', 'pickaxe'],
  ] as const)
    if (
      !ownsUsableTool(unit, family) &&
      (remaining[material] ?? 0) + (hammerCost[material] ?? 0) > (stock[material] ?? 0)
    )
      needed.push(family)
  if (!hammer) needed.push('hammer')
  const reserve: ResourceAmount = {}
  for (const family of needed) {
    const recipe = HERO_CRAFT_RECIPES.find(recipe => recipe.outputEquipment === `${family}_ceramic`)!
    for (const key of ['wood', 'stone'] as const) reserve[key] = (reserve[key] ?? 0) + (recipe.cost[key] ?? 0)
  }
  return needed.length ? { anchor, site, needed, reserve } : undefined
}

export function toolFamilyForJob(job: string): WorkToolFamily | undefined {
  return job === 'construction'
    ? 'hammer'
    : job === 'wood'
      ? 'axe'
      : ['stone', 'gold', 'copper', 'tin', 'iron'].includes(job)
        ? 'pickaxe'
        : job === 'wheat'
          ? 'scythe'
          : undefined
}

export function equipOwnedTool(unit: Pick<CollectiveMember, 'inventory'>, family: WorkToolFamily): boolean {
  if (unit.inventory?.toolsStowed) return false
  const inventory = unit.inventory
  if (!inventory) return false
  const current = inventory.activeWeapons?.tool
  if (workToolFamily(current) === family && !isEquipmentBroken(current!)) return true
  const bag = inventory.equipment ?? []
  const index = bag.findIndex(item => workToolFamily(item) === family && !isEquipmentBroken(item))
  if (index < 0) return false
  const [tool] = bag.splice(index, 1)
  if (current) bag.push(current)
  inventory.activeWeapons ??= {}
  inventory.activeWeapons.tool = tool!
  return true
}
