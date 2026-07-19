import { t } from '../lib/lang'
import { playUiSound } from '../lib/uiSound'
import { SOUND_CUES } from '../constants'
import {
  resumeNpcWork,
  sendNpcToStockpile,
  keepNpcHere,
  startFollowingHero,
  releaseIfStillLooking,
  playNpcOrderSound,
} from '../lib/npcInteraction'
import type Menu from '../classes/Menu'
import type { UnitEntity } from '../types/entities'

type NpcOrderId = 'resume' | 'stockpile' | 'stay' | 'follow' | 'goto'

const NPC_ORDER_SPECS: { id: NpcOrderId; labelKey: string; run?: (npc: UnitEntity) => void; startsPicking?: boolean }[] = [
  { id: 'goto', labelKey: 'npcOrderGoTo', startsPicking: true },
  { id: 'follow', labelKey: 'npcOrderFollow', run: startFollowingHero },
  { id: 'stay', labelKey: 'npcOrderStay', run: keepNpcHere },
  { id: 'resume', labelKey: 'npcOrderResume', run: resumeNpcWork },
  { id: 'stockpile', labelKey: 'npcOrderStockpile', run: sendNpcToStockpile },
]

export class NpcOrdersManager {
  menu: Menu
  panel: HTMLDivElement
  header: HTMLDivElement
  title: HTMLDivElement
  closeButton: HTMLButtonElement
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
    this.panel.className = 'npc-orders-panel modal-panel ui-panel-enter hidden'
    this.panel.setAttribute('role', 'dialog')

    this.header = document.createElement('div')
    this.header.className = 'npc-orders-header modal-header'

    this.title = document.createElement('div')
    this.title.className = 'npc-orders-title modal-title'

    this.closeButton = document.createElement('button')
    this.closeButton.type = 'button'
    this.closeButton.className = 'npc-orders-close modal-close ui-btn'
    this.closeButton.textContent = '✕'
    this.closeButton.setAttribute('aria-label', t('close'))
    this.closeButton.addEventListener('click', () => {
      playUiSound(SOUND_CUES.ui.menuClick)
      this.close()
    })

    this.header.appendChild(this.title)
    this.header.appendChild(this.closeButton)
    this.panel.appendChild(this.header)

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

    menu.gameHud.appendChild(this.panel)
  }

  open(npcs: UnitEntity[]): void {
    if (!this.opened) {
      this.shouldResumeOnClose = !this.menu.context.paused
      if (this.shouldResumeOnClose) this.menu.context.pause?.()
    }
    this.npcs = npcs
    this.opened = true
    this.title.textContent = npcs.length > 1 ? t('npcOrdersTitleCount', { count: npcs.length }) : t('npcOrdersTitle')
    const stockpileButton = this.buttons.get('stockpile')
    if (stockpileButton) {
      stockpileButton.disabled = !npcs.some(npc => (npc.loading ?? 0) > 0)
      stockpileButton.classList.toggle('disabled', stockpileButton.disabled)
    }
    this.panel.classList.remove('hidden')
  }

  close(keepFrozen = false): void {
    const shouldResume = this.shouldResumeOnClose
    if (!keepFrozen) releaseIfStillLooking(this.npcs)
    this.opened = false
    this.shouldResumeOnClose = false
    this.npcs = []
    this.panel.classList.add('hidden')
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
    this.panel.remove()
  }
}
