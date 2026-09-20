import { MAX_ARCHER_BY_AGE, MAX_BUILDING_BY_AGE, MAX_INFANTRY_BY_AGE } from '../../ai/config'
import { CIVILIZATION_LEVEL_RESOURCE_BONUS } from '../../config/resourcePresets'
import { PLAYER_TYPES } from '../../constants'
import { AGE_RULES_VERSION } from '../../lib/objectives/ageRules'
import { getBuildingConfigForAge } from '../../lib/buildings/buildingAge'
import { depositChestResources } from '../../lib/resources/playerResourceTotals'
import { StartingVillageLayout } from './StartingVillageLayout'
import { OfflineWorldSpatial, isLiving, type OfflineTerrainCell } from './OfflineWorldSpatial'
import { savedResourceOwner, type OfflineWorkRules } from './OfflineWorldWork'
import type { GameConfig, SaveEntityState, SerializedSave, VillageStartProfile } from '../../types/save'

const DISTRICT_BUILDING_ORDER = [
  'Granary',
  'StoragePit',
  'Market',
  'Barracks',
  'ArcheryRange',
  'Stable',
  'House',
  'WatchTower',
]
const buildingPlacementOrder = (type: string) => DISTRICT_BUILDING_ORDER.indexOf(type) + 1 || 99

/** Legacy levels remain inputs only; all new villages use the same serialized state. */
export function villageStartProfiles(config: GameConfig): Record<string, VillageStartProfile> {
  const result: Record<string, VillageStartProfile> = {}
  for (const player of config.players ?? []) {
    if (!player.civ || !player.civilizationLevel) continue
    const level = Math.max(1, Math.min(3, Math.floor(player.civilizationLevel)))
    const age = Math.min(2, level) as 0 | 1 | 2
    result[player.civ] = {
      age,
      buildings: { ...MAX_BUILDING_BY_AGE[age] },
      units: { Fantassin: MAX_INFANTRY_BY_AGE[age], Bowman: MAX_ARCHER_BY_AGE[age] },
      resourceBonus: { ...CIVILIZATION_LEVEL_RESOURCE_BONUS[level] },
      ...(level >= 2 ? { wallRadius: 22 } : {}),
    }
  }
  return { ...result, ...config.villageStarts }
}

