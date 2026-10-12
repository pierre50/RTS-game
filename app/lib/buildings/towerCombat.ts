import { getTownCenterProfile } from './townCenter'
import { TOWN_CENTER_DEFENSE } from '../../config/townCenter'
import { TOWER_COMBAT_LEVELS } from '../../config/towerCombat'
import { getBuildingLevel } from './buildingLevel'

type TowerLike = { type?: string; buildingLevel?: number; assetLevel?: unknown; range?: number }

export function getTowerCombatProfile(building: TowerLike) {
  if (building.type !== 'WatchTower') return undefined
  return TOWER_COMBAT_LEVELS[Math.min(getBuildingLevel(building), TOWER_COMBAT_LEVELS.length - 1)]!
}

export function getBuildingCombatProfile(building: TowerLike) {
  return building.type === 'TownCenter'
    ? { ...getTownCenterProfile(building), ...TOWN_CENTER_DEFENSE }
    : getTowerCombatProfile(building)
}

export function getBuildingAttackRange(building: TowerLike): number | undefined {
  return getBuildingCombatProfile(building)?.range ?? building.range
}
