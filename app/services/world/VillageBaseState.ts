import { expandLegacyFoodAmount } from '../../lib/resources/playerResourceTotals'
import type { ResourceAmount } from '../../types/common'
import type { SavePlayerState, SaveGridPoint, SaveEntityState } from '../../types/save'
import type { OfflineWorkRules } from './OfflineWorldWork'
import type { OfflineWorldSpatial } from './OfflineWorldSpatial'

/** Shared baseline for new runtime villages and never-visited campaign regions. */
export function populateVillageBase(
  player: SavePlayerState,
  index: number,
  anchor: SaveGridPoint,
  spatial: OfflineWorldSpatial,
  rules: Pick<OfflineWorkRules, 'buildingConfig' | 'unitConfig' | 'buildingCapacity'>,
  resources: ResourceAmount,
  options: { heroOnly?: boolean; workers?: number } = {}
): void {
  const config = rules.buildingConfig(index, 'TownCenter')
  const footprint = Math.ceil((Number(config.size) || 2) / 2)
  let center: SaveGridPoint | undefined
  for (let ring = 0; ring <= 30 && !center; ring++)
    for (let di = -ring; di <= ring && !center; di++)
      for (let dj = -ring; dj <= ring; dj++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue
        const point = { i: anchor.i + di, j: anchor.j + dj }
        let free = true
        const radius = options.heroOnly ? 0 : footprint
        for (let i = point.i - radius; i <= point.i + radius && free; i++)
          for (let j = point.j - radius; j <= point.j + radius; j++)
            if (!spatial.available({ i, j })) {
              free = false
              break
            }
        if (free) {
          center = point
          break
        }
      }
  if (!center) throw new Error(`No starting position for ${player.label}`)
  player.units = []
  player.buildings = []
  if (!options.heroOnly) {
    const building = {
      ...center,
      label: `${player.label}:center`,
      type: 'TownCenter',
      size: Number(config.size) || 2,
      isBuilt: true,
      hitPoints: Number(config.totalHitPoints) || 100,
      totalHitPoints: Number(config.totalHitPoints) || 100,
      inventory: { resources: expandLegacyFoodAmount(resources) },
    }
    player.buildings.push(building)
    for (let i = center.i - footprint; i <= center.i + footprint; i++)
      for (let j = center.j - footprint; j <= center.j + footprint; j++) spatial.reserve(building, { i, j })
  }
  const count = options.heroOnly ? 1 : 1 + Math.max(4, options.workers ?? 4)
  for (let n = 0; n < count; n++) {
    const point = spatial.findNear(center, 20)
    if (!point) throw new Error(`No starting unit position for ${player.label}`)
    const type = n === 0 ? (player.isPlayed ? 'Hero' : 'Chief') : 'Villager'
    const hp = Number(rules.unitConfig(index, type).totalHitPoints) || 18
    const unit: SaveEntityState = {
      ...point,
      type,
      label: `${player.label}:unit:${n}`,
      hitPoints: hp,
      totalHitPoints: hp,
      inactif: true,
      gender: type === 'Hero' ? player.gender : n % 2 ? ('female' as const) : ('male' as const),
      ...(type === 'Villager' ? { autonomousJob: n % 3 ? 'food' : 'wood' } : {}),
    }
    player.units.push(unit)
    spatial.reserve(unit)
  }
  player.population = count
  player.populationMax = options.heroOnly ? 1 : Math.max(count, rules.buildingCapacity(index, 'TownCenter'))
}
