import { Player } from '../players'
import { canPlaceBuildingAt, getPlainCellsAroundPoint } from '../../lib'
import { getUnitOverallLevel } from '../../lib/units/unitExperience'
import { BUILDING_TYPES, PLAYER_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import type { GridPosition } from '../../types/grid'
import type { GameContextLike } from '../../types/context'
import type { RuntimeCell } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import type { MapGenerationMap } from './MapGenerationTypes'

const BANDIT_CAMP_OWNER_NAME = 'Bandits'
const BANDIT_CAMP_FIRE_OFFSETS: GridPosition[] = [
  { i: 0, j: 0 },
  { i: -3, j: 1 },
  { i: 2, j: -3 },
  { i: 3, j: 2 },
]
const CAMP_DECORATION_LAYOUT: Array<{ type: string; offset: GridPosition }> = [
  { type: BUILDING_TYPES.campMeatRack, offset: { i: -4, j: 3 } },
  { type: BUILDING_TYPES.campDryingRack, offset: { i: 3, j: -4 } },
  { type: BUILDING_TYPES.campTotemSkull, offset: { i: 0, j: -5 } },
  { type: BUILDING_TYPES.campTotemHorns, offset: { i: 4, j: -2 } },
  { type: BUILDING_TYPES.campFencePost, offset: { i: -2, j: 4 } },
  { type: BUILDING_TYPES.campCrate, offset: { i: 4, j: 1 } },
  { type: BUILDING_TYPES.campBucket, offset: { i: -3, j: -2 } },
  { type: BUILDING_TYPES.campRockPile, offset: { i: 1, j: 4 } },
  { type: BUILDING_TYPES.campAnimalBones, offset: { i: -5, j: 0 } },
  { type: BUILDING_TYPES.campJarLarge, offset: { i: 5, j: -1 } },
  { type: BUILDING_TYPES.campBoneSmall, offset: { i: -1, j: 5 } },
  { type: BUILDING_TYPES.campSkull, offset: { i: 2, j: 4 } },
  { type: BUILDING_TYPES.campTotemPlain, offset: { i: -4, j: -1 } },
  { type: BUILDING_TYPES.campJarSmall, offset: { i: 5, j: 2 } },
]

export type BanditCampOwner = PlayerLike & { banditCampOwner?: true }

export function ensureBanditCampOwner(
  map: MapGenerationMap,
  context: GameContextLike,
  anchor: GridPosition,
  civilization: string = context.player?.civ ?? 'Greek',
  players: PlayerLike[] = map.context.players
): BanditCampOwner {
  const existing = players.find(player => player.type === PLAYER_TYPES.bandits) as BanditCampOwner | undefined
  if (existing) return existing

  const owner = new Player(
    {
      i: anchor.i,
      j: anchor.j,
      name: BANDIT_CAMP_OWNER_NAME,
      type: PLAYER_TYPES.bandits,
      isPlayed: false,
      color: 'grey',
      civ: civilization,
      gender: 'male',
      team: null,
      diplomacy: null,
      populationMax: Number.POSITIVE_INFINITY,
      autoTechnologyByAge: false,
    },
    context
  ) as BanditCampOwner
  owner.banditCampOwner = true
  owner.selectedUnits = []
  owner.selectedUnit = null
  owner.selectedBuilding = null
  owner.selectedOther = null
  owner.hasBuilt = []
  players.push(owner)
  return owner
}

export function placeBanditCamps(map: MapGenerationMap, context: GameContextLike): void {
  if (map.noAI || !map.banditCampPositions.length) return
  const owner = ensureBanditCampOwner(map, context, map.banditCampPositions[0])
  const heroLevel = getHeroLevel(map)

  for (let index = 0; index < map.banditCampPositions.length; index++) {
    const position = map.banditCampPositions[index]
    const anchor = findBanditCampAnchor(map, position, owner)
    if (!anchor) continue
    const unitTypes = getBanditCampUnitTypes(map, index, heroLevel)
    const fireCamps = placeBanditCampFires(map, owner, anchor, getBanditCampFireCount(unitTypes.length, heroLevel))
    if (!fireCamps.length) continue
    placeCampDecorations(map, owner, anchor, unitTypes.length, heroLevel)
    placeBanditCampUnits(map, owner, fireCamps, unitTypes)
  }
}

function canPlaceCampBuildingAt(map: MapGenerationMap, owner: PlayerLike, i: number, j: number, type: string): boolean {
  const config = owner.config.buildings[type]
  if (!config) return false
  return canPlaceBuildingAt(map.grid, i, j, { ...config, type })
}

function placeCampBuildingNear(
  map: MapGenerationMap,
  owner: PlayerLike,
  anchor: RuntimeCell,
  type: string,
  offset: GridPosition,
  searchRadius = 1
): RuntimeCell | null {
  const targetI = anchor.i + offset.i
  const targetJ = anchor.j + offset.j
  for (let distance = 0; distance <= searchRadius; distance++) {
    const cells = getPlainCellsAroundPoint(targetI, targetJ, map.grid, distance, cell =>
      canPlaceCampBuildingAt(map, owner, cell.i, cell.j, type)
    )
    if (!cells.length) continue
    const cell = distance === 0 ? cells[0] : map.randomItem(cells)
    owner.createBuilding({ i: cell.i, j: cell.j, type, isBuilt: true })
    return cell
  }
  return null
}

function findBanditCampAnchor(map: MapGenerationMap, position: GridPosition, owner: PlayerLike): RuntimeCell | null {
  for (let distance = 0; distance <= 8; distance++) {
    const cells = getPlainCellsAroundPoint(position.i, position.j, map.grid, distance, cell =>
      canPlaceCampBuildingAt(map, owner, cell.i, cell.j, BUILDING_TYPES.fireCamp)
    )
    if (cells.length) return map.randomItem(cells)
  }
  return null
}

function getHeroLevel(map: MapGenerationMap): number {
  const hero = map.context.controls?.heroUnit ?? map.context.player?.units?.find(unit => unit.type === UNIT_TYPES.hero)
  return hero ? getUnitOverallLevel(hero) : 0
}

function getBanditCampFireCount(unitCount: number, heroLevel: number): number {
  return Math.max(1, Math.min(BANDIT_CAMP_FIRE_OFFSETS.length, Math.ceil(unitCount / 3) + Math.floor(heroLevel / 8)))
}

function placeBanditCampFires(
  map: MapGenerationMap,
  owner: PlayerLike,
  anchor: RuntimeCell,
  fireCount: number
): RuntimeCell[] {
  const fireCamps: RuntimeCell[] = []
  for (let index = 0; index < fireCount; index++) {
    const offset = BANDIT_CAMP_FIRE_OFFSETS[index]
    const cell = placeCampBuildingNear(map, owner, anchor, BUILDING_TYPES.fireCamp, offset, index === 0 ? 0 : 1)
    if (cell) fireCamps.push(cell)
  }
  return fireCamps
}

function placeCampDecorations(
  map: MapGenerationMap,
  owner: PlayerLike,
  anchor: RuntimeCell,
  unitCount: number,
  heroLevel: number
): void {
  const targetCount = Math.max(
    4,
    Math.min(CAMP_DECORATION_LAYOUT.length, 3 + Math.ceil(unitCount / 2) + Math.floor(heroLevel / 5))
  )
  let placed = 0
  for (const entry of CAMP_DECORATION_LAYOUT) {
    if (placed >= targetCount) break
    if (placeCampBuildingNear(map, owner, anchor, entry.type, entry.offset, 1)) placed++
  }
}

function getBanditCampUnitTypes(map: MapGenerationMap, campIndex: number, heroLevel: number): string[] {
  const extra = Math.min(4, Math.max(0, campIndex)) + Math.floor(heroLevel / 4)
  const count = Math.min(10, map.randomRange(3, 4 + extra))
  const types = [UNIT_TYPES.banditChief]
  for (let index = 1; index < count; index++) {
    types.push(index % 3 === 0 ? UNIT_TYPES.banditArcher : UNIT_TYPES.banditSword)
  }
  return types
}

function placeBanditCampUnits(
  map: MapGenerationMap,
  owner: PlayerLike,
  anchors: RuntimeCell[],
  unitTypes: string[]
): void {
  const primaryAnchor = anchors[0]
  if (!primaryAnchor) return
  const candidates: RuntimeCell[] = []
  for (const anchor of anchors) {
    for (let distance = 2; distance <= 5; distance++) {
      candidates.push(
        ...getPlainCellsAroundPoint(anchor.i, anchor.j, map.grid, distance, cell =>
          Boolean(!cell.solid && !cell.has && !cell.border && !cell.waterBorder && cell.category !== 'Water')
        )
      )
    }
  }

  for (const type of unitTypes) {
    if (!candidates.length) break
    const cell = candidates.splice(map.randomRange(0, candidates.length - 1), 1)[0]
    if (cell.solid || cell.has) continue
    const unit = owner.createUnit?.({
      i: cell.i,
      j: cell.j,
      type,
      gender: 'male',
      work: WORK_TYPES.attacker,
      appearanceVariants: { gender: 'male' },
      suppressCreateSound: true,
    })
    if (unit) {
      const patrolAnchor = map.randomItem(anchors) ?? primaryAnchor
      unit.campPatrolAnchor = { i: patrolAnchor.i, j: patrolAnchor.j }
      unit.banditCampAnchor = unit.campPatrolAnchor
      owner.population = (owner.population ?? 0) + 1
    }
  }
}
