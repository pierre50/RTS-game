import { hasNpcWeaponInventory, getNpcWeaponChoice } from '../combat/npcWeapons'
import { syncNpcWeaponAppearance } from './npcWeaponAppearance'
import { Assets } from 'pixi.js'
import { usesArcherDagger } from '../combat/unitArrows'
import { SHEET_TYPES } from '../../../constants'
import { getActionVisualSheetKey, SHOOTING_SHEET_KEY } from './actionVisualSheet'
import type { UnitEntity } from '../../../types/entities'

function getUnitActivityAssets(unit: UnitEntity, work = unit.work) {
  return (work ? unit.allAssets?.[work] : undefined) ?? unit.allAssets?.default ?? unit.assets
}

export function getUnitActivityActionSheet(unit: UnitEntity, work = unit.work, action = unit.action) {
  const assets = getUnitActivityAssets(unit, work)
  if (!assets) return undefined
  const npcCombat = action === 'attack' && hasNpcWeaponInventory(unit)
  const key = npcCombat
    ? getNpcWeaponChoice(unit).kind === 'ranged'
      ? SHOOTING_SHEET_KEY
      : 'meleeSheet'
    : getActionVisualSheetKey(action, unit.type, work, usesArcherDagger(unit))
  const alias =
    assets[key] ?? (key === SHOOTING_SHEET_KEY || key === 'meleeSheet' ? assets[SHEET_TYPES.action] : undefined)
  return alias ? Assets.cache.get(alias) : undefined
}

/** Bind the current activity without changing orders, role, or the playing animation. */
export function applyUnitActivitySpritesheets(unit: UnitEntity, work = unit.work, action = unit.action): void {
  syncNpcWeaponAppearance(unit, action)
  const assets = getUnitActivityAssets(unit, work)
  if (!assets) return
  for (const key of [
    'standingSheet',
    'sittingSheet',
    'walkingSheet',
    'dyingSheet',
    'corpseSheet',
    'harvestSheet',
    'shootingSheet',
  ]) {
    const alias = assets[key]
    Object.assign(unit, { [key]: alias ? Assets.cache.get(alias) : undefined })
  }
  unit.actionSheet = getUnitActivityActionSheet(unit, work, action)
}
