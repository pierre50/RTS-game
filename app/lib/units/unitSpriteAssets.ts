import { Assets } from 'pixi.js'
import { SHEET_TYPES } from '../../constants'
import { getActionVisualSheetKey, SHOOTING_SHEET_KEY } from './actionVisualSheet'
import type { UnitEntity } from '../../types/entities'

function getUnitActivityAssets(unit: UnitEntity, work = unit.work) {
  return (work ? unit.allAssets?.[work] : undefined) ?? unit.allAssets?.default ?? unit.assets
}

export function getUnitActivityActionSheet(unit: UnitEntity, work = unit.work, action = unit.action) {
  const assets = getUnitActivityAssets(unit, work)
  if (!assets) return undefined
  const key = getActionVisualSheetKey(action, unit.type, work)
  const alias = assets[key] ?? (key === SHOOTING_SHEET_KEY ? assets[SHEET_TYPES.action] : undefined)
  return alias ? Assets.cache.get(alias) : undefined
}

/** Bind the current activity without changing orders, role, or the playing animation. */
export function applyUnitActivitySpritesheets(unit: UnitEntity, work = unit.work, action = unit.action): void {
  const assets = getUnitActivityAssets(unit, work)
  if (!assets) return
  for (const key of ['standingSheet', 'walkingSheet', 'dyingSheet', 'corpseSheet', 'harvestSheet', 'shootingSheet']) {
    const alias = assets[key]
    Object.assign(unit, { [key]: alias ? Assets.cache.get(alias) : undefined })
  }
  unit.actionSheet = getUnitActivityActionSheet(unit, work, action)
}
