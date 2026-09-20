import { t } from '../lib/lang'
import { getActiveColonyAlerts, type RegionAlertType } from '../lib/world/regionAlerts'
import type { MenuHost } from './MenuHost'
import { worldEnvironmentLabel } from './worldMap/WorldEnvironmentLabel'
import { createWorldMapLegend, settlementPlayerColor } from './worldMap/WorldMapLegend'
import { renderWorldMapTerritories } from './worldMap/WorldMapTerritories'
import type { MacroWorldManifest, MacroWorldRegion, MacroWorldSettlement } from './worldMap/WorldMapTypes'

function regionId(region: MacroWorldRegion): string {
  return `r${region.x}-${region.y}`
}

function currentRuntimeRegion(menu: MenuHost): MacroWorldRegion | null {
  return menu.context.map?.worldRegion ?? null
}

function currentRuntimeRegionId(menu: MenuHost): string | null {
  const map = menu.context.map
  if (map?.worldRegionId) return String(map.worldRegionId)
  return map?.worldRegion ? regionId(map.worldRegion) : null
}

function visitedRegionIds(menu: MenuHost): Set<string> {
  const visited = new Set<string>()
  const currentRegion = currentRuntimeRegion(menu)
  if (currentRegion) visited.add(regionId(currentRegion))
  const currentId = currentRuntimeRegionId(menu)
  if (currentId) visited.add(currentId)
  const graph = menu.context.getWorldGraph?.()
  if (!graph) return visited
  for (const node of Object.values(graph.nodes)) {
    const state = menu.context.getCampaignWorldState?.(node.id)
    const stateRegionId = state?.world?.worldRegionId ?? state?.config?.worldRegionId
    if (stateRegionId) visited.add(String(stateRegionId))
  }
  return visited
}

function runtimeManifest(menu: MenuHost): MacroWorldManifest | null {
  const map = menu.context.map
  if (!map?.worldManifest) return null
  return {
    macroPreviewPath: map.worldManifest.macroPreviewPath,
    regionMapSize: map.size,
    regionsHigh: map.worldManifest.regionsHigh,
    regionsWide: map.worldManifest.regionsWide,
    settlements: map.worldManifest.settlements as MacroWorldSettlement[] | undefined,
    maps: map.worldManifest.maps,
  }
}

function worldId(menu: MenuHost): string | null {
  return menu.context.map?.worldId ?? null
}

async function loadMacroWorldManifest(menu: MenuHost): Promise<MacroWorldManifest | null> {
  const id = worldId(menu)
  if (!id) return runtimeManifest(menu)
  try {
    const response = await fetch(`maps/worlds/${id}/manifest.json`, { cache: 'no-store' })
    if (!response.ok) return runtimeManifest(menu)
    return (await response.json()) as MacroWorldManifest
  } catch {
    return runtimeManifest(menu)
  }
}

function previewPath(menu: MenuHost, manifest: MacroWorldManifest): string | null {
  const id = worldId(menu)
  if (!id) return null
  return `maps/worlds/${id}/${manifest.macroPreviewPath ?? 'macro-world-preview.png'}`
}

function regionEntryId(entry: { id?: string; region: MacroWorldRegion }): string {
  return entry.id || regionId(entry.region)
}

function settlementPosition(
  settlement: MacroWorldSettlement,
  manifest: MacroWorldManifest
): { x: number; y: number } | null {
  const regionMapSize = manifest.regionMapSize ?? 144
  const width = Math.max(1, (manifest.regionsWide ?? 1) * regionMapSize)
  const height = Math.max(1, (manifest.regionsHigh ?? 1) * regionMapSize)
  const worldI =
    typeof settlement.world?.i === 'number'
      ? settlement.world.i
      : typeof settlement.region?.y === 'number' && typeof settlement.local?.i === 'number'
        ? settlement.region.y * regionMapSize + settlement.local.i
        : null
  const worldJ =
    typeof settlement.world?.j === 'number'
      ? settlement.world.j
      : typeof settlement.region?.x === 'number' && typeof settlement.local?.j === 'number'
        ? settlement.region.x * regionMapSize + settlement.local.j
        : null
  if (worldI == null || worldJ == null) return null
  return {
    x: Math.max(0, Math.min(100, (worldJ / width) * 100)),
    y: Math.max(0, Math.min(100, (worldI / height) * 100)),
  }
}

function settlementLabel(settlement: MacroWorldSettlement): string {
  if (settlement.kind === 'banditCamp')
    return `${t('worldMapBandits')}${settlement.strength ? ` ${settlement.strength}` : ''}`
  return settlement.civ || settlement.id || ''
}

