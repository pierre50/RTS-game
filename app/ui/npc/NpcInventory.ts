import { UnitInventoryScreen } from '../inventory/UnitInventoryScreen'
import { playUiSound } from '../../lib/audio/uiSound'
import { SOUND_CUES } from '../../constants'
import type { NpcOrdersManager } from '../NpcOrdersManager'

export function openNpcInventory(host: NpcOrdersManager, allowed: boolean): void {
  if (host.bagModal || !allowed) return
  playUiSound(SOUND_CUES.ui.menuClick)
  host.orderMenu.reset()
  host.buttonsContainer.hidden = true
  host.bagScreen = new UnitInventoryScreen(host.menu, host.npcs[0])
  host.bagModal = host.bagScreen.open(() => host.close())
  if (host.modal?._backdrop) host.modal._backdrop.hidden = true
}

export function closeNpcInventory(host: NpcOrdersManager): void {
  const bagModal = host.bagModal
  host.bagModal = undefined
  bagModal?.close()
  if (host.modal?._backdrop) host.modal._backdrop.hidden = false
  host.bagScreen = null
  host.buttonsContainer.hidden = !host.ordersEnabled
}
