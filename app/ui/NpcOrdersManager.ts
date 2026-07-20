import { Modal } from '../lib'
import { t } from '../lib/lang'
import { playUiSound } from '../lib/uiSound'
import { SOUND_CUES } from '../constants'
import {
  sendNpcToStockpile,
  keepNpcHere,
  startFollowingHero,
  releaseIfStillLooking,
  playNpcOrderSound,
} from '../lib/npcInteraction'
import type Menu from '../classes/Menu'
import type { UnitEntity } from '../types/entities'

type NpcOrderId = 'stockpile' | 'stay' | 'follow' | 'goto'

const NPC_ORDER_SPECS: {
  id: NpcOrderId
  labelKey: string
  run?: (npc: UnitEntity) => void
  startsPicking?: boolean
}[] = [
  { id: 'goto', labelKey: 'npcOrderGoTo', startsPicking: true },
  { id: 'follow', labelKey: 'npcOrderFollow', run: startFollowingHero },
  { id: 'stay', labelKey: 'npcOrderStay', run: keepNpcHere },
  { id: 'stockpile', labelKey: 'npcOrderStockpile', run: sendNpcToStockpile },
]

export class NpcOrdersManager {
  menu: Menu
  panel: HTMLDivElement
  modal?: Modal
  buttons: Map<NpcOrderId, HTMLButtonElement>
  opened: boolean
  shouldResumeOnClose: boolean
  npcs: UnitEntity[]

  constructor(menu: Menu) {
    this.menu = menu
    this.opened = false
    this.shouldResumeOnClose = false
    this.npcs = []
    this.buttons = new Map()

    this.panel = document.createElement('div')
    this.panel.className = 'npc-orders-options'

    for (const spec of NPC_ORDER_SPECS) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'npc-orders-option ui-btn'
      button.textContent = t(spec.labelKey)
      button.addEventListener('click', () => {
        if (!this.npcs.length || button.disabled) return
        playUiSound(SOUND_CUES.ui.menuClick)
        const npcs = this.npcs
        if (spec.startsPicking) {
          // Still committed to an order (waiting on the world click) — don't resume old tasks yet.
          this.close(true)
          this.menu.context.controls.beginNpcGoTo?.(npcs)
          return
        }
        for (const npc of npcs) spec.run?.(npc)
        playNpcOrderSound(npcs)
        this.close()
      })
      this.buttons.set(spec.id, button)
      this.panel.appendChild(button)
    }
  }

  open(npcs: UnitEntity[]): void {
    if (!this.opened) {
      this.shouldResumeOnClose = !this.menu.context.paused
      if (this.shouldResumeOnClose) this.menu.context.pause?.()
    }
    this.npcs = npcs
    this.opened = true
    const title = npcs.length > 1 ? t('npcOrdersTitleCount', { count: npcs.length }) : t('npcOrdersTitle')
    const stockpileButton = this.buttons.get('stockpile')
    if (stockpileButton) {
      stockpileButton.disabled = !npcs.some(npc => (npc.loading ?? 0) > 0)
      stockpileButton.classList.toggle('disabled', stockpileButton.disabled)
    }
    if (this.modal) {
      this.modal._panel!.querySelector('.modal-title')!.textContent = title
      return
    }
    this.modal = new Modal({
      title,
      content: this.panel,
      onClose: () => this.close(),
    })
    this.modal._panel?.classList.add('npc-orders-panel')
  }

  close(keepFrozen = false): void {
    if (!this.opened && !this.modal) return
    const shouldResume = this.shouldResumeOnClose
    const modal = this.modal
    this.modal = undefined
    if (!keepFrozen) releaseIfStillLooking(this.npcs)
    this.opened = false
    this.shouldResumeOnClose = false
    this.npcs = []
    modal?.close()
    if (shouldResume) this.menu.context.resume?.()
  }

  toggle(npcs: UnitEntity[]): void {
    if (this.opened) {
      this.close()
      return
    }
    this.open(npcs)
  }

  isOpen(): boolean {
    return this.opened
  }

  getTarget(): UnitEntity[] {
    return this.npcs
  }

  destroy(): void {
    this.modal?.close()
    this.modal = undefined
  }
}
