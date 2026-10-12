import { VILLAGE_ACTIVITY_RADIUS } from '../../config/villageActivity'
import { workToolFamily, toolFamilyForWork, type WorkToolActor, type WorkToolFamily } from '../equipment/workTools'
import { initializeWorkTools } from '../equipment/workToolMigration'
import { initializeNpcArrows } from '../units/combat/unitArrows'
import { personalFoodReserve } from './villagerProvisions'
import type { UnitEntity } from '../../types/entities'

/** Shared loadout for every new-game hero; each call owns its inventory and ammunition. */
export function startingHeroInventory(): NonNullable<UnitEntity['inventory']> {
  const inventory: NonNullable<UnitEntity['inventory']> = {
    toolsInitialized: true,
    equipment: [],
    activeWeapons: {},
    equipped: {},
    equippedCounts: {},
  }
  return inventory
}

/** Provisions for newly created villagers; saved or transferred inventories remain authoritative. */
type StartingResident = WorkToolActor & { i?: number; j?: number; spaceId?: string | null; isDestroyed?: boolean }
export function startingVillagerInventory(
  residents: readonly StartingResident[] = [],
  location?: { i: number; j: number; spaceId?: string | null }
): NonNullable<UnitEntity['inventory']> {
  const total = personalFoodReserve()
  const meat = Math.floor(total / 2)
  const inventory: NonNullable<UnitEntity['inventory']> = { resources: { meat, berry: total - meat } }
  const family = startingToolFamily(residents, location)
  initializeWorkTools({
    type: 'Villager',
    work: { axe: 'woodcutter', pickaxe: 'stoneminer', hammer: 'builder', scythe: 'farmer' }[family],
    inventory,
  })
  initializeNpcArrows({ type: 'Villager', inventory })
  return inventory
}

/** The introductory companion starts without tools for the ground-resource bootstrap test. */
export function startingCompanionInventory(): NonNullable<UnitEntity['inventory']> {
  const inventory = startingVillagerInventory()
  inventory.npcWeaponsInitialized = true
  delete inventory.activeWeapons!.tool
  delete inventory.activeWeapons!.ranged
  inventory.equipment =
    inventory.equipment?.filter(
      item => !workToolFamily(item) && !item.startsWith('bow') && !item.startsWith('arrow_')
    ) ?? []
  return inventory
}

function startingToolFamily(
  residents: readonly StartingResident[],
  location?: { i: number; j: number; spaceId?: string | null }
): WorkToolFamily {
  const families: WorkToolFamily[] = ['axe', 'pickaxe', 'hammer', 'scythe']
  const counts = new Map(families.map(family => [family, 0]))
  for (const resident of residents) {
    if (resident.type !== 'Villager' || resident.isDead || resident.isDestroyed) continue
    if (
      location &&
      ((resident.spaceId ?? 'outside') !== (location.spaceId ?? 'outside') ||
        Math.hypot((resident.i ?? location.i) - location.i, (resident.j ?? location.j) - location.j) >
          VILLAGE_ACTIVITY_RADIUS)
    )
      continue
    const family = workToolFamily(resident.inventory?.activeWeapons?.tool)
    if (family) counts.set(family, counts.get(family)! + 1)
  }
  return families.reduce((best, next) => (counts.get(next)! < counts.get(best)! ? next : best))
}

/** Fresh authored villages only: exchange existing tools, never reset saved player equipment. */
export function balanceStartingVillagerTools(units: StartingResident[]): void {
  const assigned: StartingResident[] = []
  for (const unit of units) {
    if (unit.type !== 'Villager' || unit.isDead || unit.isDestroyed) continue
    initializeWorkTools(unit)
    const inventory = unit.inventory!
    const current = inventory.activeWeapons?.tool
    if (!current || inventory.toolsStowed) continue
    const location = unit.i == null || unit.j == null ? undefined : { i: unit.i, j: unit.j, spaceId: unit.spaceId }
    const family = toolFamilyForWork(unit.work) ?? startingToolFamily(assigned, location)
    const bag = inventory.equipment ?? []
    const index = bag.findIndex(item => workToolFamily(item) === family)
    if (workToolFamily(current) !== family && index >= 0) {
      inventory.activeWeapons!.tool = bag[index]!
      bag[index] = current
    }
    assigned.push(unit)
  }
}
