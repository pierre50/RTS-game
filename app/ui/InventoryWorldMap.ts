import { t } from '../lib/lang'
import type { MenuHost } from './MenuHost'

type MacroWorldRegion = { x: number; y: number }
type MacroWorldSettlement = {
  id?: string
  kind?: string
  civ?: string
  strength?: number
  world?: { i?: number; j?: number }
  region?: MacroWorldRegion
  local?: { i?: number; j?: number }
}
type MacroWorldManifest = {
  isoPreview?: {
    halfHeight?: number
    halfWidth?: number
    height?: number
    offsetX?: number
    offsetY?: number
    path?: string
    width?: number
  } | null
  macroIsoPreviewPath?: string
  macroPreviewPath?: string
  regionMapSize?: number
  regionsHigh?: number
  regionsWide?: number
  settlements?: MacroWorldSettlement[]
  maps?: Array<{
    id?: string
    dominantBiome?: string
    environment?: string
    region: MacroWorldRegion
    size: number
    settlements?: MacroWorldSettlement[]
  }>
}
const SVG_NS = 'http://www.w3.org/2000/svg'

function worldEnvironmentLabel(environment?: string | null): string | null {
  switch (environment) {
    case 'Temperate':
      return t('worldMapEnvironmentTemperate')
    case 'BlackForest':
      return t('worldMapEnvironmentBlackForest')
    case 'Jungle':
      return t('worldMapEnvironmentJungle')
    case 'Desert':
      return t('worldMapEnvironmentDesert')
    case 'Steppe':
      return t('worldMapEnvironmentSteppe')
    default:
      return null
  }
}

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
    isoPreview: map.worldManifest.isoPreview,
    macroIsoPreviewPath: map.worldManifest.macroIsoPreviewPath,
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
  return `maps/worlds/${id}/${manifest.macroIsoPreviewPath ?? manifest.isoPreview?.path ?? manifest.macroPreviewPath ?? 'macro-world-preview.png'}`
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
  if (manifest.isoPreview) return isoPoint(worldI, worldJ, manifest)
  return { x: Math.max(0, Math.min(100, (worldJ / width) * 100)), y: Math.max(0, Math.min(100, (worldI / height) * 100)) }
}

function settlementLabel(settlement: MacroWorldSettlement): string {
  if (settlement.kind === 'banditCamp') return `${t('worldMapBandits')}${settlement.strength ? ` ${settlement.strength}` : ''}`
  return settlement.civ || settlement.id || ''
}

function isoViewBox(manifest: MacroWorldManifest): { width: number; height: number } | null {
  const preview = manifest.isoPreview
  if (!preview?.width || !preview.height) return null
  return { width: preview.width, height: preview.height }
}

function isoPoint(worldI: number, worldJ: number, manifest: MacroWorldManifest): { x: number; y: number } | null {
  const preview = manifest.isoPreview
  if (!preview?.halfWidth || !preview.halfHeight || preview.offsetX == null || preview.offsetY == null) return null
  return {
    x: (worldI - worldJ) * preview.halfWidth + preview.offsetX,
    y: (worldI + worldJ) * preview.halfHeight + preview.offsetY,
  }
}

function isoRegionPoints(region: MacroWorldRegion, manifest: MacroWorldManifest): string | null {
  const regionMapSize = manifest.regionMapSize ?? 144
  const topLeft = isoPoint(region.y * regionMapSize, region.x * regionMapSize, manifest)
  const topRight = isoPoint(region.y * regionMapSize, (region.x + 1) * regionMapSize, manifest)
  const bottomRight = isoPoint((region.y + 1) * regionMapSize, (region.x + 1) * regionMapSize, manifest)
  const bottomLeft = isoPoint((region.y + 1) * regionMapSize, region.x * regionMapSize, manifest)
  if (!topLeft || !topRight || !bottomRight || !bottomLeft) return null
  return [topLeft, topRight, bottomRight, bottomLeft].map(point => `${point.x},${point.y}`).join(' ')
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(tagName: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tagName)
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
  return entries.find(entry => entry.region.x === region.x && entry.region.y === region.y) ?? { region, size: regionMapSize }
}

function isoWorldPointFromEvent(
  evt: MouseEvent,
  svg: SVGSVGElement,
  manifest: MacroWorldManifest
): { worldI: number; worldJ: number } | null {
  const preview = manifest.isoPreview
  const matrix = svg.getScreenCTM()
  if (!preview?.halfWidth || !preview.halfHeight || preview.offsetX == null || preview.offsetY == null || !matrix) return null
  const point = svg.createSVGPoint()
  point.x = evt.clientX
  point.y = evt.clientY
  const local = point.matrixTransform(matrix.inverse())
  const isoX = (local.x - preview.offsetX) / preview.halfWidth
  const isoY = (local.y - preview.offsetY) / preview.halfHeight
  return {
    worldI: (isoX + isoY) / 2,
    worldJ: (isoY - isoX) / 2,
  }
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
  cell.title = [biome, id === state.currentId ? t('worldMapCurrentWorld') : ''].filter(Boolean).join(' | ')
  overlay.appendChild(cell)
}

