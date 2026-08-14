import type {
  CampaignSave,
  CampaignWorldSave,
  FactionSave,
  SaveRecord,
  SerializedSave,
  WorldColor,
  WorldGraphNode,
} from '../types/save'

export const CAMPAIGN_SAVE_FORMAT = 'campaign-v1'

type InitialCampaignOptions = {
  color?: WorldColor
  name?: string
  now?: number
  worldId?: string
}

type ChildWorldOptions = InitialCampaignOptions & {
  entryPortalId?: string | null
  factionIds?: string[]
  factions?: Record<string, FactionSave>
  parentWorldId?: string
  returnPortalId?: string | null
}

function fallbackWorldName(world: SerializedSave, worldId: string): string {
  const size = world.world?.size ?? world.config?.size
  return size ? `Monde ${size}` : worldId
}

function createWorldId(world: SerializedSave, now: number): string {
  const seed = world.world?.seed ?? world.config?.seed ?? now
  return `world-${String(seed).replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function worldEnvironment(world: SerializedSave): string | null {
  return world.world?.environment ?? world.config?.environment ?? null
}

function dayNightElapsedMs(world: SerializedSave): number {
  const value = world.runtime?.dayNightElapsedMs
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0
}

function campaignClockFromWorld(world: SerializedSave, now: number) {
  return {
    dayNightElapsedMs: dayNightElapsedMs(world),
    savedAt: now,
  }
}

export function isCampaignSave(save: SaveRecord | unknown): save is CampaignSave {
  return Boolean(
    save &&
      typeof save === 'object' &&
      (save as { format?: unknown }).format === CAMPAIGN_SAVE_FORMAT &&
      typeof (save as { currentWorldId?: unknown }).currentWorldId === 'string'
  )
}

export function createInitialCampaignSave(
  worldState: SerializedSave,
  { color = 'neutral', name, now = Date.now(), worldId }: InitialCampaignOptions = {}
): CampaignSave {
  const id = worldId || createWorldId(worldState, now)
  const worldName = name || fallbackWorldName(worldState, id)
  const world: CampaignWorldSave = {
    id,
    name: worldName,
    color,
    parentWorldId: null,
    entryPortalId: null,
    returnPortalId: null,
    discoveredAt: now,
    visitedAt: now,
    visitedDayNightElapsedMs: dayNightElapsedMs(worldState),
    state: worldState,
  }

  return {
    format: CAMPAIGN_SAVE_FORMAT,
    version: 1,
    clock: campaignClockFromWorld(worldState, now),
    currentWorldId: id,
    heroParty: {
      playerLabel: worldState.players.find(player => player.isPlayed)?.label,
      followerLabels: [],
    },
    factions: {},
    worlds: { [id]: world },
    worldGraph: {
      rootWorldId: id,
      nodes: {
        [id]: {
          id,
          name: worldName,
          color,
          environment: worldEnvironment(worldState),
          factionIds: [],
          parentId: null,
          children: [],
          discoveredAt: now,
          visitedAt: now,
          canTeleport: false,
        },
      },
    },
  }
}

export function getCurrentWorldState(save: SaveRecord): SerializedSave {
  if (!isCampaignSave(save)) return save
  const currentWorld = save.worlds[save.currentWorldId]
  if (!currentWorld) throw new Error('Invalid save file: current campaign world is missing.')
  return currentWorld.state
}

export function updateCurrentWorldState(campaign: CampaignSave, state: SerializedSave, now: number = Date.now()): CampaignSave {
  const currentWorld = campaign.worlds[campaign.currentWorldId]
  if (!currentWorld) throw new Error('Invalid save file: current campaign world is missing.')
  const world = {
    ...currentWorld,
    visitedAt: now,
    visitedDayNightElapsedMs: dayNightElapsedMs(state),
    state,
  }
  const node = campaign.worldGraph.nodes[campaign.currentWorldId]

  return {
    ...campaign,
    clock: campaignClockFromWorld(state, now),
    heroParty: {
      ...campaign.heroParty,
      playerLabel: state.players.find(player => player.isPlayed)?.label ?? campaign.heroParty.playerLabel,
    },
    worlds: {
      ...campaign.worlds,
      [campaign.currentWorldId]: world,
    },
    worldGraph: {
      ...campaign.worldGraph,
      nodes: {
        ...campaign.worldGraph.nodes,
        ...(node
          ? {
              [campaign.currentWorldId]: {
                ...node,
                environment: worldEnvironment(state) ?? node.environment ?? null,
                visitedAt: now,
              },
            }
          : {}),
      },
    },
  }
}

export function addChildWorldToCampaign(
  campaign: CampaignSave,
  childState: SerializedSave,
  {
    color = 'neutral',
    entryPortalId = null,
    factionIds = [],
    factions = {},
    name,
    now = Date.now(),
    parentWorldId = campaign.currentWorldId,
    returnPortalId = null,
    worldId,
  }: ChildWorldOptions = {}
): CampaignSave {
  const parent = campaign.worlds[parentWorldId]
  if (!parent) throw new Error('Invalid save file: parent campaign world is missing.')

  const id = worldId || createWorldId(childState, now)
  const worldName = name || fallbackWorldName(childState, id)
  const existingWorld = campaign.worlds[id]
  const parentNode = campaign.worldGraph.nodes[parentWorldId]
  const existingNode = campaign.worldGraph.nodes[id]
  const nextParentChildren = parentNode?.children.includes(id) ? parentNode.children : [...(parentNode?.children ?? []), id]
  const nextFactionIds = [...new Set([...(existingNode?.factionIds ?? []), ...factionIds])]

  return {
    ...campaign,
    clock: campaignClockFromWorld(childState, now),
    factions: {
      ...(campaign.factions ?? {}),
      ...factions,
    },
    currentWorldId: id,
    heroParty: {
      ...campaign.heroParty,
      playerLabel: childState.players.find(player => player.isPlayed)?.label ?? campaign.heroParty.playerLabel,
    },
    worlds: {
      ...campaign.worlds,
      [id]: {
        id,
        name: existingWorld?.name ?? worldName,
        color: existingWorld?.color ?? color,
        parentWorldId,
        entryPortalId,
        returnPortalId,
        discoveredAt: existingWorld?.discoveredAt ?? now,
        visitedAt: now,
        visitedDayNightElapsedMs: dayNightElapsedMs(childState),
        state: childState,
      },
    },
    worldGraph: {
      ...campaign.worldGraph,
      nodes: {
        ...campaign.worldGraph.nodes,
        ...(parentNode
          ? {
              [parentWorldId]: {
                ...parentNode,
                children: nextParentChildren,
              },
            }
          : {}),
        [id]: {
          id,
          name: existingNode?.name ?? worldName,
          color: existingNode?.color ?? color,
          environment: worldEnvironment(childState) ?? existingNode?.environment ?? null,
          factionIds: nextFactionIds,
          parentId: parentWorldId,
          children: existingNode?.children ?? [],
          discoveredAt: existingNode?.discoveredAt ?? now,
          visitedAt: now,
          canTeleport: existingNode?.canTeleport ?? false,
        },
      },
    },
  }
}

export function returnToParentWorld(campaign: CampaignSave, now: number = Date.now()): CampaignSave {
  const currentWorld = campaign.worlds[campaign.currentWorldId]
  if (!currentWorld?.parentWorldId) return campaign
  const parentWorld = campaign.worlds[currentWorld.parentWorldId]
  if (!parentWorld) throw new Error('Invalid save file: parent campaign world is missing.')
  const parentNode = campaign.worldGraph.nodes[parentWorld.id]

  return {
    ...campaign,
    currentWorldId: parentWorld.id,
    worlds: {
      ...campaign.worlds,
      [parentWorld.id]: {
        ...parentWorld,
        visitedAt: now,
      },
    },
    worldGraph: {
      ...campaign.worldGraph,
      nodes: {
        ...campaign.worldGraph.nodes,
        ...(parentNode
          ? {
              [parentWorld.id]: {
                ...parentNode,
                visitedAt: now,
              },
            }
          : {}),
      },
    },
  }
}

export function enterCampaignWorld(campaign: CampaignSave, worldId: string, now: number = Date.now()): CampaignSave {
  const world = campaign.worlds[worldId]
  if (!world) throw new Error('Invalid save file: target campaign world is missing.')
  const node = campaign.worldGraph.nodes[worldId]

  return {
    ...campaign,
    currentWorldId: worldId,
    worlds: {
      ...campaign.worlds,
      [worldId]: {
        ...world,
        visitedAt: now,
      },
    },
    worldGraph: {
      ...campaign.worldGraph,
      nodes: {
        ...campaign.worldGraph.nodes,
        ...(node
          ? {
              [worldId]: {
                ...node,
                visitedAt: now,
              },
            }
          : {}),
      },
    },
  }
}

export function getWorldTreePath(campaign: CampaignSave, worldId: string = campaign.currentWorldId): WorldGraphNode[] {
  const path: WorldGraphNode[] = []
  const seen = new Set<string>()
  let cursor: string | null | undefined = worldId

  while (cursor) {
    if (seen.has(cursor)) throw new Error('Invalid save file: campaign world graph contains a cycle.')
    seen.add(cursor)
    const node: WorldGraphNode | undefined = campaign.worldGraph.nodes[cursor]
    if (!node) throw new Error('Invalid save file: campaign world graph node is missing.')
    path.unshift(node)
    cursor = node.parentId
  }

  return path
}

export function getVisitedWorldNodes(campaign: CampaignSave): WorldGraphNode[] {
  return Object.values(campaign.worldGraph.nodes).sort((a, b) => a.discoveredAt - b.discoveredAt)
}
