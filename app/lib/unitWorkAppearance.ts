import { Assets } from 'pixi.js'
import { ACTION_TYPES, SHEET_TYPES } from '../constants'
import { refreshUnitEquipmentStats } from './equipmentStats'
import type { UnitEntity } from '../types/entities'

type WorkAssetOptions = {
  action?: string | null
  refreshEquipmentStats?: boolean
}

export function getUnitWorkActionSheet(unit: UnitEntity, work: string | null | undefined, action?: string | null) {
  if (!work) return undefined
  const sheet = action === ACTION_TYPES.takemeat ? SHEET_TYPES.harvest : SHEET_TYPES.action
  return Assets.cache.get(unit.allAssets?.[work]?.[sheet] ?? '')
}

export function applyUnitWorkAssets(unit: UnitEntity, work: string | null | undefined, options: WorkAssetOptions = {}): void {
  if (!work) return
  const workAssets = unit.allAssets?.[work]
  if (!workAssets) {
    if (options.refreshEquipmentStats) refreshUnitEquipmentStats(unit)
    return
  }

  unit.actionSheet = getUnitWorkActionSheet(unit, work, options.action)

  unit.standingSheet = Assets.cache.get(workAssets[SHEET_TYPES.standing])
  unit.walkingSheet = Assets.cache.get(workAssets[SHEET_TYPES.walking])

  unit.dyingSheet = Assets.cache.get(workAssets[SHEET_TYPES.dying])
  unit.corpseSheet = Assets.cache.get(workAssets[SHEET_TYPES.corpse])

  if (options.refreshEquipmentStats) refreshUnitEquipmentStats(unit)
}
