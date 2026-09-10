import { ACTION_TYPES, SHEET_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import { civilizationKey } from '../../lib/lpc/equipment'
import { getUnitEquipmentTier } from '../../lib/units/unitExperience'
import type { UnitAppearanceLayerConfig } from '../../types/config'
import type { UnitEntity } from '../../types/entities'

export type PreviewUnit = Pick<UnitEntity, 'owner' | 'type' | 'label' | 'i' | 'j' | 'controlMode' | 'work'> &
  Partial<UnitEntity>

export function getTrainingPreviewWork(type: string): string {
  return type === UNIT_TYPES.priest ? WORK_TYPES.healer : WORK_TYPES.attacker
}

export function getActionSheetId(unit: PreviewUnit): string | null {
  const work = unit.work || getTrainingPreviewWork(unit.type)
  return (
    unit.assets?.[SHEET_TYPES.action] ??
    unit.allAssets?.[work]?.[SHEET_TYPES.action] ??
    unit.allAssets?.default?.[SHEET_TYPES.action] ??
    null
  )
}

export function getLayerActionSheetId(layer: UnitAppearanceLayerConfig, work: string, mounted = false): string | null {
  if (layer.workTypes?.length && !layer.workTypes.includes(work)) return null
  if (layer.hideForActions?.includes(ACTION_TYPES.attack)) return null
  if (mounted && layer.mountedSheet) return layer.mountedSheet
  return (
    layer.actionWorkSheetOverrides?.[`${work}:${ACTION_TYPES.attack}`]?.[SHEET_TYPES.action] ??
    layer.actionSheet ??
    null
  )
}

export function isLayerUnlockedForPreview(layer: UnitAppearanceLayerConfig, unit: PreviewUnit): boolean {
  if (layer.civilizations?.length && !layer.civilizations.includes(civilizationKey(unit.owner?.civ))) return false
  const level = getUnitEquipmentTier(unit)
  return level >= (layer.minLevel ?? 0) && level <= (layer.maxLevel ?? Number.POSITIVE_INFINITY)
}