/** Build a detached initial state. Never call this on a restored campaign world. */
export function applyVillageStartingState(
  source: SerializedSave,
  profiles: Record<string, VillageStartProfile>,
  terrain: (OfflineTerrainCell | null | undefined)[][],
  rules: OfflineWorkRules,
  options: { skipPlayed?: boolean } = {}
): SerializedSave {
  const state = structuredClone(source)
  const layout = new StartingVillageLayout(state, terrain, rules)
  const spatial = layout.spatial
  state.players.forEach((player, index) => {
    if (options.skipPlayed && player.isPlayed) return
    // Neutral and bandit owners also have a civilization for their assets, not a village to upgrade.
    if (player.type !== PLAYER_TYPES.human && player.type !== PLAYER_TYPES.ai) return
    const profile = profiles[player.civ ?? '']
    if (!profile) return
    if (!Number.isInteger(profile.age) || profile.age < 0 || profile.age > 2)
      throw new Error('Invalid village starting age')
    for (const count of [...Object.values(profile.buildings), ...Object.values(profile.units)]) {
      if (!Number.isInteger(count) || count < 0 || count > 200) throw new Error('Invalid village starting count')
    }
    const center = player.buildings?.find(b => b.type === 'TownCenter' && b.isBuilt && isLiving(b))
    if (!center) throw new Error(`Starting village ${player.civ} requires a TownCenter`)
    player.age = profile.age
    player.ageRulesVersion = AGE_RULES_VERSION
    player.hasBuilt = [
      ...new Set([
        ...(player.hasBuilt ?? []),
        ...player.buildings!.filter(b => b.isBuilt && isLiving(b)).map(b => b.type),
      ]),
    ]
    const findStartingSite = (anchor: SaveEntityState, size: number, type: string) =>
      layout.findSite(center, anchor, size, player.civ ?? '', type)
    const addBuilding = (type: string, fixedPoint?: { i: number; j: number }) => {
      const config = getBuildingConfigForAge(rules.buildingConfig(index, type), profile.age)
      if (!(Number(config.totalHitPoints) > 0)) throw new Error(`Unknown starting building ${type}`)
      const size = Number(config.size) || 0
      const point = fixedPoint ?? findStartingSite(center, size, type)
      if (!point) throw new Error(`No space for required ${type} in ${player.civ}`)
      const building: SaveEntityState = {
        ...point,
        type,
        size,
        label: `start:${player.label ?? index}:building:${player.buildings!.length}`,
        isBuilt: true,
        buildingAge: profile.age,
        hitPoints: Number(config.totalHitPoints),
        totalHitPoints: Number(config.totalHitPoints),
      }
      player.buildings!.push(building)
      if (!player.hasBuilt!.includes(type)) player.hasBuilt!.push(type)
      layout.reserveBuilding(building)
      layout.recordSite(center, type, building, size)
    }
    // Reserve agriculture before buildings, decorations and newly spawned units
    // fragment the remaining free terrain.
    const fields = profile.wheatFields ?? 0
    if (!Number.isInteger(fields) || fields < 0 || fields > 20) throw new Error('Invalid starting wheat field count')
    const fieldSize = Number(rules.buildingConfig(index, 'Farm').size) || 4
    const before = Math.floor((fieldSize - 1) / 2)
    const after = fieldSize - before - 1
    const granary = player.buildings!.find(building => building.type === 'Granary' && isLiving(building)) ?? center
    for (let field = 0; field < fields; field++) {
      const point = findStartingSite(granary, fieldSize, 'Farm')
      if (!point) throw new Error(`No space for starting wheat field in ${player.civ}`)
      layout.recordSite(center, 'Farm', point, fieldSize)
      for (let i = point.i - before; i <= point.i + after; i++) {
        for (let j = point.j - before; j <= point.j + after; j++) {
          const wheat: SaveEntityState = {
            i,
            j,
            type: 'Wheat',
            label: `start:${player.label ?? index}:wheat:${field}:${i}:${j}`,
            // An unspecified saved growth frame restores as mature using the loaded sprite.
            // Asset caches may not yet know the final frame during village generation.
            quantity: 10,
            totalQuantity: 10,
          }
          state.resources.push(wheat)
          spatial.reserve(wheat)
        }
      }
    }
    for (const [type, count] of Object.entries(profile.buildings).sort(
      ([a], [b]) => buildingPlacementOrder(a) - buildingPlacementOrder(b)
    )) {
      const existing = player.buildings!.filter(b => b.type === type && isLiving(b)).length
      for (let n = existing; n < count; n++) addBuilding(type)
    }
    player.units ??= []
    const queued = player.buildings!.flatMap(b => b.trainingQueue ?? []).length
    const additions = Object.entries(profile.units).reduce(
      (total, [type, count]) =>
        total + Math.max(0, count - player.units!.filter(u => u.type === type && isLiving(u)).length),
      0
    )
    const population = player.units.filter(isLiving).length + queued + additions
    const capacity = () =>
      player
        .buildings!.filter(b => b.isBuilt && isLiving(b))
        .reduce((sum, b) => sum + rules.buildingCapacity(index, b.type), 0)
    if (capacity() < population && rules.buildingCapacity(index, 'House') <= 0)
      throw new Error('Starting village has no housing capacity')
    while (capacity() < population) addBuilding('House')
    for (const [type, count] of Object.entries(profile.units)) {
      const existing = player.units.filter(u => u.type === type && isLiving(u)).length
      const config = rules.unitConfig(index, type)
      if (count && !(Number(config.totalHitPoints) > 0)) throw new Error(`Unknown starting unit ${type}`)
      for (let n = existing; n < count; n++) {
        const point = spatial.findNear(center, 20)
        if (!point) throw new Error(`No space for required ${type} in ${player.civ}`)
        const unit: SaveEntityState = {
          ...point,
          type,
          label: `start:${player.label ?? index}:unit:${player.units.length}`,
          hitPoints: Number(config.totalHitPoints),
          totalHitPoints: Number(config.totalHitPoints),
          inactif: true,
          ...(type === 'Villager' ? { autonomousJob: n % 3 === 0 ? 'wood' : 'food' } : {}),
        }
        player.units.push(unit)
        spatial.reserve(unit)
      }
    }
    player.population = population
    player.populationMax = capacity()
    if (profile.wallRadius !== undefined) {
      const radius = profile.wallRadius
      if (!Number.isInteger(radius) || radius < 4 || radius > 100) throw new Error('Invalid starting wall radius')
      const size = Number(rules.buildingConfig(index, 'SmallWall').size) || 0
      const footprint = Math.ceil(size / 2)
      for (let di = -radius; di <= radius; di++) {
        const dj = radius - Math.abs(di)
        for (const offset of dj ? [-dj, dj] : [0]) {
          // Leave cardinal entrances wider than the wall footprint for village access.
          if (Math.abs(di) <= footprint + 1 || Math.abs(offset) <= footprint + 1) continue
          const point = { i: center.i + di, j: center.j + offset }
          let free = true
          for (let i = point.i - footprint; i <= point.i + footprint; i++)
            for (let j = point.j - footprint; j <= point.j + footprint; j++)
              if (!spatial.naturalCell({ i, j })) free = false
          // Scenic perimeter segments are optional where terrain or buildings intersect.
          if (free) addBuilding('SmallWall', point)
        }
      }
    }
    if (profile.resourceBonus) {
      if (Object.values(profile.resourceBonus).some(n => !Number.isFinite(n) || n < 0))
        throw new Error('Invalid starting resources')
      if (!depositChestResources(savedResourceOwner(player, state.players), profile.resourceBonus))
        throw new Error('Starting village has no resource depot')
    }
  })
  return state
}

export function placeStartingHeroInVillage(
  state: SerializedSave,
  civilization: string,
  terrain: (OfflineTerrainCell | null | undefined)[][],
  rules: OfflineWorkRules
): void {
  const host = state.players.find(p => !p.isPlayed && p.civ === civilization)
  const center = host?.buildings?.find(b => b.type === 'TownCenter' && b.isBuilt && isLiving(b))
  const hero = state.players.find(p => p.isPlayed)?.units?.find(u => u.type === 'Hero' && isLiving(u))
  if (!center || !hero) throw new Error('Tutorial hero requires a host village and a hero')
  const spatial = new OfflineWorldSpatial(terrain, state, (b, i) => Number(rules.buildingConfig(i, b.type).size) || 2)
  const point = spatial.findNear(center, 12)
  if (!point) throw new Error('No safe hero arrival cell in starting village')
  spatial.move(hero, point)
}
