import { t } from '../lib/lang'
import type { FactionRelationState, FactionSave, WorldColor, WorldGraphNode, WorldGraphSave } from '../types/save'
import type { MenuHost } from './MenuHost'

function worldColorLabel(color: WorldColor): string {
  switch (color) {
    case 'blue':
      return t('worldMapBluePortal')
    case 'yellow':
      return t('worldMapYellowPortal')
    case 'red':
      return t('worldMapRedPortal')
    default:
      return t('worldMapRoot')
  }
}

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

function factionRelationIcon(state: FactionRelationState): string {
  switch (state) {
    case 'hostile':
      return '⚔'
    case 'wary':
      return '!'
    case 'friendly':
      return '♥'
    case 'allied':
      return '♥♥'
    default:
      return '○'
  }
}

function factionRelationText(state: FactionRelationState): string {
  switch (state) {
    case 'hostile':
      return t('worldMapRelationHostile')
    case 'wary':
      return t('worldMapRelationWary')
    case 'friendly':
      return t('worldMapRelationFriendly')
    case 'allied':
      return t('worldMapRelationAllied')
    default:
      return t('worldMapRelationNeutral')
  }
}

function factionRelationLabel(faction: FactionSave): string {
  return `${factionRelationIcon(faction.relationState)} ${factionRelationText(faction.relationState)} ${faction.relationScore}`
}

function shouldShowBanditEncounter(node: WorldGraphNode): boolean {
  return node.encounter === 'bandit' && !node.banditsCleared
}

function nodeFactions(menu: MenuHost, node: WorldGraphNode): FactionSave[] {
  if (shouldShowBanditEncounter(node)) return []
  return (node.factionIds ?? [])
    .map(id => menu.context.getCampaignFactions?.()?.[id])
    .filter(Boolean) as FactionSave[]
}

function appendFactionBadges(body: HTMLElement, menu: MenuHost, node: WorldGraphNode): void {
  const factions = nodeFactions(menu, node)
  if (factions.length) {
    const factionList = document.createElement('span')
    factionList.className = 'worldmap-node-factions'
    for (const faction of factions) {
      const badge = document.createElement('span')
      badge.className = `worldmap-faction worldmap-faction-${faction.relationState}`
      const civ = faction.civilization ? ` | ${faction.civilization}` : ''
      badge.textContent = `${factionRelationLabel(faction)} | ${faction.name}${civ}`
      factionList.appendChild(badge)
    }
    body.appendChild(factionList)
  }

  if (!shouldShowBanditEncounter(node)) return
  const factionList = document.createElement('span')
  factionList.className = 'worldmap-node-factions'
  const badge = document.createElement('span')
  badge.className = 'worldmap-faction worldmap-faction-hostile'
  badge.textContent = `⚔ ${t('worldMapBandits')}`
  factionList.appendChild(badge)
  body.appendChild(factionList)
}

function createNodeMeta(node: WorldGraphNode, currentWorldId: string | null): HTMLSpanElement {
  const meta = document.createElement('span')
  meta.className = 'worldmap-node-meta'
  const parts = [worldColorLabel(node.color)]
  const environmentLabel = worldEnvironmentLabel(node.environment)
  if (environmentLabel) parts.push(environmentLabel)
  if (node.id === currentWorldId) parts.push(t('worldMapCurrentWorld'))
  if (node.canTeleport) parts.push(t('worldMapTeleportAvailable'))
  meta.textContent = parts.join(' | ')
  return meta
}

function renderWorldMapNode(
  menu: MenuHost,
  graph: WorldGraphSave,
  node: WorldGraphNode,
  currentWorldId: string | null,
  depth = 0
): HTMLLIElement {
  const item = document.createElement('li')
  item.className = 'worldmap-node'
  item.style.setProperty('--worldmap-depth', String(depth))
  item.classList.toggle('current', node.id === currentWorldId)
  item.classList.add(`worldmap-node-${node.color}`)

  const row = document.createElement('div')
  row.className = 'worldmap-node-row'

  const marker = document.createElement('span')
  marker.className = 'worldmap-node-marker'
  marker.setAttribute('aria-hidden', 'true')

  const body = document.createElement('span')
  body.className = 'worldmap-node-body'

  const name = document.createElement('span')
  name.className = 'worldmap-node-name'
  name.textContent = node.name

  body.appendChild(name)
  body.appendChild(createNodeMeta(node, currentWorldId))
  appendFactionBadges(body, menu, node)

  row.appendChild(marker)
  row.appendChild(body)
  item.appendChild(row)

  const children = node.children.map(id => graph.nodes[id]).filter(Boolean)
  if (children.length) {
    const list = document.createElement('ul')
    list.className = 'worldmap-children'
    children.forEach(child => list.appendChild(renderWorldMapNode(menu, graph, child, currentWorldId, depth + 1)))
    item.appendChild(list)
  }

  return item
}

export function renderInventoryWorldMap(panel: HTMLElement, menu: MenuHost): void {
  panel.replaceChildren()
  menu.clearActionHotkeys()

  const graph = menu.context.getWorldGraph?.()
  const root = graph ? graph.nodes[graph.rootWorldId] : null
  if (!graph || !root) {
    const empty = document.createElement('div')
    empty.className = 'worldmap-empty'
    empty.textContent = t('worldMapEmpty')
    panel.appendChild(empty)
    return
  }

  const tree = document.createElement('ul')
  tree.className = 'worldmap-tree'
  tree.appendChild(renderWorldMapNode(menu, graph, root, menu.context.getCurrentWorldId?.() ?? null))
  panel.appendChild(tree)
}
