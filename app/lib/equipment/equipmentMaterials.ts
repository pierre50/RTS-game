import replacements from '../../config/equipmentLegacyReplacements.json'

const legacy: Record<string, string> = replacements

/** Old item IDs are accepted only at migration boundaries, never offered as new gear. */
export function isCurrentEquipment(item: string): boolean {
  return !Object.hasOwn(legacy, item.split('~')[0] ?? item)
}

export function migrateEquipmentMaterial(item: string): string {
  return item.replace(/^[^~]+|(?<=~decor:)[^~]+/g, part =>
    part
      .split('+')
      .map(key => (Object.hasOwn(legacy, key) ? legacy[key]! : key))
      .join('+')
  )
}

/** Preserve counts and condition suffixes when converting inventories, stocks and corpse loot. */
export function migrateEquipmentRecord(value: unknown): void {
  if (!value || typeof value !== 'object') return
  const record = value as Record<string, unknown>
  if (record.type === 'Fantassin' && record.inventory && typeof record.inventory === 'object') {
    const inventory = record.inventory as Record<string, unknown>
    const toSpear = (item: string) => migrateEquipmentMaterial(item).replace(/^sword_(bronze|iron)(?=~|$)/, 'spear_$1')
    if (Array.isArray(inventory.equipment))
      inventory.equipment = inventory.equipment.map(item => (typeof item === 'string' ? toSpear(item) : item))
    if (record.equipmentDurability && typeof record.equipmentDurability === 'object')
      record.equipmentDurability = Object.fromEntries(
        Object.entries(record.equipmentDurability).map(([key, value]) => [toSpear(key), value])
      )
    if (inventory.activeWeapons && typeof inventory.activeWeapons === 'object') {
      const active = inventory.activeWeapons as Record<string, unknown>
      if (typeof active.melee === 'string') active.melee = toSpear(active.melee)
    }
  }
  for (const [key, child] of Object.entries(record)) {
    if (key === 'resources' && child && typeof child === 'object') {
      const resources = child as Record<string, unknown>
      const ingots = resources.copperIngot
      if (typeof ingots === 'number' && Number.isFinite(ingots) && ingots > 0) {
        resources.copper = (typeof resources.copper === 'number' ? resources.copper : 0) + ingots * 3
      }
      delete resources.copperIngot
    } else if (['equipment', 'lootEquipment', 'marketStock'].includes(key) && Array.isArray(child)) {
      child.forEach((item, index) => {
        if (typeof item === 'string') child[index] = migrateEquipmentMaterial(item)
      })
    } else if (['equipped', 'activeWeapons'].includes(key) && child && typeof child === 'object') {
      for (const [slot, item] of Object.entries(child))
        if (typeof item === 'string') (child as Record<string, unknown>)[slot] = migrateEquipmentMaterial(item)
    } else if (key === 'equipmentDurability' && child && typeof child === 'object') {
      const converted: Record<string, number> = {}
      for (const [item, condition] of Object.entries(child)) {
        const target = migrateEquipmentMaterial(item)
        if (typeof condition === 'number') converted[target] = Math.min(converted[target] ?? condition, condition)
      }
      record[key] = converted
    } else if (
      [
        'inventory',
        'units',
        'buildings',
        'corpses',
        'interiorBuildings',
        'caveContent',
        'banditCamps',
        'players',
      ].includes(key)
    ) {
      if (Array.isArray(child)) child.forEach(migrateEquipmentRecord)
      else migrateEquipmentRecord(child)
    }
  }
}
