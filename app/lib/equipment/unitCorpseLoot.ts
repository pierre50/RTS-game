import { UNIT_CORPSE_LOOT } from '../../config/unitCorpseLoot'
import type { UnitEntity } from '../../types/entities'

// Called only by UnitLifecycle.die(), whose isDead guard prevents a second roll.
// Store the result in the ordinary inventory so looting and saves preserve it.
export function addUnitCorpseLootResources(unit: UnitEntity): void {
  if (!unit.isDead || unit.isDestroyed) return
  const player = unit.context?.player
  const owner = unit.owner
  if (!player || !owner || owner === player || owner.isPlayed) return
  if (!player.isEnemy?.(owner) && !owner.isEnemy?.(player)) return

  const table = UNIT_CORPSE_LOOT[unit.type]
  if (!table) return
  const map = unit.context?.map
  const random = () => map?.random?.() ?? Math.random()
  for (const entry of table) {
    if (random() * 100 >= entry.chancePercent) continue
    const amount = entry.min + Math.floor(random() * (entry.max - entry.min + 1))
    unit.inventory ??= {}
    const resources = (unit.inventory.resources ??= {})
    resources[entry.item] = (resources[entry.item] ?? 0) + amount
  }
}
