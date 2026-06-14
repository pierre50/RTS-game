import { Modal } from '../lib'
import { t } from '../lib/lang'
import { playClickSound } from '../lib/uiSound'
import { PlayerSetupPanel } from './PlayerSetupPanel'

export class MapEditorPlayersModal {
  constructor({ size, players, maxPlayers, onSave }) {
    this.size = size
    this.players = players
    this.maxPlayers = maxPlayers
    this.onSave = onSave

    this._modal = new Modal({
      title: t('players'),
      content: this._buildContent(),
    })
  }

  _buildContent() {
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

  _btn(label, onClick) {
    const button = document.createElement('button')
    button.className = 'ui-btn'
    button.textContent = label
    button.addEventListener('pointerdown', playClickSound)
    button.addEventListener('click', onClick)
    return button
  }

  _submit() {
    this.onSave?.(this.playerSetupPanel.getPlayers())
    this.destroy()
  }

  destroy() {
    this._modal.close()
  }
}
