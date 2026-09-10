import { ensureRuntimeBuildingInteriorSpace } from '../../../engine/services/BuildingInteriorSpaceSystemRuntime'
import { canPlaceBuildingAt } from '../../lib/grid/placement'
import { BUILDING_TYPES, UNIT_TYPES } from '../../constants'
import { CIVILIZATIONS } from '../../config/civilizations'
import { ensureNeutralPlayer } from '../players'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import type { RuntimeCell } from '../../types/map'

const MIN_NEUTRAL_CAVE_VILLAGERS = 1
const MAX_NEUTRAL_CAVE_VILLAGERS = 3

/** Keep all floor cells connected when adding furniture, including narrow corridors. */
function preservesCavePaths(cells: RuntimeCell[], blocked: RuntimeCell): boolean {
  const remaining = new Map(
    cells.filter(cell => cell !== blocked && !cell.solid && !cell.has).map(cell => [`${cell.i}:${cell.j}`, cell])
  )
  const neighbors = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
    .map(([di, dj]) => remaining.get(`${blocked.i + di}:${blocked.j + dj}`))
    .filter((cell): cell is RuntimeCell => Boolean(cell))
  const first = neighbors[0]
  if (!first) return false
  const queue = [first]
  remaining.delete(`${first.i}:${first.j}`)
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index]
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const key = `${cell.i + di}:${cell.j + dj}`
      const next = remaining.get(key)
      if (next) {
        remaining.delete(key)
        queue.push(next)
      }
    }
  }
  return neighbors.every(cell => !remaining.has(`${cell.i}:${cell.j}`))
}

export function furnishBanditCave(
  context: GameContextLike,
  cave: BuildingEntity,
  campIndex: number,
  owner: PlayerLike,
  inventory: NonNullable<BuildingEntity['inventory']>
): void {
  const space = ensureRuntimeBuildingInteriorSpace(context, cave)
  if (!space) throw new Error('Cannot furnish bandit cave without an interior')
  const items = [
    BUILDING_TYPES.chest,
    BUILDING_TYPES.fireCamp,
    BUILDING_TYPES.campCrate,
    BUILDING_TYPES.campMeatRack,
    BUILDING_TYPES.campJarLarge,
    BUILDING_TYPES.campAnimalBones,
  ]
  const placed: RuntimeCell[] = []
  const entry = space.entryCell
  const candidates = [...space.walkableCells].sort(
    (a, b) =>
      (b.i - (entry?.i ?? 0)) ** 2 +
      (b.j - (entry?.j ?? 0)) ** 2 -
      ((a.i - (entry?.i ?? 0)) ** 2 + (a.j - (entry?.j ?? 0)) ** 2)
  )
  for (const [index, type] of items.entries()) {
    const label = `${space.id}:bandit:${campIndex}:${index}`
    if (owner.buildings.some(building => building.label === label)) continue
    const config = owner.config.buildings[type]
    if (!config) continue
    const cell = candidates.find(
      cell =>
        (!entry || Math.max(Math.abs(cell.i - entry.i), Math.abs(cell.j - entry.j)) > 2) &&
        placed.every(other => Math.max(Math.abs(cell.i - other.i), Math.abs(cell.j - other.j)) >= 3) &&
        canPlaceBuildingAt(space.grid, cell.i, cell.j, { ...config, type }) &&
        preservesCavePaths(space.walkableCells, cell)
    )
    if (!cell) {
      if (type === BUILDING_TYPES.chest) throw new Error(`No accessible chest position in ${cave.cave?.id}`)
      continue
    }
    owner.createBuilding({
      i: cell.i,
      j: cell.j,
      type,
      label,
      spaceId: space.id,
      isBuilt: true,
      skipBuiltEffects: true,
      ...(type === BUILDING_TYPES.chest ? { inventory } : {}),
    })
    placed.push(cell)
  }
  if (!cave.cave?.neutralVillagersGenerated) {
    placeNeutralCaveVillagers(context, space, campIndex, placed)
    if (cave.cave) cave.cave.neutralVillagersGenerated = true
  }
}

function randomRange(context: GameContextLike, min: number, max: number): number {
  return context.map?.randomRange?.(min, max) ?? min
}

function hasNeutralCaveVillagers(owner: PlayerLike, spaceId: string, campIndex: number): boolean {
  const prefix = `${spaceId}:neutral-villager:${campIndex}:`
  return [...owner.units, ...(owner.corpses ?? [])].some(unit => unit.label?.startsWith(prefix))
}

function findNeutralVillagerCell(
  space: NonNullable<ReturnType<typeof ensureRuntimeBuildingInteriorSpace>>,
  placed: RuntimeCell[]
): RuntimeCell | null {
  const entry = space.entryCell
  return (
    [...space.walkableCells].find(
      cell =>
        !cell.has &&
        !cell.solid &&
        (!entry || Math.max(Math.abs(cell.i - entry.i), Math.abs(cell.j - entry.j)) > 1) &&
        placed.every(other => Math.max(Math.abs(cell.i - other.i), Math.abs(cell.j - other.j)) >= 2) &&
        preservesCavePaths(space.walkableCells, cell)
    ) ?? null
  )
}

function placeNeutralCaveVillagers(
  context: GameContextLike,
  space: NonNullable<ReturnType<typeof ensureRuntimeBuildingInteriorSpace>>,
  campIndex: number,
  placed: RuntimeCell[]
): void {
  const neutralOwner = ensureNeutralPlayer(context, space.entryCell ?? { i: 0, j: 0 })
  if (!neutralOwner.createUnit) throw new Error('Neutral owner cannot create cave villagers')
  if (context.players.some(owner => hasNeutralCaveVillagers(owner, space.id, campIndex))) return

  const count = randomRange(context, MIN_NEUTRAL_CAVE_VILLAGERS, MAX_NEUTRAL_CAVE_VILLAGERS)
  const civilizations = CIVILIZATIONS.map(civilization => civilization.value)
  for (let index = 0; index < count; index++) {
    const cell = findNeutralVillagerCell(space, placed)
    if (!cell) return
    const assetCiv = civilizations.splice(randomRange(context, 0, civilizations.length - 1), 1)[0]
    const unit = neutralOwner.createUnit(
      {
        assetCiv,
        i: cell.i,
        j: cell.j,
        label: `${space.id}:neutral-villager:${campIndex}:${index}`,
        spaceId: space.id,
        suppressCreateSound: true,
        type: UNIT_TYPES.villager,
      },
      { preserveType: true }
    )
    if (unit && !unit.isDead) neutralOwner.population += 1
    placed.push(cell)
  }
}
