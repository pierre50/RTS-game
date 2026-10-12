import { getHeroEquipmentSlotLabelKey } from '../../lib/equipment/equipmentSlots'
import { isSlingshot } from '../../lib/equipment/rangedWeapon'
import { createInventoryResourceRow } from './InventoryItemRows'
import type { HeroEquipmentSlot } from '../../types/entities'
import type { InventoryManager } from '../InventoryManager'
import { renderUnitBodyAvatar } from '../../lib/avatar'
import { t } from '../../lib/lang'

function labelSlot(row: HTMLElement, label: string): void {
  row.dataset.slotLabel = label
  row.title = row.getAttribute('aria-label') ?? label
}

export function arrangeInventoryEquipment(host: InventoryManager): void {
  const hero = host.menu.context.controls.heroUnit
  if (!hero) return
  const grid = host.equippedPanel.querySelector<HTMLElement>('.inventory-section-list')
  const weapons = host.weaponPanel.querySelector<HTMLElement>('.inventory-section-list')
  if (!grid || !weapons) return
  grid.classList.add('inventory-paper-doll')
  const portrait = document.createElement('canvas')
  portrait.width = 320
  portrait.height = 320
  portrait.className = 'inventory-body-portrait'
  portrait.setAttribute('aria-label', t('inventoryCharacter'))
  grid.prepend(portrait)
  renderUnitBodyAvatar(host.menu.context.app, hero, portrait)
  for (const row of grid.querySelectorAll<HTMLElement>('.inventory-action-row')) {
    const slot = row.id.replace('inventory-equipped-', '') as HeroEquipmentSlot
    labelSlot(row, t(getHeroEquipmentSlotLabelKey(slot)))
  }
  grid.querySelector('#inventory-equipped-helmet')?.setAttribute('data-window-default', '')
  for (const [tool, row] of host.slots) {
    labelSlot(
      row,
      t(tool === 'sword' ? 'inventoryMeleeShort' : tool === 'bow' ? 'inventoryRangedShort' : 'heroToolInteract')
    )
  }
  const arrows = grid.querySelector<HTMLElement>('#inventory-equipped-arrow')
  if (isSlingshot(hero.inventory?.activeWeapons?.ranged)) {
    arrows?.remove()
    const amount = Math.max(0, Math.floor(hero.inventory?.resources?.stone ?? 0))
    const { element } = createInventoryResourceRow({
      id: 'inventory-ranged-stones',
      resource: 'stone',
      amount,
      className: 'inventory-ranged-stones',
      description: t('inventorySlingshotAmmoHint'),
      showValue: false,
    })
    labelSlot(element, t('heroEquipmentSlotArrow'))
    element.classList.toggle('is-depleted', amount === 0)
    if (amount < 2) {
      const count = document.createElement('span')
      count.className = 'inventory-quantity-badge'
      count.textContent = `x${amount}`
      element.appendChild(count)
    }
    weapons.appendChild(element)
  } else if (arrows) {
    const plus = document.createElement('span')
    plus.className = 'inventory-ranged-plus'
    plus.textContent = '+'
    plus.setAttribute('aria-hidden', 'true')
    weapons.appendChild(plus)
    weapons.appendChild(arrows)
  }
  host.weaponPanel.querySelector('.inventory-section-title')?.remove()
}