function renderGlobalMap(panel: HTMLElement, menu: MenuHost, manifest: MacroWorldManifest): void {
  const wrap = document.createElement('div')
  const viewBox = isoViewBox(manifest)
  wrap.className = 'worldmap-global'
  wrap.classList.toggle('iso', Boolean(viewBox))
  wrap.classList.toggle('flat', !viewBox)

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
  const svg = viewBox ? createSvgElement('svg') : null
  if (svg && viewBox) {
    svg.setAttribute('class', 'worldmap-global-svg')
    svg.setAttribute('viewBox', `0 0 ${viewBox.width} ${viewBox.height}`)
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    overlay.appendChild(svg)
  }
  const regionsWide = Math.max(1, manifest.regionsWide ?? 1)
  const regionsHigh = Math.max(1, manifest.regionsHigh ?? 1)
  const visited = visitedRegionIds(menu)
  const currentId = currentRuntimeRegionId(menu)
  const entries: NonNullable<MacroWorldManifest['maps']> = manifest.maps?.length
    ? manifest.maps
    : Array.from({ length: regionsWide * regionsHigh }, (_, index) => ({
        region: { x: index % regionsWide, y: Math.floor(index / regionsWide) },
        size: manifest.regionMapSize ?? 144,
      }))
  if (svg) {
    attachDebugTeleport(svg, menu, manifest, entries, evt => isoWorldPointFromEvent(evt, svg, manifest))
  } else {
    attachDebugTeleport(overlay, menu, manifest, entries, evt => flatWorldPointFromEvent(evt, overlay, manifest))
  }

  for (const entry of entries) {
    const id = regionEntryId(entry)
    const region = entry.region
    const biome = entry.environment ? worldEnvironmentLabel(entry.environment) : entry.dominantBiome
    const title = [biome, id === currentId ? t('worldMapCurrentWorld') : ''].filter(Boolean).join(' | ')
    const points = svg ? isoRegionPoints(region, manifest) : null
    if (!svg || !points) {
      renderFlatRegion(overlay, entry, manifest, { currentId, regionsHigh, regionsWide, visited })
      continue
    }
    const cell = createSvgElement('polygon')
    cell.setAttribute('class', [
      'worldmap-global-region',
      visited.has(id) || visited.has(regionId(region)) ? 'visited' : '',
      id === currentId || regionId(region) === currentId ? 'current' : '',
    ].filter(Boolean).join(' '))
    cell.setAttribute('points', points)
    const titleEl = createSvgElement('title')
    titleEl.textContent = title
    cell.appendChild(titleEl)
    svg.appendChild(cell)
  }

  for (const settlement of manifest.settlements ?? []) {
    const position = settlementPosition(settlement, manifest)
    if (!position) continue
    if (svg) {
      const marker = createSvgElement(settlement.kind === 'banditCamp' ? 'rect' : 'circle')
      marker.setAttribute(
        'class',
        `worldmap-global-marker ${settlement.kind === 'banditCamp' ? 'bandits' : 'village'}`
      )
      if (settlement.kind === 'banditCamp') {
        marker.setAttribute('x', String(position.x - 4.5))
        marker.setAttribute('y', String(position.y - 4.5))
        marker.setAttribute('width', '9')
        marker.setAttribute('height', '9')
        marker.setAttribute('transform', `rotate(45 ${position.x} ${position.y})`)
      } else {
        marker.setAttribute('cx', String(position.x))
        marker.setAttribute('cy', String(position.y))
        marker.setAttribute('r', '5')
      }
      const titleEl = createSvgElement('title')
      titleEl.textContent = settlementLabel(settlement)
      marker.appendChild(titleEl)
      svg.appendChild(marker)
      continue
    }
    const marker = document.createElement('span')
    marker.className = 'worldmap-global-marker'
    marker.classList.toggle('bandits', settlement.kind === 'banditCamp')
    marker.classList.toggle('village', settlement.kind === 'village' || settlement.kind === 'city')
    marker.style.left = `${position.x}%`
    marker.style.top = `${position.y}%`
    marker.title = settlementLabel(settlement)
    overlay.appendChild(marker)
  }

  wrap.appendChild(overlay)
  panel.appendChild(wrap)
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
