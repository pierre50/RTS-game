import { Modal } from '../lib'
import { playClickSound } from '../lib/audio/uiSound'
import { t } from '../lib/lang'
import { openSettingsModal } from './modals/settingsPanel'
import { openSaveListModal } from './modals/saveListModal'
import type { MenuHost } from './MenuHost'

export class PauseMenu {
  menu: MenuHost
  private modal?: Modal

  constructor(menu: MenuHost) {
    this.menu = menu
  }

  createOpenButton(): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'topbar-options-menu ui-btn'
    button.setAttribute('aria-label', t('menuBtn'))

    const icon = document.createElement('span')
    icon.className = 'topbar-options-menu-icon'
    icon.setAttribute('aria-hidden', 'true')
    for (let i = 0; i < 3; i += 1) {
      icon.appendChild(document.createElement('span'))
    }
    button.appendChild(icon)

    button.addEventListener('pointerdown', playClickSound)
    button.addEventListener('click', () => {
      button.blur()
      this.open()
    })
    return button
  }

  toggle(): void {
    if (this.modal && !this.modal._closed) {
      if (this.modal._isTopmost()) this.modal._dismiss()
      return
    }
    if (!document.querySelector('.modal')) this.open()
  }

  open(): void {
    const { menu } = this
    const shouldResume = !menu.context.paused
    if (shouldResume) menu.context.pause?.()
    const resumeIfNeeded = () => {
      if (shouldResume) menu.context.resume?.()
    }

    const content = document.createElement('div')
    content.className = 'modal-menu pause-menu'

    const modal = new Modal({
      title: t('menuBtn'),
      content,
      onClose: resumeIfNeeded,
    })

    this.modal = modal
    modal._panel?.classList.add('pause-panel')
    content.appendChild(
      this._btn(t('continueGame'), () => {
        modal.close()
        resumeIfNeeded()
      })
    )

    const saveButton = this._btn(t('save'), async () => {
      if (saveButton.disabled) return
      saveButton.disabled = true
      saveButton.textContent = t('savingWorld')
      try {
        if (!menu.context.save) throw new Error('SAVE_HANDLER_UNAVAILABLE')
        await menu.context.save()
        modal.close()
        resumeIfNeeded()
        menu.showMessage(t('saveSuccess'), 'success')
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        console.error(`[save] Manual save failed: ${message}`, e)
        menu.showMessage(
          message === 'MAX_SAVES_REACHED'
            ? t('maxSavesReached')
            : message === 'SAVE_RESTART_ELECTRON_REQUIRED'
              ? t('saveRestartRequired')
              : t('saveFailed'),
          'warning'
        )
      } finally {
        saveButton.disabled = false
        saveButton.textContent = t('save')
      }
    })
    content.appendChild(saveButton)

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
      this._btn(t('quit'), () => {
        modal.close()
        menu.context.quit?.()
      })
    )
  }

  _openSettings(resumeIfNeeded: () => void): void {
    const { menu } = this
    openSettingsModal({
      onSpeedChange: v => {
        menu.context.app.ticker.speed = v
        if (menu.context.scheduler) {
          menu.context.scheduler.timeScale = v
        }
      },
      onZoomChange: () => {
        menu.context.applyZoom?.()
        menu.context.controls?.updateVisibleCells?.()
        if (menu.isMiniMapActive()) menu.updateCameraMiniMap()
      },
      onClose: resumeIfNeeded,
    })
  }

  _openSaveList(resumeIfNeeded: () => void): void {
    const { menu } = this
    openSaveListModal({
      onLoad: saveData => menu.context.load?.(saveData),
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
