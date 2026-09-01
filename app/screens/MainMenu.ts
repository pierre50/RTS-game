import type { Application } from 'pixi.js'
import { playClickSound } from '../lib/audio/uiSound'
import { t } from '../lib/lang'
import { openSettingsModal } from '../ui/modals/settingsPanel'
import { openSaveListModal } from '../ui/modals/saveListModal'
import { listSaves, loadSave } from '../serialization/SaveStorage'
import { MainMenuBackdrop } from './MainMenuBackdrop'
import type { SaveRecord } from '../types/save'

declare global {
  interface Window {
    electronApp?: {
      quit(): void
    }
  }
}

export default class MainMenu {
  app?: Application
  backdrop?: MainMenuBackdrop
  onStart: () => void
  onLoad: (save: SaveRecord) => void
  _onKeyDown: (evt: KeyboardEvent) => void
  _activeHomeButton: HTMLButtonElement | null
  el: HTMLDivElement

  constructor({
    app,
    onStart,
    onLoad,
  }: {
    app?: Application
    onStart: () => void
    onLoad: (save: SaveRecord) => void
  }) {
    this.app = app
    this.backdrop = app ? new MainMenuBackdrop(app) : undefined
    this.onStart = onStart
    this.onLoad = onLoad
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

    const logo = document.createElement('h1')
    logo.className = 'menu-title'
    for (const letter of 'KAELOR') {
      const letterEl = document.createElement('span')
      letterEl.textContent = letter
      logo.appendChild(letterEl)
    }
    logoShell.appendChild(logo)
    panel.appendChild(logoShell)

    void this._revealLogoWhenFontsAreReady(logoShell)

    const buttons = document.createElement('div')
    buttons.className = 'button-group'
    if (listSaves().length) {
      buttons.appendChild(this._btn(t('continueGame'), () => this._continueLatestSave()))
    }
    buttons.appendChild(this._btn(t('newGame'), this.onStart))
    buttons.appendChild(this._btn(t('loadGame'), () => this._openSaveList()))
    buttons.appendChild(this._btn(t('settings'), () => this._openSettings()))
    buttons.appendChild(this._btn(t('quit'), () => this._quitGame()))
    panel.appendChild(buttons)

    const heroShell = document.createElement('div')
    heroShell.className = 'menu-hero-shell'

    const hero = document.createElement('img')
    hero.className = 'menu-hero'
    hero.src = '/assets/graphics/ui/hero.png'
    hero.alt = 'Hero Image'
    heroShell.appendChild(hero)

    const copyright = document.createElement('div')
    copyright.className = 'menu-copyright'
    copyright.textContent = '© 2026 Kaelor'

    this.el.appendChild(panel)
    this.el.appendChild(heroShell)
    this.el.appendChild(copyright)
  }

  async _revealLogoWhenFontsAreReady(logoShell: HTMLDivElement): Promise<void> {
    try {
      if ('fonts' in document) {
        await document.fonts.load('400 50px marcellus-sc', 'KAELOR')
        await document.fonts.ready
      }
    } finally {
      requestAnimationFrame(() => {
        logoShell.classList.add('is-loaded')
      })
    }
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
      onLangChange: () => this._refreshHome(),
    })
  }

  _openSaveList(): void {
    openSaveListModal({
      onLoad: saveData => this.onLoad(saveData),
      onChange: () => this._refreshHome(),
    })
  }

  _refreshHome(): void {
    this._showMain()
    this._focusFirstHomeButton()
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

  _quitGame(): void {
    if (window.electronApp) {
      window.electronApp.quit()
      return
    }

    window.close()
  }

  destroy(): void {
    document.removeEventListener('keydown', this._onKeyDown)
    this.backdrop?.destroy()
    this.backdrop = undefined
    this.el.remove()
  }
}
