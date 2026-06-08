import { Modal } from '../lib'
import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'
import { buildSettingsContent } from './settingsPanel'
import { openSaveListModal } from './saveListModal'

export class PauseMenu {
  constructor(menu) {
    this.menu = menu
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
    const { menu } = this
    playClickSound()
    menu.context.pause()

    const content = document.createElement('div')
    content.className = 'modal-menu'

    const modal = new Modal({
      title: t('menuBtn'),
      content,
      onClose: () => menu.context.resume(),
    })

    content.appendChild(
      this._btn(t('save'), () => {
        try {
          menu.context.save()
          modal.close()
          menu.context.resume()
          menu.showMessage(t('saveSuccess'), 'success')
        } catch (e) {
          menu.showMessage(e.message === 'MAX_SAVES_REACHED' ? t('maxSavesReached') : t('storageFull'), 'warning')
        }
      })
    )

    content.appendChild(
      this._btn(t('loadGame'), () => {
        modal.close()
        this._openSaveList()
      })
    )

    content.appendChild(
      this._btn(t('settings'), () => {
        modal.close()
        this._openSettings()
      })
    )

    content.appendChild(
      this._btn(t('quit'), () => {
        modal.close()
        menu.context.quit()
      })
    )
  }

  _openSettings() {
    const { menu } = this
    const content = buildSettingsContent({
      onSpeedChange: v => {
        menu.context.app.ticker.speed = v
        if (menu.context.scheduler) {
          menu.context.scheduler.timeScale = v
        }
      },
      onZoomChange: () => {
        menu.context.applyZoom()
        menu.context.controls?.updateVisibleCells()
        menu.updateCameraMiniMap()
      },
    })

    new Modal({
      title: t('settings'),
      content,
      onClose: () => menu.context.resume(),
    })
  }

  _openSaveList() {
    const { menu } = this
    openSaveListModal({
      onLoad: saveData => menu.context.load(saveData),
      onError: msg => menu.showMessage(msg, 'error'),
      onClose: () => menu.context.resume(),
    })
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
