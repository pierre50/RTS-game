import { BUILDING_TYPES } from '../../constants'
import { t } from '../../lib/lang'
import type { PlayerLike } from '../../types/player'

type CountableEntity = { assetType?: string; type?: string }
type MinimapLegendCount = { count: number; constructing?: boolean; label: string; type: string }
const MINIMAP_AGE_BUILDING_TYPES = new Set<string>([
  BUILDING_TYPES.archeryRange,
  BUILDING_TYPES.barracks,
  BUILDING_TYPES.granary,
  BUILDING_TYPES.house,
  BUILDING_TYPES.market,
  BUILDING_TYPES.stable,
  BUILDING_TYPES.storagePit,
  BUILDING_TYPES.temple,
  BUILDING_TYPES.townCenter,
  BUILDING_TYPES.watchTower,
])

function humanizeTypeKey(key: string): string {
  return key
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

function typeLabel(type: string): string {
  const translated = t(type)
  return translated === type ? humanizeTypeKey(type) : translated
}

function countByType(entities: CountableEntity[]): MinimapLegendCount[] {
  const counts = new Map<string, number>()
  for (const entity of entities) {
    const type = entity.assetType ?? entity.type
    if (!type) continue
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ count, label: typeLabel(type), type }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function countBuildingsByType(
  buildings: Array<CountableEntity & { isBuilt?: boolean; loading?: number | null }>
): MinimapLegendCount[] {
  const counts = new Map<string, MinimapLegendCount>()
  for (const building of buildings) {
    const type = building.assetType ?? building.type
    if (!type) continue
    if (!MINIMAP_AGE_BUILDING_TYPES.has(type)) continue
    const constructing = building.isBuilt !== true
    const key = `${type}:${constructing ? 'constructing' : 'built'}`
    const existing = counts.get(key)
    if (existing) {
      existing.count++
      continue
    }
    counts.set(key, { constructing, count: 1, label: typeLabel(type), type })
  }
  return [...counts.values()].sort(
    (a, b) =>
      b.count - a.count ||
      a.label.localeCompare(b.label) ||
      Number(a.constructing === true) - Number(b.constructing === true)
  )
}

function createMinimapLegendSection(titleText: string, entries: MinimapLegendCount[]): HTMLDivElement {
  const section = document.createElement('div')
  section.className = 'minimap-legend-section'
  const title = document.createElement('div')
  title.className = 'minimap-legend-title'
  title.textContent = titleText
  section.appendChild(title)

  if (!entries.length) {
    const empty = document.createElement('div')
    empty.className = 'minimap-legend-empty'
    empty.textContent = t('minimapLegendEmpty')
    section.appendChild(empty)
    return section
  }

  for (const entry of entries) {
    const row = document.createElement('div')
    row.className = 'minimap-legend-row'
    row.classList.toggle('constructing', entry.constructing === true)
    const count = document.createElement('span')
    count.className = 'minimap-legend-count'
    count.textContent = String(entry.count)
    const label = document.createElement('span')
    label.className = 'minimap-legend-label'
    label.textContent = entry.constructing ? t('minimapLegendConstructing', { name: entry.label }) : entry.label
    row.append(count, label)
    section.appendChild(row)
  }

  return section
}

export function renderMinimapLegend(container: HTMLElement, player: PlayerLike | null | undefined): void {
  container.replaceChildren()
  if (!player) return

  const unitCounts = countByType(player.units.filter(unit => !unit.isDead && !unit.isDestroyed && unit.type !== 'Hero'))
  const buildingCounts = countBuildingsByType(player.buildings.filter(building => !building.isDead && !building.isDestroyed))

  container.append(
    createMinimapLegendSection(t('minimapLegendUnits'), unitCounts),
    createMinimapLegendSection(t('minimapLegendBuildings'), buildingCounts)
  )
}
