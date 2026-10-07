import { BUILDING_TYPES, PLAYER_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import { getPlainCellsAroundPoint } from '../../lib'
import { BANDIT_FACTION_COLOR, BANDIT_FACTION_NAME } from '../../lib/campaign/playerRoster'
import { campRespawnStates, type CampRespawnState } from '../../lib/camps/campRespawnState'
import { createSeededRandom } from '../../lib/random'
import { getUnitOverallLevel } from '../../lib/units/unitExperience'
import type { BanditCampPlacement } from '../../types/camp'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { GridPosition } from '../../types/grid'
import type { RuntimeCell } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import { AI } from '../players'
import { furnishBanditCave } from './BanditCaveGeneration'
import {
  canPlaceCampBuildingAt,
  createBanditCampChestInventory,
  findBanditCampAnchor,
  getBanditCampFireCount,
  placeBanditCampChest,
  placeBanditCampFires,
  placeCampDecorations,
} from './generation/BanditCampStructures'
import type { MapGenerationMap } from './MapGenerationTypes'

export type BanditCampOwner = PlayerLike & { banditCampOwner?: true }
type BanditCampOwnerOptions = {
  civ?: string | null
  color?: string | null
  factionId?: string | null
  name?: string | null
}

export function ensureBanditCampOwner(
  map: MapGenerationMap,
  context: GameContextLike,
  anchor: GridPosition,
  civilization: string = context.player?.civ ?? 'Hellas',
  players: PlayerLike[] = map.context.players,
  options: BanditCampOwnerOptions = {}
): BanditCampOwner {
  const existing = players.find(player => player.type === PLAYER_TYPES.bandits) as BanditCampOwner | undefined
  if (existing) return existing

  const owner = new AI(
    {
      i: anchor.i,
      j: anchor.j,
      name: options.name ?? BANDIT_FACTION_NAME,
      type: PLAYER_TYPES.bandits,
      isPlayed: false,
      color: options.color ?? BANDIT_FACTION_COLOR,
      civ: options.civ ?? civilization,
      factionId: options.factionId ?? null,
      gender: 'male',
      team: null,
      diplomacy: null,
      populationMax: Number.POSITIVE_INFINITY,
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
  if (!map.banditCampPositions.length) return
  if (map.noAI && !map.banditCampPositions.some(position => (position as BanditCampPlacement).profile)) return
  const owner = ensureBanditCampOwner(map, context, map.banditCampPositions[0])
  const heroLevel = getHeroLevel(map)

  for (let index = 0; index < map.banditCampPositions.length; index++) {
    const position = map.banditCampPositions[index] as BanditCampPlacement
    if (map.noAI && !position.profile) continue
    const random = createSeededRandom(position.seed ?? map.seed ?? 0)
    const campMap: MapGenerationMap = position.profile
      ? Object.assign(Object.create(map), {
          randomRange: (min: number, max: number) => min + Math.floor(random() * (max - min + 1)),
          randomItem: <T>(items: T[]): T => items[Math.floor(random() * items.length)],
        })
      : map
    const campLevel = position.profile ? 0 : heroLevel
    const caveId = (position as GridPosition & { caveId?: string }).caveId
    const cave = caveId
      ? context.players.flatMap(player => player.buildings).find(building => building.cave?.id === caveId)
      : undefined
    if (caveId && !cave) throw new Error(`Missing bandit cave: ${caveId}`)
    const anchor = findBanditCampAnchor(campMap, position, owner, position.profile || cave ? 0 : 8)
    if (!anchor) continue
    const unitTypes = position.unitTypes ?? getBanditCampUnitTypes(campMap, index, campLevel)
    const fireCamps = placeBanditCampFires(
      campMap,
      owner,
      anchor,
      cave || position.profile === 'small' ? 1 : getBanditCampFireCount(unitTypes.length, campLevel)
    )
    if (!fireCamps.length) continue
    if (cave) {
      const inventory = createBanditCampChestInventory(campMap, unitTypes.length, campLevel)
      if (position.profile && cave.cave) {
        cave.cave.banditContent ??= { ownerLabel: owner.label, campIndex: index, inventory }
      } else furnishBanditCave(context, cave, index, owner, inventory)
    } else {
      placeCampDecorations(campMap, owner, anchor, unitTypes.length, campLevel)
      placeBanditCampChest(campMap, owner, anchor, index, unitTypes.length, campLevel)
    }
    const units = placeBanditCampUnits(campMap, owner, fireCamps, unitTypes, position)
    for (const fire of fireCamps) {
      const roster = units.filter(unit => unit.campPatrolAnchor?.i === fire.i && unit.campPatrolAnchor?.j === fire.j)
      if (!roster.length) continue
      campRespawnStates(map).push({
        id: `camp:${fire.i}:${fire.j}`,
        i: fire.i,
        j: fire.j,
        unitTypes: roster.map(unit => unit.type),
        generation: 0,
        ...(position.caveId ? { caveId: position.caveId } : {}),
      })
    }
  }
}

function getHeroLevel(map: MapGenerationMap): number {
  const hero = map.context.controls?.heroUnit ?? map.context.player?.units?.find(unit => unit.type === UNIT_TYPES.hero)
  return hero ? getUnitOverallLevel(hero) : 0
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
  unitTypes: string[],
  camp?: BanditCampPlacement
): UnitEntity[] {
  const created: UnitEntity[] = []
  const primaryAnchor = anchors[0]
  if (!primaryAnchor) return created
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

  if (camp?.profile) {
    const unique = new Map(candidates.map(cell => [`${cell.i}:${cell.j}`, cell]))
    candidates.splice(0, candidates.length, ...unique.values())
  }
  for (const [unitIndex, type] of unitTypes.entries()) {
    if (!candidates.length) break
    let cell = candidates.splice(map.randomRange(0, candidates.length - 1), 1)[0]
    while ((cell.solid || cell.has) && candidates.length)
      cell = candidates.splice(map.randomRange(0, candidates.length - 1), 1)[0]
    if (cell.solid || cell.has) break
    const unit = owner.createUnit?.({
      i: cell.i,
      j: cell.j,
      type,
      ...(camp?.id ? { label: `${camp.id}:unit-${unitIndex}` } : {}),
      campBehavior: { phase: 'guard', homeSpaceId: 'outside', ...(camp?.caveId ? { caveId: camp.caveId } : {}) },
      gender: 'male',
      work: WORK_TYPES.attacker,
      appearanceVariants: { gender: 'male' },
      suppressCreateSound: true,
    })
    if (unit) {
      const patrolAnchor = map.randomItem(anchors) ?? primaryAnchor
      unit.campPatrolAnchor = { i: patrolAnchor.i, j: patrolAnchor.j }
      unit.banditCampAnchor = unit.campPatrolAnchor
      created.push(unit)
      owner.population = (owner.population ?? 0) + 1
    }
  }
  return created
}

/** Reuse surviving scenery and the original roster; never regenerate loot or additional sites. */
export function respawnBanditCamp(map: MapGenerationMap, context: GameContextLike, camp: CampRespawnState): boolean {
  const owner = ensureBanditCampOwner(map, context, camp)
  let fire = owner.buildings.find(
    building =>
      building.type === BUILDING_TYPES.fireCamp &&
      !building.isDead &&
      !building.isDestroyed &&
      (building.spaceId ?? 'outside') === 'outside' &&
      building.i === camp.i &&
      building.j === camp.j
  )
  if (!fire) {
    if (!canPlaceCampBuildingAt(map, owner, camp.i, camp.j, BUILDING_TYPES.fireCamp)) return false
    fire = owner.createBuilding({ i: camp.i, j: camp.j, type: BUILDING_TYPES.fireCamp, isBuilt: true })
  }
  const anchor = map.grid[camp.i]?.[camp.j]
  if (!fire || !anchor) return false
  const units = placeBanditCampUnits(map, owner, [anchor], camp.unitTypes, {
    ...camp,
    id: `${camp.id}:respawn-${camp.generation + 1}`,
    profile: 'small',
  })
  if (!units.length) return false
  camp.generation++
  context.menu?.updatePlayerMiniMapEvt?.(owner)
  return true
}
