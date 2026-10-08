import { deferredVillageBuildings } from '../../world/distantVillages/DeferredVillageStore'
import { campRespawnStates } from '../../../lib/camps/campRespawnState'
import { getEntitySpaceId } from '../../../lib/mapSpaces'
import type { GameContextLike } from '../../../types/context'
import { MAX_TRAFFIC_GROUPS, type TrafficGroup } from './AmbientTrafficState'
import { planRoadRoute, townArrivalCells } from '../RoadRoute'

export { MAX_TRAFFIC_GROUPS } from './AmbientTrafficState'
const dist = (a: { i: number; j: number }, b: { i: number; j: number }) => Math.hypot(a.i - b.i, a.j - b.j)

/** Bounded roster, stable IDs, no random actors generated merely by turning the camera. */
export function* buildTrafficRoutes(context: GameContextLike, groups: TrafficGroup[]): Generator<void> {
  const roads = context.map.roads
  if (!roads?.cells.length) return
  const towns = (context.players ?? [])
    .filter(p => p.type !== 'Bandits' && p.type !== 'Gaia')
    .flatMap(owner =>
      (deferredVillageBuildings(owner) ?? owner.buildings)
        .filter(
          b => b.type === 'TownCenter' && b.isBuilt && !b.isDead && !b.isDestroyed && getEntitySpaceId(b) === 'outside'
        )
        .map(town => ({ town, owner }))
    )
  const hero = context.controls?.heroUnit
  if (hero) towns.sort((a, b) => dist(a.town, hero) - dist(b.town, hero))
  const has = (id: string) => groups.some(group => group.id === id)
  const make = function* (group: TrafficGroup): Generator<void> {
    if (has(group.id) || groups.length >= MAX_TRAFFIC_GROUPS) return
    const start = townArrivalCells(group.to, group.from, context.map)[0]
    if (!start) return
    const search = planRoadRoute({ ...start, label: group.id }, group.to, context.map)
    for (let n = 0; n < 4096; n++) {
      const result = search.next()
      if (result.done) {
        const route = result.value
        if (
          route &&
          route.length >= 12 &&
          route.length <= 8192 &&
          (group.kind !== 'bandits' || route.every(p => dist(p, group.from) <= 35))
        ) {
          group.route = route
          let seed = 0
          for (const char of group.id) seed = (Math.imul(seed, 31) + char.charCodeAt(0)) >>> 0
          group.progress = seed % route.length
          group.reverse = Boolean(seed % 2)
          groups.push(group)
        }
        return
      }
      yield
    }
  }
  for (const { town, owner } of towns) {
    if (groups.length >= 20) break
    const destinations = towns
      .filter(other => other.town !== town && !owner.isEnemy?.(other.owner) && !other.owner.isEnemy?.(owner))
      .sort(
        (a, b) =>
          Number(b.owner.civ === owner.civ) - Number(a.owner.civ === owner.civ) ||
          dist(a.town, town) - dist(b.town, town)
      )
    const destination = destinations[0]
    if (
      !destination ||
      dist(town, destination.town) < 48 ||
      !owner.label ||
      !town.label ||
      !destination.owner.label ||
      !destination.town.label
    )
      continue
    const kind = groups.filter(g => g.kind !== 'bandits').length % 4 === 3 ? 'military' : 'villagers'
    const variant = [...town.label].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4
    const types =
      kind === 'military'
        ? ['Fantassin', 'Fantassin', 'Bowman']
        : variant === 0
          ? ['Villager']
          : variant === 3
            ? ['Villager', 'Fantassin']
            : ['Villager', 'Villager']
    const id = `traffic:${owner.label}:${town.label}`
    yield* make({
      id,
      kind,
      owner: owner.label,
      from: { i: town.i, j: town.j, label: town.label, owner: owner.label, name: town.settlementName },
      to: {
        i: destination.town.i,
        j: destination.town.j,
        label: destination.town.label,
        owner: destination.owner.label,
        name: destination.town.settlementName,
      },
      route: [],
      progress: 0,
      reverse: false,
      pauseMs: 0,
      members: types.map((type, index) => ({ type, label: `${id}:${index}`, i: town.i, j: town.j })),
    })
    yield
  }
  // Populate long connections evenly without repeating expensive route searches.
  // Keep eight roster slots for bandits and give every town its first group first.
  const connections = groups.filter(g => g.kind !== 'bandits' && !g.id.includes(':departure:') && !g.retired)
  for (let departure = 1; departure <= 2; departure++) {
    for (const source of connections) {
      if (groups.length >= 20) break
      const departures = Math.min(3, Math.ceil(source.route.length / 120))
      const id = `${source.id}:departure:${departure}`
      if (departure >= departures || has(id)) continue
      const kind = departure === 2 ? 'military' : 'villagers'
      const types = kind === 'military' ? ['Fantassin', 'Fantassin', 'Bowman'] : ['Villager', 'Villager']
      groups.push({
        id,
        kind,
        owner: source.owner,
        from: { ...source.from },
        to: { ...source.to },
        route: source.route,
        progress: (source.progress + Math.floor((source.route.length * departure) / departures)) % source.route.length,
        reverse: source.reverse,
        pauseMs: 0,
        members: types.map((type, index) => ({ type, label: `${id}:${index}`, i: source.from.i, j: source.from.j })),
      })
      yield
    }
  }
  const owner = context.players?.find(p => p.type === 'Bandits')
  if (!owner?.label) return
  for (const camp of [...campRespawnStates(context.map)].sort((a, b) => (hero ? dist(a, hero) - dist(b, hero) : 0))) {
    if (
      groups.length >= MAX_TRAFFIC_GROUPS ||
      groups.filter(g => g.kind === 'bandits' && !g.id.endsWith(':night')).length >= 4
    )
      break
    if (camp.caveId || camp.clearedAtMs != null) continue
    const id = `traffic:${camp.id}:${camp.generation}`
    if (has(id)) continue
    let end: { i: number; j: number } | undefined
    for (let n = 0; n < roads.cells.length; n++) {
      const [cell] = roads.cells[n]
      const point = { i: Math.floor(cell / roads.stride), j: cell % roads.stride }
      const d = dist(camp, point)
      if (d >= 15 && d <= 28 && (!end || d > dist(camp, end))) end = point
      if (n % 64 === 0) yield
    }
    if (!end) continue
    yield* make({
      id,
      kind: 'bandits',
      owner: owner.label,
      campId: camp.id,
      campGeneration: camp.generation,
      from: { i: camp.i, j: camp.j, label: camp.id, owner: owner.label },
      to: { ...end, label: camp.id, owner: owner.label },
      route: [],
      progress: 0,
      reverse: false,
      pauseMs: 0,
      members: ['BanditSword', 'BanditArcher'].map((type, index) => ({
        type,
        label: `${id}:${index}`,
        i: camp.i,
        j: camp.j,
      })),
    })
  }
  // A second, persistent patrol per camp is eligible only at night. Reuse the route.
  for (const source of groups.filter(g => g.kind === 'bandits' && !g.id.endsWith(':night') && !g.retired)) {
    const id = `${source.id}:night`
    if (has(id) || groups.length >= MAX_TRAFFIC_GROUPS) continue
    groups.push({
      ...source,
      id,
      materialized: false,
      progress: (source.progress + Math.floor(source.route.length / 2)) % source.route.length,
      pauseMs: 0,
      members: ['BanditSword', 'BanditArcher'].map((type, index) => ({
        type,
        label: `${id}:${index}`,
        i: source.from.i,
        j: source.from.j,
      })),
    })
    yield
  }
}
