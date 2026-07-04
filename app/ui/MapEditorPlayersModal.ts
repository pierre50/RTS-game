import { Modal } from '../lib'
import { t } from '../lib/lang'
import { playClickSound } from '../lib/uiSound'
import { PlayerSetupPanel } from './PlayerSetupPanel'
import type { PlayerSetupConfig } from '../types/save'

export class MapEditorPlayersModal {
  size: number
  players: PlayerSetupConfig[]
  maxPlayers: number
  onSave?: (players: PlayerSetupConfig[]) => void
  _modal: Modal
  playerSetupPanel!: PlayerSetupPanel

  constructor({
    size,
    players,
    maxPlayers,
    onSave,
  }: {
    size: number
    players: PlayerSetupConfig[]
    maxPlayers: number
    onSave?: (players: PlayerSetupConfig[]) => void
  }) {
    this.size = size
    this.players = players
    this.maxPlayers = maxPlayers
    this.onSave = onSave

    this._modal = new Modal({
      title: t('players'),
      content: this._buildContent(),
    })
  }

  _buildContent(): HTMLDivElement {
    const content = document.createElement('div')
    content.className = 'map-editor-players-modal'
    const layout = document.createElement('div')
    layout.className = 'lobby-layout lobby-layout--wide'

    this.playerSetupPanel = new PlayerSetupPanel({
      players: this.players,
      maxPlayers: this.maxPlayers,
      showAge: true,
    })

    layout.appendChild(this.playerSetupPanel.element)
    content.appendChild(layout)

    const buttons = document.createElement('div')
    buttons.className = 'button-group button-group--row'
    buttons.appendChild(this._btn(t('save'), () => this._submit()))
    buttons.appendChild(this._btn(t('cancel'), () => this.destroy()))
    content.appendChild(buttons)

    return content
  }

  _btn(label: string, onClick: (evt: MouseEvent) => void): HTMLButtonElement {
    const button = document.createElement('button')
    button.className = 'ui-btn'
    button.textContent = label
    button.addEventListener('pointerdown', playClickSound)
    button.addEventListener('click', onClick)
    return button
  }

  _submit(): void {
    this.onSave?.(this.playerSetupPanel.getPlayers())
    this.destroy()
  }

  destroy(): void {
    this._modal.close()
  }
}
