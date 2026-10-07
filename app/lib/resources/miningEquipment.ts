import { resolveForgeEquipment, type ForgeUpgradeOwner } from '../equipment/forgeUpgrades'
/** Work tools are automatic unless the unit carries an explicit pickaxe. */
export type MiningActor = {
  type?: string
  owner?: ForgeUpgradeOwner | null
  equipment?: string[]
  inventory?: { equipment?: string[]; activeWeapons?: { melee?: string | null } }
}

const PICKAXE_TIERS: Record<string, number> = {
  pickaxe_ceramic: 0,
  pickaxe_copper: 1,
  pickaxe_bronze: 2,
  pickaxe_iron: 3,
}

export function getMiningPickaxe(unit: MiningActor | null | undefined): string {
  const carried = [
    unit?.inventory?.activeWeapons?.melee,
    ...(unit?.inventory?.equipment ?? []),
    ...(unit?.equipment ?? []),
  ]
    .filter((item): item is string => Boolean(item && Object.hasOwn(PICKAXE_TIERS, item)))
    .sort((a, b) => PICKAXE_TIERS[b] - PICKAXE_TIERS[a])
  const researched = resolveForgeEquipment('pickaxe_ceramic', unit?.owner)
  if (carried[0] && (unit?.type !== 'Hero' || PICKAXE_TIERS[carried[0]] > PICKAXE_TIERS[researched])) return carried[0]
  return researched
}

export function hasIronMiningPickaxe(unit: MiningActor | null | undefined): boolean {
  return PICKAXE_TIERS[getMiningPickaxe(unit)] >= PICKAXE_TIERS.pickaxe_bronze
}
