import { heroCanCommand } from '../../lib/chief'
import { getUnitEquipmentLevel, setUnitDebugLevel, XP_MAX_LEVEL } from '../../lib/units/unitExperience'
import { refreshUnitEquipmentStats } from '../../lib/equipment/equipmentStats'
import { ensureAndRefreshBakedLpcUnitAssets } from '../../lib/lpc'
import { UNIT_TYPES } from '../../constants'
import { createTitledEntityInfoContent } from '../EntityInfoContent'
import type { UnitEntity } from '../../types/entities'
import type { MenuHost } from '../MenuHost'

export async function cycleNpcDebugLevel(menu: MenuHost, target: UnitEntity, info: HTMLElement): Promise<void> {
  setUnitDebugLevel(target, Math.min(XP_MAX_LEVEL, getUnitEquipmentLevel(target) + 1))
  refreshUnitEquipmentStats(target)
  await ensureAndRefreshBakedLpcUnitAssets(target)
  info.replaceChildren()
  if (target.interface?.info) {
    info.appendChild(
      createTitledEntityInfoContent(menu.context.app, target, {
        hideStats: !heroCanCommand(menu.context.controls?.heroUnit),
      })
    )
  }
}

export function updateNpcDebugControls(
  menu: MenuHost,
  target: UnitEntity | null,
  container: HTMLElement,
  button: HTMLButtonElement
): void {
  const show = Boolean(heroCanCommand(menu.context.controls?.heroUnit) && target && target.type !== UNIT_TYPES.villager)
  container.hidden = !show
  if (!target || !show) return
  const level = getUnitEquipmentLevel(target)
  button.disabled = level >= XP_MAX_LEVEL
  button.textContent = level >= XP_MAX_LEVEL ? 'Debug niveau max' : `Debug niveau ${Math.min(XP_MAX_LEVEL, level + 1)}`
}
