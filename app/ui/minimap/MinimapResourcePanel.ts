import { BUILDING_TYPES, POPULATION_MAX, RESOURCE_NAMES, UNIT_TYPES } from '../../constants'
import { DAILY_CONSUMPTION_PER_VILLAGER } from '../../constants/consumption'
import { STABLE_HORSE_CAPACITY, getStableHorseAmount } from '../../lib/horses/stableHorses'
import { t } from '../../lib/lang'
import { getActiveMapSpace, getEntitySpaceId } from '../../lib/mapSpaces'
import { getPlayerResourceStores, getPlayerResourceTotals } from '../../lib/resources/playerResourceTotals'
import { getAutonomyJobForWork } from '../../lib/units/villagerAutonomyTargeting'
import type { BuildingEntity, UnitEntity, VillagerAutonomyJob } from '../../types/entities'
import type { RuntimeMap } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import type { MenuHost } from '../MenuHost'

type ResourceName = (typeof RESOURCE_NAMES)[number]
const SOURCE_LIMIT = 3
const VILLAGER_AUTONOMY_JOB_ORDER: VillagerAutonomyJob[] = [
  'food',
  'wood',
  'stone',
  'gold',
  'copper',
  'iron',
  'construction',
  'horseCapture',
]
const MINIMAP_RESOURCE_LABEL_KEYS: Record<ResourceName, string> = {
  copper: 'minimapResourceCopper',
  food: 'minimapResourceFood',
  gold: 'minimapResourceGold',
  iron: 'minimapResourceIron',
  stone: 'minimapResourceStone',
  wood: 'minimapResourceWood',
}

function isOwnedByPlayer(entity: { owner?: PlayerLike | { label?: string } | null }, player: PlayerLike): boolean {
  if (!entity.owner) return true
  return entity.owner === player || entity.owner.label === player.label
}

function isInActiveSpace(entity: { spaceId?: string | null }, map: RuntimeMap | null | undefined): boolean {
  const activeSpace = getActiveMapSpace(map)
  if (!activeSpace) return true
  return getEntitySpaceId(entity) === activeSpace.id
}

function getSourceLabel(source: UnitEntity | BuildingEntity): string {
  if ('type' in source && source.type) return t(source.type)
  return source.label ?? ''
}

function getLocalHero(menu: MenuHost): UnitEntity | null {
  const { controls, player } = menu.context
  const hero = controls.heroUnit ?? player?.units?.find(unit => unit.type === 'Hero') ?? null
  if (!hero || !player || !isOwnedByPlayer(hero, player) || !isInActiveSpace(hero, menu.context.map)) return null
  return hero
}

function getLocalStockpiles(menu: MenuHost): BuildingEntity[] {
  const { map, player } = menu.context
  if (!player) return []
  const activeSpace = getActiveMapSpace(map)
  if (!activeSpace) return getPlayerResourceStores(player)
  const localSpaces = new Set([activeSpace.id])
  // A room belongs to its exterior building, even when its contents are not currently visible.
  if (activeSpace.id === 'outside') {
    const parents = new Set(
      (player.buildings ?? [])
        .filter(
          building =>
            !building.isDead &&
            !building.isDestroyed &&
            isOwnedByPlayer(building, player) &&
            isInActiveSpace(building, map)
        )
        .map(building => building.label)
        .filter(Boolean)
    )
    for (const space of map.spaces?.values() ?? []) {
      if (space.kind === 'interior' && space.buildingLabel && parents.has(space.buildingLabel))
        localSpaces.add(space.id)
    }
  }
  return getPlayerResourceStores(player).filter(building => localSpaces.has(getEntitySpaceId(building)))
}

function getActivePlayerBuildings(player: PlayerLike | null | undefined): BuildingEntity[] {
  if (!player) return []
  return (player.buildings ?? []).filter(building => !building.isDead && !building.isDestroyed)
}

function getActiveVillagers(player: PlayerLike | null | undefined): UnitEntity[] {
  if (!player) return []
  return (player.units ?? []).filter(unit => unit.type === UNIT_TYPES.villager && !unit.isDead && !unit.isDestroyed)
}

