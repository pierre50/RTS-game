import { Assets } from 'pixi.js'
import { SHEET_TYPES } from '../constants'
import { getActionVisualSheetKey, SHOOTING_SHEET_KEY } from './actionVisualSheet'
import { getActionFrameSequence } from '../animations/actionFrameSequences'
import { refreshUnitEquipmentStats } from '../equipment/equipmentStats'
import type { UnitEntity } from '../../types/entities'

type WorkAssetOptions = {
  action?: string | null
  refreshEquipmentStats?: boolean
}

export function applyUnitActionFrameSequence(
  unit: UnitEntity,
  work: string | null | undefined,
  action?: string | null
): void {
  unit.actionFrameSequence = getActionFrameSequence(work, action)
}

export function getUnitWorkActionSheet(unit: UnitEntity, work: string | null | undefined, action?: string | null) {
  if (!work) return undefined
  const workAssets = unit.allAssets?.[work]
  if (!workAssets) return undefined
  const sheet = getActionVisualSheetKey(action, unit.type, work)
  const assetId = workAssets[sheet] ?? (sheet === SHOOTING_SHEET_KEY ? workAssets[SHEET_TYPES.action] : undefined)
  return assetId ? Assets.cache.get(assetId) : undefined
}

export function applyUnitWorkAssets(unit: UnitEntity, work: string | null | undefined, options: WorkAssetOptions = {}): void {
  applyUnitActionFrameSequence(unit, work, options.action)
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
