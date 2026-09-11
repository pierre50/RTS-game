import { findMapTerritoryOwner, territoryPlayerKey, type TerritoryPlayer } from '../../lib/campaign/mapTerritory'
import { factionIdForCivilization } from '../../lib/campaign/playerRoster'
import { worldMapPlayerColor } from './WorldMapPlayerColor'
import type { MenuHost } from '../MenuHost'
import type { MacroWorldManifest, MacroWorldRegion, MacroWorldSettlement } from './WorldMapTypes'
import { settlementPlayerColor } from './WorldMapLegend'

type Territory = { key: string; color: string; region: MacroWorldRegion }

function ownerTerritory(menu: MenuHost, owner: TerritoryPlayer | null, region: MacroWorldRegion): Territory | null {
  if (!owner) return null
  const key = owner.factionId || (owner.civ ? factionIdForCivilization(owner.civ) : territoryPlayerKey(owner))
  const color = worldMapPlayerColor(menu, owner)
  return key && color ? { key, color, region } : null
}

function settlementsInRegion(manifest: MacroWorldManifest, region: MacroWorldRegion): MacroWorldSettlement[] {
  return (manifest.settlements ?? []).filter(
    settlement => settlement.region?.x === region.x && settlement.region?.y === region.y
  )
}

export function resolveWorldMapTerritories(menu: MenuHost, manifest: MacroWorldManifest): Territory[] {
  const { context } = menu
  const savedRegions = new Map<string, TerritoryPlayer[]>()
  const graph = context.getWorldGraph?.()
  for (const node of Object.values(graph?.nodes ?? {})) {
    const state = context.getCampaignWorldState?.(node.id)
    const id = state?.world?.worldRegionId ?? state?.config?.worldRegionId
    if (id && state) savedRegions.set(id, state.players)
  }
  const territories: Territory[] = []
  const entries = manifest.maps?.length
    ? manifest.maps
    : Array.from({ length: (manifest.regionsWide ?? 1) * (manifest.regionsHigh ?? 1) }, (_, index) => ({
        region: { x: index % (manifest.regionsWide ?? 1), y: Math.floor(index / (manifest.regionsWide ?? 1)) },
        id: undefined,
        settlements: undefined,
      }))
  for (const entry of entries) {
    const { region } = entry
    const id = entry.id ?? `r${region.x}-${region.y}`
    const settlements = entry.settlements ?? settlementsInRegion(manifest, region)
    const current =
      context.map.worldRegionId === id ||
      (context.map.worldRegion?.x === region.x && context.map.worldRegion?.y === region.y)
    const players = current ? context.players : (savedRegions.get(id) ?? savedRegions.get(`r${region.x}-${region.y}`))
    if (players) {
      const territory = ownerTerritory(menu, findMapTerritoryOwner<TerritoryPlayer>(players, settlements), region)
      if (territory) territories.push(territory)
      continue
    }
    // Only unexplored regions use their initial settlement owner.
    const settlement = settlements.find(candidate => candidate.kind === 'village' || candidate.kind === 'city')
    if (!settlement) continue
    const color = settlementPlayerColor(menu, settlement)
    const key = settlement.factionId || (settlement.civ ? factionIdForCivilization(settlement.civ) : null)
    if (key && color) territories.push({ key, color, region })
  }
  return territories
}

export function territoryBoundaryPaths(
  territories: readonly Territory[]
): Array<{ key: string; color: string; path: string }> {
  const owners = new Map(territories.map(territory => [`${territory.region.x},${territory.region.y}`, territory.key]))
  const paths = new Map<string, { key: string; color: string; path: string }>()
  for (const {
    key,
    color,
    region: { x, y },
  } of territories) {
    const boundary = paths.get(key) ?? { key, color, path: '' }
    if (owners.get(`${x},${y - 1}`) !== key) boundary.path += `M${x},${y}H${x + 1}`
    if (owners.get(`${x + 1},${y}`) !== key) boundary.path += `M${x + 1},${y}V${y + 1}`
    if (owners.get(`${x},${y + 1}`) !== key) boundary.path += `M${x + 1},${y + 1}H${x}`
    if (owners.get(`${x - 1},${y}`) !== key) boundary.path += `M${x},${y + 1}V${y}`
    paths.set(key, boundary)
  }
  return [...paths.values()]
}

let territoryRenderId = 0

export function renderWorldMapTerritories(overlay: HTMLElement, menu: MenuHost, manifest: MacroWorldManifest): void {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.classList.add('worldmap-territories')
  svg.setAttribute('viewBox', `0 0 ${Math.max(1, manifest.regionsWide ?? 1)} ${Math.max(1, manifest.regionsHigh ?? 1)}`)
  svg.setAttribute('preserveAspectRatio', 'none')
  svg.setAttribute('aria-hidden', 'true')
  const territories = resolveWorldMapTerritories(menu, manifest)
  const renderId = ++territoryRenderId
  for (const [index, boundary] of territoryBoundaryPaths(territories).entries()) {
    // Clip each stroke to its own side so both colors remain visible at shared borders.
    const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath')
    const clipId = `worldmap-territory-${renderId}-${index}`
    clip.setAttribute('id', clipId)
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse')
    for (const territory of territories.filter(candidate => candidate.key === boundary.key)) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      rect.setAttribute('x', String(territory.region.x))
      rect.setAttribute('y', String(territory.region.y))
      rect.setAttribute('width', '1')
      rect.setAttribute('height', '1')
      clip.appendChild(rect)
    }
    svg.appendChild(clip)
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', boundary.path)
    path.setAttribute('stroke', boundary.color)
    path.setAttribute('fill', 'none')
    path.setAttribute('clip-path', `url(#${clipId})`)
    path.setAttribute('stroke-width', '6')
    path.setAttribute('stroke-linecap', 'square')
    path.setAttribute('vector-effect', 'non-scaling-stroke')
    svg.appendChild(path)
  }
  overlay.appendChild(svg)
}
