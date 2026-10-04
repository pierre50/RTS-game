import { respawnBanditCamp } from '../../classes/map/BanditCampGeneration'
import type { MapGenerationMap } from '../../classes/map/MapGenerationTypes'
import { PLAYER_TYPES } from '../../constants'
import { campRespawnStates, type CampRespawnState } from '../../lib/camps/campRespawnState'
import { isUnitAlive } from '../../lib/playerState'
import { findInstancePath } from '../Pathfinding'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { GridPosition } from '../../types/grid'
import type { QuestInstance } from '../../types/quest'

function livingCampGuards(context: GameContextLike, position: GridPosition): UnitEntity[] {
  return (context.players ?? [])
    .filter(owner => owner.type === PLAYER_TYPES.bandits)
    .flatMap(owner => owner.units ?? [])
    .filter(unit => {
      const anchor = unit.campPatrolAnchor ?? unit.banditCampAnchor
      return (
        isUnitAlive(unit) &&
        (unit.campBehavior?.homeSpaceId ?? 'outside') === 'outside' &&
        anchor?.i === position.i &&
        anchor.j === position.j
      )
    })
}

function villageOrigin(npc: UnitEntity): GridPosition {
  const owner = npc.owner
  if (owner && Number.isInteger(owner.i) && Number.isInteger(owner.j)) return owner
  return npc
}

function candidates(context: GameContextLike, npc: UnitEntity, quest?: QuestInstance) {
  const origin = villageOrigin(npc)
  // Scale with the region, while keeping missions local even on continent maps.
  const radius = Math.max(80, Math.min(256, context.map.grid.length / 4))
  const reserved = (context.getQuestJournal?.()?.quests ?? [])
    .filter(
      other =>
        other.id !== quest?.id &&
        other.status === 'active' &&
        !other.facts.campCleared &&
        other.regionId === (context.map.worldRegionId ?? context.getCurrentWorldId?.())
    )
    .map(other => other.encounters?.bandits?.position)
    .filter(Boolean)
  const sites = new Map<string, GridPosition & { state?: CampRespawnState }>()
  for (const state of campRespawnStates(context.map)) sites.set(`${state.i}:${state.j}`, { ...state, state })
  // Older saves and former quest camps can still have living, anchored guards.
  for (const owner of context.players ?? []) {
    if (owner.type !== PLAYER_TYPES.bandits) continue
    for (const unit of owner.units ?? []) {
      const anchor = unit.campPatrolAnchor ?? unit.banditCampAnchor
      if (anchor && isUnitAlive(unit) && !sites.has(`${anchor.i}:${anchor.j}`))
        sites.set(`${anchor.i}:${anchor.j}`, anchor)
    }
  }
  return [...sites.values()]
    .filter(
      site =>
        Math.hypot(site.i - origin.i, site.j - origin.j) <= radius &&
        !reserved.some(position => position?.i === site.i && position.j === site.j)
    )
    .map(site => ({ ...site, guards: livingCampGuards(context, site) }))
    .filter(site => site.guards.length || site.state?.unitTypes.length)
    .sort(
      (a, b) =>
        Number(Boolean(b.guards.length)) - Number(Boolean(a.guards.length)) ||
        Math.hypot(a.i - origin.i, a.j - origin.j) - Math.hypot(b.i - origin.i, b.j - origin.j)
    )
}

function reachable(context: GameContextLike, npc: UnitEntity, site: GridPosition): boolean {
  // Village coordinates can be underneath its town hall; start on the chief's actual approach.
  const origin =
    npc.spaceId && npc.spaceId !== 'outside'
      ? context.map.spaces?.get(npc.spaceId)?.portals?.find(portal => portal.targetSpaceId === 'outside')?.targetCell
      : npc
  if (!origin) return false
  const approaches = []
  for (let di = -5; di <= 5; di++)
    for (let dj = -5; dj <= 5; dj++) {
      const cell = context.map.grid[site.i + di]?.[site.j + dj]
      if (cell && !cell.solid && cell.category !== 'Water' && !cell.inclined) approaches.push(cell)
    }
  approaches.sort((a, b) => Math.hypot(a.i - origin.i, a.j - origin.j) - Math.hypot(b.i - origin.i, b.j - origin.j))
  return approaches.slice(0, 4).some(
    cell =>
      (cell.i === origin.i && cell.j === origin.j) ||
      findInstancePath(origin, cell.i, cell.j, context.map, {
        canPassThroughSolidCell: cell => cell.has?.family === 'unit' || cell.has?.family === 'animal',
      }).length > 0
  )
}

export function hasBanditCampCandidate(context: GameContextLike, npc: UnitEntity): boolean {
  return candidates(context, npc).some(site => reachable(context, npc, site))
}

/** Bind a real camp before accepting; never accept an empty or failed respawn. */
export function assignBanditCamp(context: GameContextLike, quest: QuestInstance, npc: UnitEntity): boolean {
  if (quest.encounters?.bandits?.entityLabels.length) return true
  for (const site of candidates(context, npc, quest)) {
    if (!reachable(context, npc, site)) continue
    let guards = site.guards
    if (!guards.length) {
      if (!site.state || !respawnBanditCamp(context.map as MapGenerationMap, context, site.state)) continue
      delete site.state.clearedAtMs
      guards = livingCampGuards(context, site)
    }
    if (!guards.length) continue
    quest.encounters ??= {}
    quest.encounters.bandits = {
      position: { i: site.i, j: site.j },
      entityLabels: guards.map(unit => unit.label),
      parameters: {},
    }
    quest.markers = {
      'clear-camp': [
        {
          id: 'bandit-camp',
          spaceId: 'outside',
          position: { i: site.i, j: site.j },
          radius: 9,
          label: { key: 'questBanditArea' },
        },
      ],
    }
    return true
  }
  return false
}
