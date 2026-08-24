import { MAX_ARCHER_BY_AGE, MAX_BUILDING_BY_AGE, MAX_INFANTRY_BY_AGE } from '../../ai/config'
import { ARCHER_TECH_UPGRADES, getBestUnitFromTechs } from '../../ai/unitGroups'
import { CIVILIZATION_LEVEL_RESOURCE_BONUS } from '../../config/resourcePresets'
import { canPlaceBuildingAt, getPositionInGridAroundInstance } from '../../lib'
import { BUILDING_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import type { BuildingEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import type { MapGenerationMap } from './MapGeneration'

function getDiamondRingOffsets(radius: number): Array<[number, number]> {
  const offsets: Array<[number, number]> = []
  for (let di = -radius; di <= radius; di++) {
    const djAbs = radius - Math.abs(di)
    if (djAbs === 0) {
      offsets.push([di, 0])
    } else {
      offsets.push([di, djAbs], [di, -djAbs])
    }
  }
  return offsets
}

export function applyCivilizationLevelStartingKit(
  map: MapGenerationMap,
  player: PlayerLike,
  level: number,
  townCenter: BuildingEntity
): void {
  player.hasBuilt = player.hasBuilt || []

  const markBuilt = (type: string) => {
    if (!player.hasBuilt!.includes(type)) player.hasBuilt!.push(type)
  }

  const placementSpaceFor = (type: string): [number, number] => {
    if (type === BUILDING_TYPES.townCenter) return [14, 32]
    if (type === BUILDING_TYPES.house) return [6, 12]
    return [6, 22]
  }
  const placementSizeFor = (type: string): number => {
    if (type === BUILDING_TYPES.townCenter) return 2
    if (type === BUILDING_TYPES.house) return 0
    return 1
  }

  const placeExtraBuilding = (type: string): boolean => {
    const config = player.config.buildings[type]
    if (!config) return false
    if (player.isBuildingEligible && !player.isBuildingEligible(type)) return false
    const placementConfig = { ...config, type }
    const [minSpace, maxSpace] = placementSpaceFor(type)
    const size = placementSizeFor(type)
    for (const spaceMultiplier of [1, 2, 3, 4]) {
      const position = getPositionInGridAroundInstance(townCenter, map.grid, [minSpace, maxSpace * spaceMultiplier], size)
      if (position && canPlaceBuildingAt(map.grid, position.i, position.j, placementConfig)) {
        player.createBuilding({ i: position.i, j: position.j, type, isBuilt: true })
        markBuilt(type)
        return true
      }
    }
    return false
  }

  const infantryType = UNIT_TYPES.infantry
  const archerType = getBestUnitFromTechs(player.technologies, ARCHER_TECH_UPGRADES, UNIT_TYPES.bowman)
  const maxByAge = (table: Record<number, number>) => table[level] || 0
  const unitTargets: Array<[string, number]> = [
    [infantryType, maxByAge(MAX_INFANTRY_BY_AGE)],
    [archerType, maxByAge(MAX_ARCHER_BY_AGE)],
  ]

  let populationTarget = player.population
  for (const [, count] of unitTargets) populationTarget += count

  const houseConfig = player.config.buildings[BUILDING_TYPES.house]
  const houseCapacity = Number(houseConfig?.increasePopulation) || 0
  if (houseCapacity > 0) {
    let guard = 0
    while (player.populationMax < populationTarget && guard++ < 20) {
      if (!placeExtraBuilding(BUILDING_TYPES.house)) break
    }
  }

  const buildingTargets = (MAX_BUILDING_BY_AGE as Record<number, Record<string, number>>)[level] || {}
  for (const [type, targetCount] of Object.entries(buildingTargets)) {
    const existing = player.buildings.filter(building => building.type === type).length
    for (let n = existing; n < targetCount; n++) {
      if (!placeExtraBuilding(type)) break
    }
  }

  if (level >= 2) {
    const wallConfig = player.config.buildings[BUILDING_TYPES.smallWall]
    if (wallConfig) {
      for (const [di, dj] of getDiamondRingOffsets(22)) {
        const i = townCenter.i + di
        const j = townCenter.j + dj
        const placementConfig = { ...wallConfig, type: BUILDING_TYPES.smallWall }
        if (!canPlaceBuildingAt(map.grid, i, j, placementConfig)) continue
        player.createBuilding({ i, j, type: BUILDING_TYPES.smallWall, isBuilt: true })
        markBuilt(BUILDING_TYPES.smallWall)
      }
    }
  }

  player.applyEligibleTechnologies?.()

  const resourceBonus = CIVILIZATION_LEVEL_RESOURCE_BONUS[level]
  if (resourceBonus) {
    player.wood += resourceBonus.wood ?? 0
    player.food += resourceBonus.food ?? 0
    player.gold += resourceBonus.gold ?? 0
    player.stone += resourceBonus.stone ?? 0
    player.copper += resourceBonus.copper ?? 0
    player.iron += resourceBonus.iron ?? 0
  }

  for (const [type, count] of unitTargets) {
    if (!type || !count || !player.config.units[type]) continue
    for (let n = 0; n < count; n++) {
      const position = getPositionInGridAroundInstance(townCenter, map.grid, [2, 10], 0)
      if (!position) continue
      const unit = player.createUnit?.({ i: position.i, j: position.j, type, owner: player })
      if (unit) {
        unit.campPatrolAnchor = { i: position.i, j: position.j }
        unit.work = WORK_TYPES.attacker
        player.population = (player.population ?? 0) + 1
      }
    }
  }
}
