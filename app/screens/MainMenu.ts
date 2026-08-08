import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'
import { openSettingsModal } from '../ui/settingsPanel'
import { openSaveListModal } from '../ui/saveListModal'
import { listSaves, loadSave } from '../serialization/SaveStorage'
import type { SaveRecord } from '../types/save'

export default class MainMenu {
  onStart: () => void
  onLoad: (save: SaveRecord) => void
  onMapEditor: () => void
  _onKeyDown: (evt: KeyboardEvent) => void
  _activeHomeButton: HTMLButtonElement | null
  el: HTMLDivElement

  constructor({
    onStart,
    onLoad,
    onMapEditor,
  }: {
    onStart: () => void
    onLoad: (save: SaveRecord) => void
    onMapEditor: () => void
  }) {
    this.onStart = onStart
    this.onLoad = onLoad
    this.onMapEditor = onMapEditor
    this._onKeyDown = this._handleKeyDown.bind(this)
    this._activeHomeButton = null

    this.el = document.createElement('div')
    this.el.id = 'main-menu'

    this._showMain()
    document.body.appendChild(this.el)
    this._focusFirstHomeButton()
    document.addEventListener('keydown', this._onKeyDown)
  }

  _btn(label: string, onClick: (evt: MouseEvent) => void, className: string = 'home-btn'): HTMLButtonElement {
    const button = document.createElement('button')
    button.className = className
    button.textContent = label
    if (className === 'home-btn') {
      button.addEventListener('focus', () => this._setActiveHomeButton(button))
    }
    button.addEventListener('pointerdown', playClickSound)
    button.addEventListener('click', onClick)
    return button
  }

  _showMain(): void {
    this._activeHomeButton = null
    this.el.innerHTML = ''

    const panel = document.createElement('div')
    panel.className = 'menu-panel menu-panel--home ui-panel-enter'

    const logoShell = document.createElement('div')
    logoShell.className = 'menu-title-shell'

    const logo = document.createElement('img')
    logo.className = 'menu-title'
    logo.src = 'assets/logo.png'
    logo.alt = 'Kaelor'
    logo.decoding = 'async'
    logo.fetchPriority = 'high'
    logoShell.appendChild(logo)
    panel.appendChild(logoShell)

    const revealLogo = () => {
      requestAnimationFrame(() => {
        logoShell.classList.add('is-loaded')
      })
    }

    if (logo.complete) {
      revealLogo()
    } else {
      logo.addEventListener('load', revealLogo, { once: true })
    }

    const buttons = document.createElement('div')
    buttons.className = 'button-group'
    if (listSaves().length) {
      buttons.appendChild(this._btn(t('continueGame'), () => this._continueLatestSave()))
    }
    buttons.appendChild(this._btn(t('newGame'), this.onStart))
    buttons.appendChild(this._btn(t('loadGame'), () => this._openSaveList()))
    buttons.appendChild(this._btn(t('settings'), () => this._openSettings()))
    panel.appendChild(buttons)

    const copyright = document.createElement('div')
    copyright.className = 'menu-copyright'
    copyright.textContent = '© 2026 Kaelor'

    this.el.appendChild(panel)
    this.el.appendChild(copyright)
  }

  _getHomeButtons(): HTMLButtonElement[] {
    return Array.from(this.el.querySelectorAll<HTMLButtonElement>('.menu-panel--home .home-btn'))
  }

  _focusFirstHomeButton(): void {
    const firstButton = this._getHomeButtons()[0]
    if (!firstButton) return

    this._setActiveHomeButton(firstButton)
    firstButton.focus()
  }

  _setActiveHomeButton(button: HTMLButtonElement): void {
    this._activeHomeButton?.classList.remove('is-menu-focused')
    this._activeHomeButton = button
    button.classList.add('is-menu-focused')
  }

  _handleKeyDown(evt: KeyboardEvent): void {
    if (evt.repeat || document.querySelector('.modal')) return

    const buttons = this._getHomeButtons()
    if (!buttons.length) return

    if (evt.key === 'ArrowDown' || evt.key === 'ArrowUp') {
      const focusedIndex = buttons.indexOf(this._activeHomeButton || (document.activeElement as HTMLButtonElement))
      const currentIndex = focusedIndex === -1 ? 0 : focusedIndex
      const direction = evt.key === 'ArrowDown' ? 1 : -1
      const nextIndex = (currentIndex + direction + buttons.length) % buttons.length

      evt.preventDefault()
      this._setActiveHomeButton(buttons[nextIndex])
      buttons[nextIndex].focus()
      return
    }

    if (evt.key !== 'Enter') return

    evt.preventDefault()
    playClickSound()
    const focusedButton = this._activeHomeButton || buttons[0]
    focusedButton.click()
  }

  _openSettings(): void {
    openSettingsModal({
      onLangChange: () => {
        this._showMain()
        this._focusFirstHomeButton()
      },
    })
  }

  _openSaveList(): void {
    openSaveListModal({
      onLoad: saveData => this.onLoad(saveData),
    })
  }

  _continueLatestSave(): void {
    const latestSave = listSaves()[0]
    if (!latestSave) return

    try {
      this.onLoad(loadSave(latestSave.key))
    } catch (error) {
      console.warn('[save] Unable to continue latest save', error)
      this._openSaveList()
    }
  }

  destroy(): void {
    document.removeEventListener('keydown', this._onKeyDown)
    this.el.remove()
  }
}
