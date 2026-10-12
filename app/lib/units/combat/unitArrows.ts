import { isEquipmentBroken } from '../../equipment/equipmentCondition'
import { hasNpcWeaponInventory, npcWeaponDefinition } from './npcWeapons'
/** Real inventory items: taking an arrow from a resident also removes their ammunition. */
export type NpcArrowState = { initialized: true; lastRefillDay?: number; pendingDay?: number }
type ArrowInventory = {
  equipment?: string[]
  activeWeapons?: { ranged?: string }
  equipped?: { arrow?: string }
  equippedCounts?: { arrow?: number }
  npcWeaponsInitialized?: boolean
  npcArrows?: NpcArrowState
}
type ArrowUnit = {
  type?: string
  controlMode?: string
  isDead?: boolean
  isDestroyed?: boolean
  inventory?: ArrowInventory
  action?: string | null
  combatMode?: string | null
  dest?: unknown
  campBehavior?: { phase: string }
  spacePortalState?: { combatTarget?: unknown } | null
  isFleeing?: boolean
  owner?: { isPlayed?: boolean; type?: string; buildings?: { type: string }[] } | null
}

export function npcArrowCapacity(unit: ArrowUnit): number {
  if (unit.type === 'Hero' || unit.controlMode === 'hero') return 0
  if (unit.type === 'Villager' || hasNpcWeaponInventory(unit)) {
    const weapons = [unit.inventory?.activeWeapons?.ranged, ...(unit.inventory?.equipment ?? [])]
    const hasBow = weapons.some(
      item => item && item.startsWith('bow') && !isEquipmentBroken(item) && npcWeaponDefinition(item)
    )
    return hasBow ? (unit.type === 'Villager' ? 10 : 20) : 0
  }
  return ['Bowman', 'BanditArcher'].includes(unit.type ?? '') ? 20 : 0
}

/** Missing metadata is a one-time migration; existing ammunition is never duplicated. */
export function initializeNpcArrows(unit: ArrowUnit): void {
  const capacity = npcArrowCapacity(unit)
  if (!capacity && (unit.type === 'Villager' || hasNpcWeaponInventory(unit))) {
    unit.inventory ??= {}
    unit.inventory.npcArrows ??= { initialized: true }
    return
  }
  if (!capacity || unit.isDead || unit.isDestroyed || unit.inventory?.npcArrows?.initialized) return
  unit.inventory ??= {}
  const bag = (unit.inventory.equipment ??= [])
  const existing = bag.filter(item => item.startsWith('arrow_')).length
  // A promoted villager keeps their former stock, including zero, via the inventory marker.
  if (!existing) bag.push(...Array<string>(capacity).fill('arrow_ceramic'))
  unit.inventory.npcArrows = { initialized: true }
}

export function hasUnitArrow(unit: Pick<ArrowUnit, 'type' | 'controlMode' | 'inventory'>): boolean {
  if (unit.type === 'Hero' || unit.controlMode === 'hero')
    return Boolean(unit.inventory?.equipped?.arrow && (unit.inventory.equippedCounts?.arrow ?? 1) > 0)
  return Boolean(unit.inventory?.equipment?.some(item => item.startsWith('arrow_')))
}

export function isNpcArcher(unit: Pick<ArrowUnit, 'type' | 'controlMode'>): boolean {
  return unit.controlMode !== 'hero' && ['Bowman', 'BanditArcher'].includes(unit.type ?? '')
}

/** An uninitialized inventory still needs its one-time starting ammunition. */
export function usesArcherDagger(unit: Pick<ArrowUnit, 'type' | 'controlMode' | 'inventory'>): boolean {
  return isNpcArcher(unit) && Boolean(unit.inventory?.npcArrows?.initialized) && !hasUnitArrow(unit)
}

export function isInactiveArcherWeapon(
  unit: Pick<ArrowUnit, 'type' | 'controlMode' | 'inventory'>,
  equipment: string
): boolean {
  if (!isNpcArcher(unit)) return false
  return usesArcherDagger(unit)
    ? equipment.startsWith('bow') || equipment.startsWith('arrow_')
    : equipment.startsWith('dagger_')
}

export function consumeNpcArrow(unit: ArrowUnit): string | null {
  const bag = unit.inventory?.equipment
  const index = bag?.findIndex(item => item.startsWith('arrow_')) ?? -1
  return bag && index >= 0 ? (bag.splice(index, 1)[0] ?? null) : null
}

export function arrowProjectileType(arrow: string): string {
  return (
    {
      arrow_ceramic: 'ArrowCeramic',
      arrow_copper: 'ArrowCopper',
      arrow_bronze: 'ArrowBronze',
      arrow_iron: 'ArrowIron',
    }[arrow] ?? 'ArrowCeramic'
  )
}

/** Factions without a town keep their daily allowance; settled factions pay for local supplies. */
export function replenishNpcArrows(unit: ArrowUnit, day?: number, owner = unit.owner): void {
  if (!owner || owner.isPlayed || owner.type === 'Human' || !npcArrowCapacity(unit) || unit.isDead || unit.isDestroyed)
    return
  if (owner.buildings?.some(building => building.type === 'TownCenter')) {
    if (unit.inventory?.npcArrows) delete unit.inventory.npcArrows.pendingDay
    return
  }
  initializeNpcArrows(unit)
  const state = unit.inventory!.npcArrows!
  if (day != null && Number.isFinite(day) && day > (state.lastRefillDay ?? -1))
    state.pendingDay = Math.max(day, state.pendingDay ?? day)
  if (
    state.pendingDay == null ||
    (unit.combatMode && unit.dest) ||
    unit.campBehavior?.phase === 'pursue' ||
    unit.spacePortalState?.combatTarget ||
    unit.isFleeing ||
    ['attack', 'flee', 'hunt'].includes(unit.action ?? '')
  )
    return
  const bag = (unit.inventory!.equipment ??= [])
  const missing = npcArrowCapacity(unit) - bag.filter(item => item.startsWith('arrow_')).length
  if (missing > 0) bag.push(...Array<string>(missing).fill('arrow_ceramic'))
  state.lastRefillDay = state.pendingDay
  delete state.pendingDay
}
