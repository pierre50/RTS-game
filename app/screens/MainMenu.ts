import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'
import { Modal } from '../lib'
import { buildSettingsContent } from '../ui/settingsPanel'
import { openSaveListModal } from '../ui/saveListModal'

type AnyRecord = Record<string, any>

export default class MainMenu {
  onStart: () => void
  onLoad: (save: AnyRecord) => void
  onMapEditor: () => void
  _onKeyDown: (evt: KeyboardEvent) => void
  el: HTMLDivElement

  constructor({ onStart, onLoad, onMapEditor }: { onStart: () => void; onLoad: (save: AnyRecord) => void; onMapEditor: () => void }) {
    this.onStart = onStart
    this.onLoad = onLoad
    this.onMapEditor = onMapEditor
    this._onKeyDown = this._handleKeyDown.bind(this)

    this.el = document.createElement('div')
    this.el.id = 'main-menu'

    this._showMain()
    document.body.appendChild(this.el)
    document.addEventListener('keydown', this._onKeyDown)
  }

  _btn(label: string, onClick: (evt: MouseEvent) => void, className: string = 'home-btn'): HTMLButtonElement {
    const button = document.createElement('button')
    button.className = className
    button.textContent = label
    button.addEventListener('pointerdown', playClickSound)
    button.addEventListener('click', onClick)
    return button
  }

  _showMain(): void {
    this.el.innerHTML = ''

    const panel = document.createElement('div')
    panel.className = 'menu-panel menu-panel--home ui-panel-enter'

    const logoShell = document.createElement('div')
    logoShell.className = 'menu-title-shell'

    const logo = document.createElement('img')
    logo.className = 'menu-title'
    logo.src = 'assets/logo.png'
    logo.alt = 'Dawn of Empires'
    logo.decoding = 'async'
    ;(logo as any).fetchPriority = 'high'
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
    buttons.appendChild(this._btn(t('newGame'), this.onStart))
    buttons.appendChild(this._btn(t('mapEditor'), this.onMapEditor))
    buttons.appendChild(this._btn(t('loadGame'), () => this._openSaveList()))
    buttons.appendChild(this._btn(t('settings'), () => this._openSettings()))
    panel.appendChild(buttons)

    const copyright = document.createElement('div')
    copyright.className = 'menu-copyright'
    copyright.textContent = '© 2026 Dawn of Empires'

    this.el.appendChild(panel)
    this.el.appendChild(copyright)
  }

  _handleKeyDown(evt: KeyboardEvent): void {
    if (evt.key !== 'Enter' || evt.repeat) return
    if (document.querySelector('.modal')) return

    evt.preventDefault()
    playClickSound()
    this.onStart()
  }

  _openSettings(): void {
    const content = buildSettingsContent({
      onLangChange: () => this._showMain(),
    })
    new Modal({ title: t('settings'), content })
  }

  _openSaveList(): void {
    openSaveListModal({
      onLoad: (saveData: AnyRecord) => this.onLoad(saveData),
    } as any)
  }

  destroy(): void {
    document.removeEventListener('keydown', this._onKeyDown)
    this.el.remove()
  }
}