function regionEntryAtWorldPoint(
  entries: NonNullable<MacroWorldManifest['maps']>,
  manifest: MacroWorldManifest,
  worldI: number,
  worldJ: number
): NonNullable<MacroWorldManifest['maps']>[number] | null {
  const regionMapSize = manifest.regionMapSize ?? 144
  const regionsWide = Math.max(1, manifest.regionsWide ?? 1)
  const regionsHigh = Math.max(1, manifest.regionsHigh ?? 1)
  if (worldI < 0 || worldJ < 0 || worldI >= regionsHigh * regionMapSize || worldJ >= regionsWide * regionMapSize) {
    return null
  }
  const region = {
    x: Math.max(0, Math.min(regionsWide - 1, Math.floor(worldJ / regionMapSize))),
    y: Math.max(0, Math.min(regionsHigh - 1, Math.floor(worldI / regionMapSize))),
  }
  return (
    entries.find(entry => entry.region.x === region.x && entry.region.y === region.y) ?? { region, size: regionMapSize }
  )
}

function flatWorldPointFromEvent(
  evt: MouseEvent,
  overlay: HTMLElement,
  manifest: MacroWorldManifest
): { worldI: number; worldJ: number } | null {
  const rect = overlay.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const regionMapSize = manifest.regionMapSize ?? 144
  const width = Math.max(1, (manifest.regionsWide ?? 1) * regionMapSize)
  const height = Math.max(1, (manifest.regionsHigh ?? 1) * regionMapSize)
  return {
    worldI: ((evt.clientY - rect.top) / rect.height) * height,
    worldJ: ((evt.clientX - rect.left) / rect.width) * width,
  }
}

function attachDebugTeleport(
  target: HTMLElement | SVGSVGElement,
  menu: MenuHost,
  manifest: MacroWorldManifest,
  entries: NonNullable<MacroWorldManifest['maps']>,
  pointFromEvent: (evt: MouseEvent) => { worldI: number; worldJ: number } | null
): void {
  target.addEventListener('click', evt => {
    if (!(evt instanceof MouseEvent)) return
    const point = pointFromEvent(evt)
    if (!point) return
    const entry = regionEntryAtWorldPoint(entries, manifest, point.worldI, point.worldJ)
    if (!entry) return
    menu.closeInventory?.()
    menu.context.debugTeleportWorldMap?.({
      worldI: point.worldI,
      worldJ: point.worldJ,
      worldRegionId: regionEntryId(entry),
    })
  })
}

function renderFlatRegion(
  overlay: HTMLElement,
  entry: NonNullable<MacroWorldManifest['maps']>[number],
  manifest: MacroWorldManifest,
  state: { currentId: string | null; regionsHigh: number; regionsWide: number; visited: Set<string> }
): void {
  const id = regionEntryId(entry)
  const region = entry.region
  const cell = document.createElement('div')
  cell.className = 'worldmap-global-region'
  cell.classList.toggle('visited', state.visited.has(id) || state.visited.has(regionId(region)))
  cell.classList.toggle('current', id === state.currentId || regionId(region) === state.currentId)
  cell.style.left = `${(region.x / state.regionsWide) * 100}%`
  cell.style.top = `${(region.y / state.regionsHigh) * 100}%`
  cell.style.width = `${100 / state.regionsWide}%`
  cell.style.height = `${100 / state.regionsHigh}%`
  const biome = entry.environment ? worldEnvironmentLabel(entry.environment) : entry.dominantBiome
  cell.setAttribute(
    'aria-label',
    [biome, id === state.currentId ? t('worldMapCurrentWorld') : ''].filter(Boolean).join(' | ')
  )
  overlay.appendChild(cell)
}

function alertMessageKey(type: RegionAlertType): string {
  switch (type) {
    case 'populationCapped':
      return 'worldMapAlertPopulationCapped'
    case 'foodLow':
      return 'worldMapAlertFoodLow'
    case 'storageFull':
      return 'worldMapAlertStorageFull'
    case 'workersIdle':
      return 'worldMapAlertWorkersIdle'
  }
}

function regionDisplayLabel(manifest: MacroWorldManifest, regionId: string): string {
  const entry = manifest.maps?.find(candidate => regionEntryId(candidate) === regionId)
  const biome = entry?.environment ? worldEnvironmentLabel(entry.environment) : entry?.dominantBiome
  return biome ? `${t('worldMapColony')} (${biome})` : regionId
}

