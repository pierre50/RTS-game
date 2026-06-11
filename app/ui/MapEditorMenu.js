import { Modal } from '../lib'
import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'

export class MapEditorMenu {
  constructor(hud) {
    this.hud = hud
  }

  createOpenButton() {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'topbar-options-menu ui-btn'
    button.innerText = t('menuBtn')
    button.addEventListener('pointerdown', () => this.open())
    return button
  }

  open() {
    playClickSound()

    const content = document.createElement('div')
    content.className = 'modal-menu'

    const modal = new Modal({
      title: t('menuBtn'),
      content,
    })

    content.appendChild(
      this._btn(t('save'), () => {
        this.hud.context.editor.exportMap()
        modal.close()
      })
    )

    content.appendChild(
      this._btn(t('quit'), () => {
        modal.close()
        this.hud.onQuit()
      })
    )

    content.appendChild(
      this._btn(t('cancel'), () => {
        modal.close()
      })
    )
  }

  _btn(label, onClick) {
    const button = document.createElement('button')
    button.className = 'ui-btn'
    button.innerText = label
    button.addEventListener('pointerdown', () => {
      playClickSound()
      onClick()
    })
    return button
  }
}
