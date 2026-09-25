import profiles from '../../config/civilizationPlacement.json'
import { CIVILIZATIONS } from '../../config/civilizations'
import type { MapBlueprint, MapSettlement } from '../../classes/map/MapGenerationTypes'

/** Assign the whole roster together, so choosing the human civilization cannot steal an AI's biome. */
export function assignContinentVillages<T extends MapBlueprint>(blueprint: T): T {
  const slots = (blueprint.settlements ?? []).filter(site => site.kind === 'village' && !site.civ)
  if (!slots.length) return blueprint // Legacy worlds already contain assigned settlements.
  const civilizations = CIVILIZATIONS.map(civ => civ.value)
  if (slots.length !== civilizations.length) throw new Error('Continent must reserve one village site per civilization')
  const profileByCiv = profiles as Record<
    string,
    { biomes: Record<string, number>; target_x: number; target_y: number; x_weight: number; y_weight: number }
  >
  const edge = blueprint.localGridLayout ? (blueprint.localGridLayout.columns - 1) * 2 - 1 : blueprint.size
  const score = (civ: string, site: MapSettlement) => {
    const profile = profileByCiv[civ]
    const point = site.world ?? site.local
    // Biome suitability dominates; old geographic preferences distinguish equivalent sites.
    return (
      (profile.biomes[site.biome ?? ''] ?? 0) * 100 +
      (1 - Math.abs(point.j / Math.max(1, edge) - profile.target_x)) * profile.x_weight +
      (1 - Math.abs(point.i / Math.max(1, edge) - profile.target_y)) * profile.y_weight
    )
  }
  const memo = new Map<number, { score: number; sites: number[] }>()
  const choose = (index: number, used: number): { score: number; sites: number[] } => {
    if (index === civilizations.length) return { score: 0, sites: [] }
    const cached = memo.get(used)
    if (cached) return cached
    let best = { score: -Infinity, sites: [] as number[] }
    slots.forEach((site, slot) => {
      if (used & (1 << slot)) return
      const rest = choose(index + 1, used | (1 << slot))
      const total = score(civilizations[index], site) + rest.score
      if (total > best.score) best = { score: total, sites: [slot, ...rest.sites] }
    })
    memo.set(used, best)
    return best
  }
  const assigned = new Map<MapSettlement, MapSettlement>()
  choose(0, 0).sites.forEach((slot, index) =>
    assigned.set(slots[slot], { ...slots[slot], civ: civilizations[index], playerIndex: index })
  )
  const settlements = (blueprint.settlements ?? []).map(site => assigned.get(site) ?? site)
  return {
    ...blueprint,
    settlements,
    worldManifest: blueprint.worldManifest ? { ...blueprint.worldManifest, settlements } : undefined,
  }
}
