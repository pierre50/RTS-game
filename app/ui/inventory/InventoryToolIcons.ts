import { updateGoldBadge } from '../ValueBadge'
import { createCombatStatInfo } from '../entity/CombatStatInfo'
import { renderEquipmentAvatarLazy } from '../equipment/EquipmentAvatar'
import type { InventoryManager } from '../InventoryManager'
import { createEquipmentRowInfo, formatGold } from './InventoryDetails'

export function renderInventoryToolIcons(this: InventoryManager): void {
  const { app } = this.menu.context
  for (const [tool, slot] of this.slots) {
    const available = this.isActiveWeaponAvailable(tool)
    slot.classList.toggle('empty', !available && tool !== 'interact')
  }
  for (const [tool, canvas] of this.toolIcons) {
    const equipment = this.getActiveWeaponEquipment(tool)
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    if (equipment) renderEquipmentAvatarLazy(app, equipment, canvas, 'inventory', this.menu.context.performance)
    const info = equipment ? createEquipmentRowInfo(equipment, 1, undefined, { showValue: false }) : undefined

    const slot = this.slots.get(tool)
    if (slot) slot.dataset.itemCategory = info?.category ?? ''
    slot
      ?.querySelector('.inventory-action-row-stats')
      ?.replaceChildren(...(info?.stats ?? []).map(createCombatStatInfo))
    const description = this.slots.get(tool)?.querySelector<HTMLSpanElement>('.inventory-action-row-description')
    if (description) description.textContent = info?.title ?? ''
    const meta = this.slots.get(tool)?.querySelector<HTMLSpanElement>('.inventory-action-row-meta')
    if (meta) meta.textContent = info?.meta ?? ''
    const value = this.slots.get(tool)?.querySelector<HTMLSpanElement>('.inventory-action-row-value')
    if (value) updateGoldBadge(value, info && info.goldValue > 0 ? formatGold(info.goldValue) : '')
  }
}
