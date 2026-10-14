/** Contacts before breaking; armor retains its percentage-based condition. */
export const EQUIPMENT_DURABILITY = {
  materials: { ceramic: 300, bronze: 600, iron: 900 },
  bow: 600,
  slingshot: 300,
  armorCondition: 100,
  weaponRepairRecipeFraction: 0.5,
} as const
