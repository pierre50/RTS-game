import { Modal } from '../lib'
import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'
import { buildSettingsContent } from './settingsPanel'
import { openSaveListModal } from './saveListModal'

type AnyRecord = Record<string, any>

export class PauseMenu {
  menu: AnyRecord

  constructor(menu: AnyRecord) {
    this.menu = menu
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
    const { menu } = this
    const shouldResume = !menu.context.paused
    if (shouldResume) menu.context.pause()
    const resumeIfNeeded = () => {
      if (shouldResume) menu.context.resume()
    }

    const content = document.createElement('div')
    content.className = 'modal-menu'

    const modal = new Modal({
      title: t('menuBtn'),
      content,
      onClose: resumeIfNeeded,
    })

    content.appendChild(
      this._btn(t('save'), () => {
        try {
          menu.context.save()
          modal.close()
          resumeIfNeeded()
          menu.showMessage(t('saveSuccess'), 'success')
        } catch (e: any) {
          menu.showMessage(e.message === 'MAX_SAVES_REACHED' ? t('maxSavesReached') : t('storageFull'), 'warning')
        }
      })
    )

    content.appendChild(
      this._btn(t('loadGame'), () => {
        modal.close()
        this._openSaveList(resumeIfNeeded)
      })
    )

    content.appendChild(
      this._btn(t('settings'), () => {
        modal.close()
        this._openSettings(resumeIfNeeded)
      })
    )

    content.appendChild(
      this._btn(t('restart'), () => {
        modal.close()
        menu.context.restart()
      })
    )

    content.appendChild(
      this._btn(t('quit'), () => {
        modal.close()
        menu.context.quit()
      })
    )
  }

  _openSettings(resumeIfNeeded: () => void): void {
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
      onClose: resumeIfNeeded,
    })
  }

  _openSaveList(resumeIfNeeded: () => void): void {
    const { menu } = this
    openSaveListModal({
      onLoad: saveData => menu.context.load(saveData),
      onError: msg => menu.showMessage(msg, 'error'),
      onClose: resumeIfNeeded,
    })
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
