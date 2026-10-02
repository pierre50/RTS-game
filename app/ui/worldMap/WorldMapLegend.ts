import { minimapMarkerIcon, settlementMarkerKind, type MinimapMarkerKind } from '../minimap/MinimapMarkerIcons'
import { getInteriorExitCell } from '../../lib/buildings/interiorExits'
import { playerRelation } from '../../lib/combat/playerRelation'
import { isPlayerEliminated } from '../../lib/playerState'
import { isMinimapMarkerHidden, minimapOwnerKey, toggleMinimapMarker } from '../minimap/MinimapFilters'
import { t } from '../../lib/lang'
import { BUILDING_TYPES, PLAYER_TYPES } from '../../constants'
import { worldMapPlayerColor } from './WorldMapPlayerColor'
import { factionIdForCivilization } from '../../lib/campaign/playerRoster'
import { getHexColor } from '../../lib/graphics/colors'
import type { MenuHost } from '../MenuHost'
import type { FactionRelationState, FactionSave } from '../../types/save'
import type { MacroWorldManifest, MacroWorldSettlement } from './WorldMapTypes'

type WorldMapLegendEntry = {
  color: string
  icon?: MinimapMarkerKind
  key: string
  name: string
  relation: FactionRelationState | null
  self?: boolean
  variant?: 'bandits'
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
  const eligible = (player: (typeof menu.context.players)[number]) =>
    player.type !== PLAYER_TYPES.gaia && player.type !== PLAYER_TYPES.bandits
  const players = (menu.context.players ?? []).filter(eligible)
  const factionPlayer = settlement.factionId ? players.find(player => player.factionId === settlement.factionId) : null
  const civilizationPlayer = settlement.civ ? players.find(player => player.civ === settlement.civ) : null
  const indexedPlayer =
    typeof settlement.playerIndex === 'number' && settlement.playerIndex >= 0
      ? menu.context.players?.[settlement.playerIndex]
      : null
  const matchingIndexedPlayer =
    indexedPlayer && eligible(indexedPlayer) && (!settlement.civ || indexedPlayer.civ === settlement.civ)
      ? indexedPlayer
      : null
  return factionPlayer ?? civilizationPlayer ?? matchingIndexedPlayer ?? null
}

/** @public Loaded by tests/world-map-legend.test.cjs (loadTsModule). */
export function settlementPlayerColor(menu: MenuHost, settlement: MacroWorldSettlement): string | null {
  if (settlement.kind !== 'village' && settlement.kind !== 'city') return null

  const player = playerForSettlement(menu, settlement)
  const faction = factionForSettlement(menu, settlement)
  return worldMapPlayerColor(menu, {
    ...player,
    civ: settlement.civ ?? player?.civ,
    factionId: faction?.id ?? player?.factionId,
    color: player?.color ?? faction?.color,
  })
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
      color: getHexColor('black'),
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
  const relation = player ? playerRelation(menu.context, player) : (faction?.relationState ?? 'neutral')
  const key = player ? minimapOwnerKey(player) : (faction?.id ?? settlement.civ ?? settlement.id)
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

export function createWorldMapLegend(
  menu: MenuHost,
  manifest: MacroWorldManifest,
  interactive = false
): HTMLElement | null {
  const entries = new Map<string, WorldMapLegendEntry>()
  const dedupeKeys = new Set<string>()
  for (const settlement of interactive ? [] : (manifest.settlements ?? [])) {
    const entry = legendEntryForSettlement(menu, settlement)
    if (!entry) continue
    const dedupeKey = legendDedupeKey(entry)
    if (entries.has(entry.key) || dedupeKeys.has(dedupeKey)) continue
    entries.set(entry.key, entry)
    dedupeKeys.add(dedupeKey)
  }
  if (interactive) {
    for (const player of menu.context.players ?? []) {
      if (player.type === PLAYER_TYPES.gaia || (player.type === PLAYER_TYPES.bandits && isPlayerEliminated(player)))
        continue
      const key = minimapOwnerKey(player)
      if (entries.has(key)) continue
      entries.set(key, {
        key,
        icon: player.isPlayed ? 'hero' : player.type === PLAYER_TYPES.bandits ? 'camp' : settlementMarkerKind(player),
        color: player.colorHex ?? worldMapPlayerColor(menu, player) ?? '#6ee37a',
        name: player.isPlayed
          ? t('you')
          : player.type === PLAYER_TYPES.bandits
            ? t('worldMapBandits')
            : (player.name ?? t(player.civ ?? player.label)),
        relation: player.isPlayed ? null : playerRelation(menu.context, player),
        variant: player.type === PLAYER_TYPES.bandits ? 'bandits' : undefined,
        self: player.isPlayed,
      })
    }
    const owner = menu.context.player ?? menu.context.players?.find(player => player.isPlayed)
    if (
      owner?.buildings?.some(
        building =>
          building.type === BUILDING_TYPES.townCenter &&
          building.isBuilt !== false &&
          !building.isDead &&
          !building.isDestroyed &&
          (!building.spaceId || building.spaceId === 'outside')
      )
    ) {
      entries.set('base', {
        key: 'base',
        icon: 'home',
        name: t('minimapPlayerBase'),
        color: owner.colorHex,
        relation: null,
        self: true,
      })
    }
    entries.set('caves', { key: 'caves', icon: 'cave', name: t('Cave'), color: '#8f8f8f', relation: null })
    if (getInteriorExitCell(menu.context.map))
      entries.set('exit', { key: 'exit', icon: 'exit', name: t('minimapExit'), color: '#27865c', relation: null })
  }
  if (!entries.size) return null

  const legend = document.createElement('aside')
  legend.className = 'worldmap-legend'
  const title = document.createElement('div')
  title.className = 'worldmap-legend-title'
  title.textContent = t(interactive ? 'minimapMapLegend' : 'worldMapLegend')
  legend.appendChild(title)

  const sortedEntries = [...entries.values()].sort((a, b) => Number(b.self === true) - Number(a.self === true))
  for (const entry of sortedEntries) {
    const row = document.createElement(interactive ? 'button' : 'div')
    row.className = 'worldmap-legend-row'
    if (interactive) {
      row.setAttribute('type', 'button')
      row.classList.add('minimap-legend-toggle')
      const sync = () => {
        const hidden = isMinimapMarkerHidden(menu.context, entry.key)
        row.classList.toggle('is-hidden', hidden)
        row.setAttribute('aria-pressed', String(!hidden))
      }
      sync()
      row.addEventListener('click', () => {
        toggleMinimapMarker(menu.context, entry.key)
        sync()
        menu.updateCameraMiniMap()
      })
    }
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
    if (interactive && entry.icon) {
      const icon = document.createElement('img')
      icon.src = minimapMarkerIcon(entry.icon!)
      swatch.classList.add('minimap-legend-marker')
      icon.alt = ''
      icon.className = 'minimap-legend-icon'
      swatch.appendChild(icon)
    }
    row.append(swatch, name, relation)
    legend.appendChild(row)
  }

  return legend
}