function countQueuedTraining(buildings: BuildingEntity[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const building of buildings) {
    for (const type of building.queue ?? []) {
      if (!type) continue
      counts.set(type, (counts.get(type) ?? 0) + 1)
    }
    if (building.trainingType && !(building.queue ?? []).includes(building.trainingType)) {
      counts.set(building.trainingType, (counts.get(building.trainingType) ?? 0) + 1)
    }
  }
  return counts
}

function getStableHorseSummary(buildings: BuildingEntity[]): { available: number; capacity: number } {
  const stables = buildings.filter(building => building.type === BUILDING_TYPES.stable)
  return {
    available: stables.reduce((total, stable) => total + getStableHorseAmount(stable), 0),
    capacity: stables.length * STABLE_HORSE_CAPACITY,
  }
}

function resolveVillagerAutonomyJob(villager: UnitEntity): VillagerAutonomyJob | null {
  const sleepState = villager.shelterState?.reason === 'sleep' ? villager.shelterState : null
  return (
    sleepState?.previousAutonomousJob ??
    villager.autonomousJob ??
    getAutonomyJobForWork(sleepState?.previousWork ?? villager.work)
  )
}

function countVillagersByAutonomy(villagers: UnitEntity[]): {
  jobCounts: Map<VillagerAutonomyJob, number>
  unassigned: number
} {
  const jobCounts = new Map<VillagerAutonomyJob, number>()
  let unassigned = 0
  for (const villager of villagers) {
    const job = resolveVillagerAutonomyJob(villager)
    if (!job) {
      unassigned++
      continue
    }
    jobCounts.set(job, (jobCounts.get(job) ?? 0) + 1)
  }
  return { jobCounts, unassigned }
}

function minimapResourceLabel(resource: ResourceName): string {
  return t(MINIMAP_RESOURCE_LABEL_KEYS[resource])
}

function formatDailyConsumption(villagerCount: number): string {
  const parts = RESOURCE_NAMES.map(resource => {
    const amount = Math.max(0, Math.floor((DAILY_CONSUMPTION_PER_VILLAGER[resource] ?? 0) * villagerCount))
    return amount > 0 ? `${amount} ${minimapResourceLabel(resource)}` : null
  }).filter((part): part is string => Boolean(part))
  return parts.join(', ') || '0'
}

function createStatRow(labelText: string, valueText: string): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'minimap-resource-stat-row'
  const label = document.createElement('span')
  label.className = 'minimap-resource-label'
  label.textContent = labelText
  const value = document.createElement('span')
  value.className = 'minimap-resource-value'
  value.textContent = valueText
  row.append(label, value)
  return row
}

function createResourceRow(menu: MenuHost, resource: ResourceName, value: number): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'minimap-resource-row'

  const icon = document.createElement('img')
  icon.className = 'minimap-resource-icon'
  const source = menu.icons[resource]
  if (source) icon.src = source
  icon.alt = ''

  const label = document.createElement('span')
  label.className = 'minimap-resource-label'
  label.textContent = minimapResourceLabel(resource)

  const amount = document.createElement('span')
  amount.className = 'minimap-resource-value'
  amount.textContent = String(Math.min(value, 99999))

  row.append(icon, label, amount)
  return row
}

function createSourceLine(source: UnitEntity | BuildingEntity, totals: Record<ResourceName, number>): HTMLDivElement {
  const line = document.createElement('div')
  line.className = 'minimap-resource-source'
  const parts = RESOURCE_NAMES.filter(resource => totals[resource] > 0).map(
    resource => `${totals[resource]} ${minimapResourceLabel(resource)}`
  )
  line.textContent = `${getSourceLabel(source)}: ${parts.join(', ')}`
  return line
}

function villagerAutonomyJobLabel(job: VillagerAutonomyJob): string {
  if (job === 'construction') return t('npcOrderConstruction')
  if (job === 'horseCapture') return t('npcOrderHorseCapture')
  return minimapResourceLabel(job)
}

