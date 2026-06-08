import { playClickSound } from '../lib/uiSound'
import { t } from '../lib/lang'
import { Modal } from '../lib'
import { buildSettingsContent } from '../ui/settingsPanel'
import { openSaveListModal } from '../ui/saveListModal'

export default class MainMenu {
  constructor({ onStart, onLoad }) {
    this.onStart = onStart
    this.onLoad = onLoad
    this._onKeyDown = this._handleKeyDown.bind(this)

    this.el = document.createElement('div')
    this.el.id = 'main-menu'

    this._showMain()
    document.body.appendChild(this.el)
    document.addEventListener('keydown', this._onKeyDown)
  }

  _btn(label, onClick, className = 'home-btn') {
    const button = document.createElement('button')
    button.className = className
    button.textContent = label
    button.addEventListener('pointerdown', playClickSound)
    button.addEventListener('click', onClick)
    return button
  }

  _showMain() {
    this.el.innerHTML = ''

    const panel = document.createElement('div')
    panel.className = 'menu-panel menu-panel--home'

    const logoShell = document.createElement('div')
    logoShell.className = 'menu-title-shell'

    const logo = document.createElement('img')
    logo.className = 'menu-title'
    logo.src = 'assets/logo.png'
    logo.alt = 'Dawn of Empires'
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
    buttons.appendChild(this._btn(t('newGame'), this.onStart))
    buttons.appendChild(this._btn(t('loadGame'), () => this._openSaveList()))
    buttons.appendChild(this._btn(t('settings'), () => this._openSettings()))
    panel.appendChild(buttons)

    const copyright = document.createElement('div')
    copyright.className = 'menu-copyright'
    copyright.textContent = '© 2026 Dawn of Empires'

    this.el.appendChild(panel)
    this.el.appendChild(copyright)
  }

  _handleKeyDown(evt) {
    if (evt.key !== 'Enter' || evt.repeat) return
    if (document.querySelector('.modal')) return

    evt.preventDefault()
    playClickSound()
    this.onStart()
  }

  _openSettings() {
    const content = buildSettingsContent({
      onLangChange: () => this._showMain(),
    })
    new Modal({ title: t('settings'), content })
  }

  _openSaveList() {
    openSaveListModal({
      onLoad: saveData => this.onLoad(saveData),
    })
  }

  destroy() {
    document.removeEventListener('keydown', this._onKeyDown)
    this.el.remove()
  }
}