// Recomputed from the same offline-economy summaries every time the map opens, so an alert
// disappears on its own once the underlying condition is no longer true — nothing to clear.
function renderRegionAlerts(menu: MenuHost, manifest: MacroWorldManifest): HTMLElement | null {
  const active = getActiveColonyAlerts(menu.context)
  if (!active.length) return null
  const lines = active.map(({ regionId, type }) =>
    t(alertMessageKey(type), { region: regionDisplayLabel(manifest, regionId) })
  )

  const box = document.createElement('div')
  box.className = 'worldmap-alerts'
  const title = document.createElement('h3')
  title.className = 'worldmap-alerts-title'
  title.textContent = t('worldMapAlertsTitle')
  box.appendChild(title)
  const list = document.createElement('ul')
  list.className = 'worldmap-alerts-list'
  for (const line of lines) {
    const item = document.createElement('li')
    item.textContent = line
    list.appendChild(item)
  }
  box.appendChild(list)
  return box
}

function renderGlobalMap(panel: HTMLElement, menu: MenuHost, manifest: MacroWorldManifest): void {
  const alerts = renderRegionAlerts(menu, manifest)
  if (alerts) panel.appendChild(alerts)

  const layout = document.createElement('div')
  layout.className = 'worldmap-global-layout'
  const wrap = document.createElement('div')
  wrap.className = 'worldmap-global'
  wrap.classList.add('flat')
  const regionsWide = Math.max(1, manifest.regionsWide ?? 1)
  const regionsHigh = Math.max(1, manifest.regionsHigh ?? 1)
  wrap.classList.toggle('local-square', regionsWide === regionsHigh)
  wrap.style.aspectRatio = `${regionsWide} / ${regionsHigh}`

  const path = previewPath(menu, manifest)
  if (path) {
    const image = document.createElement('img')
    image.className = 'worldmap-global-image'
    image.src = path
    image.alt = ''
    image.draggable = false
    wrap.appendChild(image)
  }

  const overlay = document.createElement('div')
  overlay.className = 'worldmap-global-overlay'
  const visited = visitedRegionIds(menu)
  const currentId = currentRuntimeRegionId(menu)
  const entries: NonNullable<MacroWorldManifest['maps']> = manifest.maps?.length
    ? manifest.maps
    : Array.from({ length: regionsWide * regionsHigh }, (_, index) => ({
        region: { x: index % regionsWide, y: Math.floor(index / regionsWide) },
        size: manifest.regionMapSize ?? 144,
      }))
  attachDebugTeleport(overlay, menu, manifest, entries, evt => flatWorldPointFromEvent(evt, overlay, manifest))

  for (const entry of entries) {
    renderFlatRegion(overlay, entry, manifest, { currentId, regionsHigh, regionsWide, visited })
  }

  renderWorldMapTerritories(overlay, menu, manifest)

  for (const settlement of manifest.settlements ?? []) {
    const position = settlementPosition(settlement, manifest)
    if (!position) continue
    const marker = document.createElement('span')
    marker.className = 'worldmap-global-marker'
    marker.classList.toggle('bandits', settlement.kind === 'banditCamp')
    marker.classList.toggle('village', settlement.kind === 'village' || settlement.kind === 'city')
    marker.style.left = `${position.x}%`
    marker.style.top = `${position.y}%`
    const playerColor = settlementPlayerColor(menu, settlement)
    if (playerColor) marker.style.backgroundColor = playerColor
    marker.setAttribute('aria-label', settlementLabel(settlement))
    overlay.appendChild(marker)
  }

  wrap.appendChild(overlay)
  layout.appendChild(wrap)
  const legend = createWorldMapLegend(menu, manifest)
  if (legend) layout.appendChild(legend)
  panel.appendChild(layout)
}

export function renderInventoryWorldMap(panel: HTMLElement, menu: MenuHost): void {
  panel.replaceChildren()
  menu.clearActionHotkeys()
  const renderId = `${Date.now()}-${Math.random()}`
  panel.dataset.worldmapRenderId = renderId

  const loading = document.createElement('div')
  loading.className = 'worldmap-empty'
  loading.textContent = t('loadingSave')
  panel.appendChild(loading)

  loadMacroWorldManifest(menu).then(manifest => {
    if (panel.dataset.worldmapRenderId !== renderId) return
    panel.replaceChildren()
    if (manifest) {
      renderGlobalMap(panel, menu, manifest)
      return
    }
    const empty = document.createElement('div')
    empty.className = 'worldmap-empty'
    empty.textContent = t('worldMapEmpty')
    panel.appendChild(empty)
  })
}
