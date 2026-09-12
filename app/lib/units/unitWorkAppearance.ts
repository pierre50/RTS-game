import { applyUnitActivitySpritesheets, getUnitActivityActionSheet } from './unitSpriteAssets'
import { getConfiguredActionFrameSequence } from '../animations/actionFrameSequences'
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
  unit.actionFrameSequence = getConfiguredActionFrameSequence({ ...unit, work: work ?? null, action: action ?? null })
}

export function getUnitWorkActionSheet(unit: UnitEntity, work: string | null | undefined, action?: string | null) {
  if (!work) return undefined
  return getUnitActivityActionSheet(unit, work, action)
}

export function applyUnitWorkAssets(
  unit: UnitEntity,
  work: string | null | undefined,
  options: WorkAssetOptions = {}
): void {
  applyUnitActionFrameSequence(unit, work, options.action)
  if (!work) return
  applyUnitActivitySpritesheets(unit, work, options.action)

  if (options.refreshEquipmentStats) refreshUnitEquipmentStats(unit)
}
