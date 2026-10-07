import { equipmentBaseKey } from './equipmentCondition'
import type { UnitEntity } from '../../types/entities'

const DECOR_PREFIXES = [
  'upward_horns',
  'helmet_wings',
  'plumage',
  'centurion_crest',
  'centurion_plumage',
  'legion_plumage',
  'crest',
]

export function isHelmetDecoration(item: string): boolean {
  const key = equipmentBaseKey(item)
  return DECOR_PREFIXES.some(prefix => key === prefix || key.startsWith(`${prefix}_`))
}

export function equipmentVisualParts(item: string): string[] {
  const [base, decorations] = item.replace(/~condition:\d+$/, '').split('~decor:')
  return [base!, ...(decorations?.split('+').filter(Boolean) ?? [])]
}

export function decorateHelmet(helmet: string, decorations: readonly string[]): string {
  const parts = equipmentVisualParts(helmet)
  const decor = [...new Set([...parts.slice(1), ...decorations])].sort()
  return decor.length ? `${parts[0]}~decor:${decor.join('+')}` : helmet
}

/** Pair legacy loose ornaments with bare helmets, preserving unmatched old items. */
export function bundleHelmetDecorations(items: readonly string[]): string[] {
  const result = [...items]
  const helmets = result
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        !isHelmetDecoration(item) &&
        equipmentBaseKey(item).startsWith('helmet_') &&
        equipmentVisualParts(item).length === 1
    )
  const decorations = result.map((item, index) => ({ item, index })).filter(({ item }) => isHelmetDecoration(item))
  if (!helmets.length || !decorations.length) return result
  const removed = new Set<number>()
  decorations.forEach(({ item, index }, i) => {
    const target = helmets[Math.min(i, helmets.length - 1)]!
    result[target.index] = decorateHelmet(result[target.index]!, [item])
    removed.add(index)
  })
  return result.filter((_, index) => !removed.has(index))
}

export function migrateHelmetInventory(inventory: NonNullable<UnitEntity['inventory']>): void {
  const equipped = inventory.equipped
  if (equipped?.helmet && equipped.helmetDecor) {
    equipped.helmet = decorateHelmet(equipped.helmet, [equipped.helmetDecor])
    delete equipped.helmetDecor
    if (inventory.equippedCounts) delete inventory.equippedCounts.helmetDecor
  }
  if (inventory.equipment) {
    const bundled = bundleHelmetDecorations(inventory.equipment)
    inventory.equipment.splice(0, inventory.equipment.length, ...bundled)
  }
}
