import { Modal } from '../lib'
import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'

type AnyRecord = Record<string, any>

export class MapEditorMenu {
  hud: AnyRecord

  constructor(hud: AnyRecord) {
    this.hud = hud
  }

  createOpenButton(): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'topbar-options-menu ui-btn'
    button.innerText = t('menuBtn')
    button.addEventListener('pointerdown', playClickSound)
    button.addEventListener('click', () => this.open())
    return button
  }

  open(): void {
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

  _btn(label: string, onClick: (evt: MouseEvent) => void): HTMLButtonElement {
    const button = document.createElement('button')
    button.className = 'ui-btn'
    button.innerText = label
    button.addEventListener('pointerdown', playClickSound)
    button.addEventListener('click', onClick)
    return button
  }
}
