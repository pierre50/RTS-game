import { t } from '../../lib/lang'
import { factionIdForCivilization } from '../../lib/campaign/playerRoster'
import { getHexColor } from '../../lib/graphics/colors'
import type { MenuHost } from '../MenuHost'
import type { FactionRelationState, FactionSave } from '../../types/save'
import type { MacroWorldManifest, MacroWorldSettlement } from './WorldMapTypes'

type WorldMapLegendEntry = {
  color: string
  key: string
  name: string
  relation: FactionRelationState | null
  self?: boolean
  variant?: 'bandits'
}

function cssColor(color: string | null | undefined): string | null {
  if (!color) return null
  return color.startsWith('#') ? color : getHexColor(color)
}

function factionForSettlement(menu: MenuHost, settlement: MacroWorldSettlement): FactionSave | null {
  const factions = menu.context.getCampaignFactions?.()
  return (
    (settlement.factionId ? factions?.[settlement.factionId] : null) ??
    (settlement.civ ? factions?.[factionIdForCivilization(settlement.civ)] : null) ??
    (settlement.civ ? Object.values(factions ?? {}).find(entry => entry.civilization === settlement.civ) : null) ??
    null
  )
}

function playerForSettlement(menu: MenuHost, settlement: MacroWorldSettlement) {
  const players = menu.context.players ?? []
  const civilizationPlayer = settlement.civ ? players.find(player => player.civ === settlement.civ) : null
  const indexedPlayer =
    typeof settlement.playerIndex === 'number' && settlement.playerIndex >= 0 ? players[settlement.playerIndex] : null
  const matchingIndexedPlayer =
    indexedPlayer && (!settlement.civ || indexedPlayer.civ === settlement.civ) ? indexedPlayer : null
  return civilizationPlayer ?? matchingIndexedPlayer ?? null
}

export function settlementPlayerColor(menu: MenuHost, settlement: MacroWorldSettlement): string | null {
  if (settlement.kind !== 'village' && settlement.kind !== 'city') return null

  const player = playerForSettlement(menu, settlement)
  const playerColor = cssColor(player?.colorHex ?? player?.color)
  if (playerColor) return playerColor

  const faction = factionForSettlement(menu, settlement)
  return cssColor(faction?.color)
}

function relationLabel(relation: FactionRelationState): string {
  const keys: Record<FactionRelationState, string> = {
    allied: 'worldMapRelationAllied',
    friendly: 'worldMapRelationFriendly',
    hostile: 'worldMapRelationHostile',
    neutral: 'worldMapRelationNeutral',
    wary: 'worldMapRelationWary',
  }
  return t(keys[relation])
}

function legendEntryForSettlement(menu: MenuHost, settlement: MacroWorldSettlement): WorldMapLegendEntry | null {
  if (settlement.kind === 'banditCamp') {
    return {
      color: getHexColor('grey'),
      key: 'bandits',
      name: t('worldMapBandits'),
      relation: 'hostile',
      variant: 'bandits',
    }
  }
  if (settlement.kind !== 'village' && settlement.kind !== 'city') return null

  const player = playerForSettlement(menu, settlement)
  const faction = factionForSettlement(menu, settlement)
  const color = settlementPlayerColor(menu, settlement) ?? '#6ee37a'
  const relation = player?.isPlayed ? 'allied' : (faction?.relationState ?? player?.diplomacy ?? 'neutral')
  const key = player?.isPlayed ? 'self' : (faction?.id ?? player?.factionId ?? settlement.civ ?? settlement.id)
  if (!key) return null

  return {
    color,
    key,
    name: player?.isPlayed ? t('you') : (faction?.name ?? player?.name ?? settlement.civ ?? settlement.id ?? ''),
    relation: player?.isPlayed ? null : relation,
    self: player?.isPlayed === true,
  }
}

function legendDedupeKey(entry: WorldMapLegendEntry): string {
  if (entry.self) return 'self'
  if (entry.variant === 'bandits') return 'bandits'
  return `${entry.variant ?? 'player'}:${entry.name.trim().toLowerCase()}`
}

export function createWorldMapLegend(menu: MenuHost, manifest: MacroWorldManifest): HTMLElement | null {
  const entries = new Map<string, WorldMapLegendEntry>()
  const dedupeKeys = new Set<string>()
  for (const settlement of manifest.settlements ?? []) {
    const entry = legendEntryForSettlement(menu, settlement)
    if (!entry) continue
    const dedupeKey = legendDedupeKey(entry)
    if (entries.has(entry.key) || dedupeKeys.has(dedupeKey)) continue
    entries.set(entry.key, entry)
    dedupeKeys.add(dedupeKey)
  }
  if (!entries.size) return null

  const legend = document.createElement('aside')
  legend.className = 'worldmap-legend'
  const title = document.createElement('div')
  title.className = 'worldmap-legend-title'
  title.textContent = t('worldMapLegend')
  legend.appendChild(title)

  const sortedEntries = [...entries.values()].sort((a, b) => Number(b.self === true) - Number(a.self === true))
  for (const entry of sortedEntries) {
    const row = document.createElement('div')
    row.className = 'worldmap-legend-row'
    const swatch = document.createElement('span')
    swatch.className = 'worldmap-legend-swatch'
    swatch.classList.toggle('bandits', entry.variant === 'bandits')
    swatch.style.backgroundColor = entry.color
    const name = document.createElement('span')
    name.className = 'worldmap-legend-name'
    name.textContent = entry.name
    const relation = document.createElement('span')
    relation.className = `worldmap-legend-relation${entry.relation ? ` ${entry.relation}` : ''}`
    relation.textContent = entry.relation ? relationLabel(entry.relation) : ''
    row.append(swatch, name, relation)
    legend.appendChild(row)
  }

  return legend
}
