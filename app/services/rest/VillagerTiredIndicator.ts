import { clearUnitOverheadIndicator, setUnitOverheadIndicator } from '../../lib/entities/overheadIndicator'
import { updateVillagerTiredState } from '../../lib/units/unitTired'
import type { UnitEntity } from '../../types/entities'

const TIRED_INDICATOR_PERIOD_MS = 20000
const TIRED_INDICATOR_VISIBLE_MS = 4000
const tiredIndicatorUnits = new WeakSet<UnitEntity>()

function clearTiredIndicator(unit: UnitEntity): void {
  if (!tiredIndicatorUnits.has(unit)) return
  tiredIndicatorUnits.delete(unit)
  if (unit.shelterState?.reason === 'sleep') return
  clearUnitOverheadIndicator(unit)
}

function updateTiredIndicator(unit: UnitEntity): void {
  if (!unit.tired || unit.shelterState?.reason === 'sleep' || unit.isDead || unit.isDestroyed) {
    clearTiredIndicator(unit)
    return
  }
  const elapsed = unit.context?.scheduler?.elapsedMs ?? 0
  const shouldShow = elapsed % TIRED_INDICATOR_PERIOD_MS < TIRED_INDICATOR_VISIBLE_MS
  if (!shouldShow) {
    clearTiredIndicator(unit)
    return
  }
  if (tiredIndicatorUnits.has(unit)) return
  setUnitOverheadIndicator(unit, 'sleep')
  tiredIndicatorUnits.add(unit)
}

export function updateVillagerTired(unit: UnitEntity): void {
  updateVillagerTiredState(unit)
  updateTiredIndicator(unit)
}
