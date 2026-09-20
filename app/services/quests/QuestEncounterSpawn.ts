import { createNonReservedPassageCellCondition } from '../../lib/buildings/passageCells'
import { cartesianToIsometric } from '../../lib/maths'
import type { GameContextLike } from '../../types/context'
import type { RuntimeCell } from '../../types/map'
import type { QuestInstance } from '../../types/quest'

type Encounter = NonNullable<QuestInstance['encounters']>[string]
type SpawnOptions = {
  count: number
  parameters: Encounter['parameters']
  footprintRadius?: number
  create: (cell: RuntimeCell) => { label: string } | Array<{ label: string }>
}
type Search = { map: GameContextLike['map']; iterator: Generator<RuntimeCell[] | null, null>; retryAt: number }
const searches = new WeakMap<QuestInstance, Map<string, Search>>()
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const

function canWalk(cell: RuntimeCell | undefined): cell is RuntimeCell {
  return Boolean(cell && cell.category !== 'Water' && !cell.inclined &&
    (!cell.solid || cell.has?.family === 'unit' || cell.has?.family === 'animal'))
}

function spawnCondition(context: GameContextLike, origin: { i: number; j: number }, radius = 0) {
  const nonPassage = createNonReservedPassageCellCondition(context)
  const buildings = (context.players ?? []).flatMap(player => player.buildings ?? [])
  const accepts = (cell: RuntimeCell): boolean => {
    if (!canWalk(cell) || cell.solid || cell.has || cell.border || cell.waterBorder || !nonPassage(cell)) return false
    if (Math.hypot(cell.i - origin.i, cell.j - origin.j) < 12) return false
    const views = context.player?.views
    const visible = () => views?.isVisible(cell.i, cell.j) ?? true
    if (views?.withSpace?.('outside', visible) ?? visible()) return false
    if (!context.map.activeSpaceId || context.map.activeSpaceId === 'outside') {
      const [x, y] = cartesianToIsometric(cell.i, cell.j)
      if (!context.controls?.instanceInCamera || context.controls.instanceInCamera({ x, y },
        { minX: x - 96, minY: y - 96, width: 192, height: 192 })) return false
    }
    return !buildings.some(building => !building.isDead && !building.isDestroyed &&
      Math.max(Math.abs(cell.i - building.i), Math.abs(cell.j - building.j)) <= Math.ceil((building.size ?? 2) / 2) + 4)
  }
  return (cell: RuntimeCell): boolean => {
    if (!accepts(cell)) return false
    for (let di = -radius; di <= radius; di++) for (let dj = -radius; dj <= radius; dj++) {
      if (!di && !dj) continue
      const neighbor = context.map.grid[cell.i + di]?.[cell.j + dj]
      if (!neighbor || !accepts(neighbor)) return false
    }
    return true
  }
}

function* searchCells(context: GameContextLike, origin: { i: number; j: number }, count: number, radius = 0): Generator<RuntimeCell[] | null, null> {
  const grid = context.map.grid
  if (!Number.isInteger(origin.i) || !Number.isInteger(origin.j) || !grid[origin.i]?.[origin.j]) return null
  const queue = [{ i: origin.i, j: origin.j }]
  const seen = new Set<string>([`${origin.i}:${origin.j}`])
  const candidates: RuntimeCell[] = []
  let canSpawn = spawnCondition(context, origin, radius)
  let sliceStart = performance.now()
  // Bound both the total search and each scheduler slice.
  for (let cursor = 0; cursor < queue.length && cursor < 8192; cursor++) {
    if (cursor && (cursor % 128 === 0 || performance.now() - sliceStart >= 2)) {
      yield null
      sliceStart = performance.now()
      canSpawn = spawnCondition(context, origin, radius)
    }
    const point = queue[cursor]
    const cell = grid[point.i]?.[point.j]
    if (cursor && !canWalk(cell)) continue
    if (cell && canSpawn(cell)) {
      candidates.push(cell)
      const group = candidates.slice(-128).filter(other => Math.hypot(other.i - cell.i, other.j - cell.j) <= 3 && canSpawn(other)).slice(0, count)
      if (group.length === count) { yield group; return null }
    }
    for (const [di, dj] of DIRECTIONS) {
      const i = point.i + di, j = point.j + dj
      const key = `${i}:${j}`
      if (Math.max(Math.abs(i - origin.i), Math.abs(j - origin.j)) > 48 || seen.has(key)) continue
      seen.add(key)
      if (canWalk(grid[i]?.[j])) queue.push({ i, j })
    }
  }
  return null
}

/** Animal and hostile-unit factories share placement and persistent encounter identity. */
export function ensureQuestEncounter(context: GameContextLike, quest: QuestInstance, id: string,
  origin: { i: number; j: number }, options: SpawnOptions): Encounter | null {
  const existing = quest.encounters?.[id]
  if (existing) return existing
  if (quest.status !== 'active' || quest.regionId !== (context.map.worldRegionId ?? context.getCurrentWorldId?.())) return null
  let pending = searches.get(quest)
  if (!pending) { pending = new Map(); searches.set(quest, pending) }
  let search = pending.get(id)
  const now = context.scheduler?.elapsedMs ?? performance.now()
  if (!search || search.map !== context.map) {
    search = { map: context.map, iterator: searchCells(context, origin, options.count, options.footprintRadius), retryAt: 0 }
    pending.set(id, search)
  }
  if (now < search.retryAt) return null
  const result = context.performance
    ? context.performance.measure('quests.encounter.search', () => search.iterator.next())
    : search.iterator.next()
  if (result.done) {
    search.iterator = searchCells(context, origin, options.count, options.footprintRadius)
    search.retryAt = now + 5000
    return null
  }
  if (!result.value) return null
  const canSpawn = spawnCondition(context, origin, options.footprintRadius)
  if (!result.value.every(canSpawn)) return null
  const encounter: Encounter = { entityLabels: [], position: { i: result.value[0].i, j: result.value[0].j }, parameters: options.parameters }
  quest.encounters ??= {}
  quest.encounters[id] = encounter
  for (const cell of result.value) {
    const created = options.create(cell)
    encounter.entityLabels.push(...(Array.isArray(created) ? created : [created]).map(entity => entity.label))
  }
  if (!encounter.entityLabels.length) {
    delete quest.encounters[id]
    search.iterator = searchCells(context, origin, options.count, options.footprintRadius)
    search.retryAt = now + 5000
    return null
  }
  pending.delete(id)
  return encounter
}