function createVillagerSection(menu: MenuHost): HTMLDivElement {
  const player = menu.context.player
  const villagers = getActiveVillagers(player)
  const { jobCounts, unassigned } = countVillagersByAutonomy(villagers)
  const section = document.createElement('div')
  section.className = 'minimap-resource-section'

  const title = document.createElement('div')
  title.className = 'minimap-resource-title'
  title.textContent = t('minimapVillagers')

  const rows = document.createElement('div')
  rows.className = 'minimap-resource-grid'
  rows.appendChild(
    createStatRow(
      t('minimapUnits'),
      `${player?.population ?? 0}/${Math.min(POPULATION_MAX, player?.populationMax ?? 0)}`
    )
  )
  rows.appendChild(createStatRow(t('minimapVillagerConsumption'), formatDailyConsumption(villagers.length)))

  for (const job of VILLAGER_AUTONOMY_JOB_ORDER) {
    const count = jobCounts.get(job) ?? 0
    if (count > 0) rows.appendChild(createStatRow(villagerAutonomyJobLabel(job), String(count)))
  }
  for (const [job, count] of [...jobCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (VILLAGER_AUTONOMY_JOB_ORDER.includes(job)) continue
    rows.appendChild(createStatRow(villagerAutonomyJobLabel(job), String(count)))
  }
  rows.appendChild(createStatRow(t('minimapVillagerUnassigned'), String(unassigned)))

  section.append(title, rows)
  return section
}

function createTrainingSection(menu: MenuHost): HTMLDivElement {
  const buildings = getActivePlayerBuildings(menu.context.player)
  const trainingCounts = countQueuedTraining(buildings)
  const horses = getStableHorseSummary(buildings)
  const section = document.createElement('div')
  section.className = 'minimap-resource-section'

  const title = document.createElement('div')
  title.className = 'minimap-resource-title'
  title.textContent = t('minimapTraining')

  const rows = document.createElement('div')
  rows.className = 'minimap-resource-grid'
  if (!trainingCounts.size) {
    const empty = document.createElement('div')
    empty.className = 'minimap-legend-empty'
    empty.textContent = t('minimapTrainingEmpty')
    rows.appendChild(empty)
  } else {
    for (const [type, count] of [...trainingCounts.entries()].sort(
      (a, b) => b[1] - a[1] || t(a[0]).localeCompare(t(b[0]))
    )) {
      rows.appendChild(createStatRow(t(type), String(count)))
    }
  }
  rows.appendChild(createStatRow(t('minimapStableHorses'), `${horses.available}/${horses.capacity}`))

  section.append(title, rows)
  return section
}

export function renderMinimapResourcePanel(container: HTMLElement, menu: MenuHost): void {
  container.replaceChildren()
  const hero = getLocalHero(menu)
  const stockpiles = getLocalStockpiles(menu)
  const visibleTotals = getPlayerResourceTotals({
    label: menu.context.player?.label,
    buildings: stockpiles,
    units: hero ? [hero] : [],
  })

  const title = document.createElement('div')
  title.className = 'minimap-resource-title'
  title.textContent = t('minimapLocalStock')

  const grid = document.createElement('div')
  grid.className = 'minimap-resource-grid'
  for (const resource of RESOURCE_NAMES) {
    const value = visibleTotals[resource]
    if (value > 0) grid.appendChild(createResourceRow(menu, resource, value))
  }
  if (!grid.children.length) {
    const empty = document.createElement('div')
    empty.className = 'minimap-legend-empty'
    empty.textContent = t('minimapLocalStockEmpty')
    grid.appendChild(empty)
  }

  const sources = document.createElement('div')
  sources.className = 'minimap-resource-sources'
  const sourceEntries = [hero, ...stockpiles]
    .filter((source): source is UnitEntity | BuildingEntity => Boolean(source))
    .map(source => {
      const totals = getPlayerResourceTotals({
        label: menu.context.player?.label,
        buildings: source === hero ? [] : [source as BuildingEntity],
        units: source === hero ? [hero] : [],
      })
      return { source, totals }
    })
    .filter(({ totals }) => RESOURCE_NAMES.some(resource => totals[resource] > 0))

  for (const { source, totals } of sourceEntries.slice(0, SOURCE_LIMIT)) {
    sources.appendChild(createSourceLine(source, totals))
  }

  container.append(createVillagerSection(menu), createTrainingSection(menu), title, grid)
  if (sources.children.length) container.appendChild(sources)
}
