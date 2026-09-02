import { CIVILIZATIONS } from '../../config/civilizations'
import { playerColors } from '../graphics/colors'
import { createFactionSave, FACTION_SCORE } from '../combat/factions'
import type { CampaignSave, FactionSave, PortalEncounterKind } from '../../types/save'
import type { PlayerLike } from '../../types/player'

export const BANDIT_FACTION_ID = 'bandits'
export const BANDIT_FACTION_NAME = 'Bandits'
export const BANDIT_FACTION_COLOR = 'grey'

const GLOBAL_FACTION_COLORS = [...new Set(['blue', ...playerColors])]

function stableHash(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function slugId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function factionIdForCivilization(civilization: string): string {
  return `civ-${slugId(civilization) || 'unknown'}`
}

function heroCivilizationFromCampaign(campaign: CampaignSave): string | null {
  const rootWorld = campaign.worlds[campaign.worldGraph.rootWorldId]?.state
  const currentWorld = campaign.worlds[campaign.currentWorldId]?.state
  const played =
    rootWorld?.players?.find(player => player.isPlayed) ?? currentWorld?.players?.find(player => player.isPlayed)
  return played?.civ ?? null
}

function heroColorFromCampaign(campaign: CampaignSave): string | null {
  const rootWorld = campaign.worlds[campaign.worldGraph.rootWorldId]?.state
  const currentWorld = campaign.worlds[campaign.currentWorldId]?.state
  const played =
    rootWorld?.players?.find(player => player.isPlayed) ?? currentWorld?.players?.find(player => player.isPlayed)
  return played?.color ?? null
}

function randomAICiv(): string {
  return CIVILIZATIONS[Math.floor(Math.random() * CIVILIZATIONS.length)]?.value || 'Greek'
}

function randomPlayerColorExcept(excludedColor?: string | null): string {
  const pool = playerColors.filter(playerColor => playerColor !== excludedColor)
  return pool[Math.floor(Math.random() * pool.length)] || 'red'
}

function createUndiscoveredFaction(options: {
  civilization?: string
  color?: string
  homeWorldId: string
  id: string
  initialScore: number
  name?: string
  now: number
}): FactionSave {
  return {
    ...createFactionSave(options),
    color: options.color,
    knownWorldIds: [],
  }
}

function rosterFactionsForCampaign(campaign: CampaignSave, now: number): Record<string, FactionSave> {
  const homeWorldId = campaign.worldGraph.rootWorldId || campaign.currentWorldId
  const heroCiv = heroCivilizationFromCampaign(campaign)
  const heroColor = heroColorFromCampaign(campaign)
  const availableColors = GLOBAL_FACTION_COLORS.filter(color => color !== heroColor && color !== BANDIT_FACTION_COLOR)
  const colorOffset = stableHash(`${homeWorldId}:${heroCiv ?? ''}:colors`) % Math.max(1, availableColors.length)
  const factionColor = (index: number) =>
    availableColors.length ? availableColors[(colorOffset + index) % availableColors.length] : undefined
  const factions: Record<string, FactionSave> = {}
  let aiCivilizationIndex = 0

  for (const civilization of CIVILIZATIONS) {
    const civ = civilization.value
    if (heroCiv && civ === heroCiv) continue
    const id = factionIdForCivilization(civ)
    const currentIndex = aiCivilizationIndex++
    const initialScore = currentIndex % 2 === 0 ? FACTION_SCORE.neutral : FACTION_SCORE.hostile
    factions[id] = createUndiscoveredFaction({
      civilization: civ,
      color: factionColor(currentIndex),
      homeWorldId,
      id,
      initialScore,
      now,
    })
  }

  factions[BANDIT_FACTION_ID] = createUndiscoveredFaction({
    color: BANDIT_FACTION_COLOR,
    homeWorldId,
    id: BANDIT_FACTION_ID,
    initialScore: FACTION_SCORE.hostile,
    name: BANDIT_FACTION_NAME,
    now,
  })

  return factions
}

export function ensureCampaignPlayerRoster(campaign: CampaignSave, now: number = Date.now()): CampaignSave {
  const existing = campaign.factions ?? {}
  const roster = rosterFactionsForCampaign(campaign, now)
  const nextFactions = { ...existing }
  let changed = false
  for (const [id, faction] of Object.entries(roster)) {
    if (!nextFactions[id]) {
      nextFactions[id] = faction
      changed = true
      continue
    }
    if (!nextFactions[id].color) {
      nextFactions[id] = { ...nextFactions[id], color: faction.color }
      changed = true
    }
  }
  if (!changed) return campaign
  return {
    ...campaign,
    factions: nextFactions,
  }
}

function factionWithDiscovery(faction: FactionSave, worldId: string, now: number): FactionSave {
  const knownWorldIds = faction.knownWorldIds ?? []
  const alreadyKnown = knownWorldIds.includes(worldId)
  const isFirstDiscovery = knownWorldIds.length === 0
  const relationSeed = createFactionSave({
    civilization: faction.civilization,
    homeWorldId: faction.homeWorldId,
    id: faction.id,
    initialScore: faction.relationScore,
    name: faction.name,
    now,
  })

  return {
    ...faction,
    relationScore: relationSeed.relationScore,
    relationState: relationSeed.relationState,
    knownWorldIds: alreadyKnown ? knownWorldIds : [...knownWorldIds, worldId],
    discoveredAt: isFirstDiscovery ? now : faction.discoveredAt,
    updatedAt: now,
  }
}

export function pickCampaignPortalFaction(options: {
  campaign?: CampaignSave | null
  encounter: PortalEncounterKind
  player: PlayerLike
  portalColor: 'blue' | 'yellow' | 'red'
  now: number
  worldId: string
}): FactionSave {
  const { campaign, encounter, now, player, portalColor, worldId } = options
  const roster = campaign ? ensureCampaignPlayerRoster(campaign, now).factions ?? {} : {}
  const fallbackCiv = randomAICiv()
  if (encounter === 'bandit') {
    const bandits =
      roster[BANDIT_FACTION_ID] ??
      createUndiscoveredFaction({
        color: BANDIT_FACTION_COLOR,
        homeWorldId: campaign?.worldGraph.rootWorldId ?? worldId,
        id: BANDIT_FACTION_ID,
        initialScore: FACTION_SCORE.hostile,
        name: BANDIT_FACTION_NAME,
        now,
      })
    return factionWithDiscovery(bandits, worldId, now)
  }

  const heroCiv = player.civ ?? null
  const factions = Object.values(roster).filter(
    faction => faction.id !== BANDIT_FACTION_ID && (!heroCiv || faction.civilization !== heroCiv)
  )
  const undiscovered = factions.filter(faction => !(faction.knownWorldIds ?? []).length)
  const pool = undiscovered.length ? undiscovered : factions
  const selected = pool.length ? pool[stableHash(`${worldId}:${portalColor}`) % pool.length] : null
  const faction =
    selected ??
    (() => {
      const id = factionIdForCivilization(fallbackCiv)
      return createUndiscoveredFaction({
        civilization: fallbackCiv,
        color: randomPlayerColorExcept(player.color),
        homeWorldId: campaign?.worldGraph.rootWorldId ?? worldId,
        id,
        initialScore: stableHash(id) % 2 === 0 ? FACTION_SCORE.neutral : FACTION_SCORE.hostile,
        now,
      })
    })()
  return factionWithDiscovery(faction, worldId, now)
}
