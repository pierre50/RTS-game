import { CIVILIZATION_SETTLEMENT_NAMES } from '../../config/settlementNames'

type Settlement = { type: string; settlementName?: string }
type Owner = { civ?: string; buildings?: Settlement[] }

/** Preserve saved names, and reserve all of them before naming older unnamed villages. */
export function assignSettlementNames(owners: readonly Owner[]): void {
  const used = new Set(
    owners.flatMap(owner =>
      (owner.buildings ?? []).flatMap(building =>
        building.type === 'TownCenter' && building.settlementName?.trim() ? [building.settlementName] : []
      )
    )
  )
  for (const owner of owners) {
    const names = CIVILIZATION_SETTLEMENT_NAMES[owner.civ ?? ''] ?? CIVILIZATION_SETTLEMENT_NAMES.Hellas
    for (const building of owner.buildings ?? []) {
      if (building.type !== 'TownCenter' || building.settlementName?.trim()) continue
      let index = 0
      let name: string
      do {
        const cycle = Math.floor(index / names.length) + 1
        name = `${names[index % names.length]}${cycle > 1 ? ` ${cycle}` : ''}`
        index++
      } while (used.has(name))
      building.settlementName = name
      used.add(name)
    }
  }
}
