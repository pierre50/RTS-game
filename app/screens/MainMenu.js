import { playClickSound } from '../lib/uiSound'
import { getLang, setLang, SUPPORTED_LANGS, t } from '../lib/lang'
import { Modal } from '../lib'
import { openSaveListModal } from '../ui/saveListModal'

export default class MainMenu {
  constructor({ onStart, onLoad }) {
    this.onStart = onStart
    this.onLoad = onLoad

    this.el = document.createElement('div')
    this.el.id = 'main-menu'

    this._showMain()
    document.body.appendChild(this.el)
  }

  _btn(label, onClick, className = 'btn-dark') {
    const button = document.createElement('button')
    button.className = className
    button.textContent = label
    button.onmousedown = playClickSound
    button.onclick = onClick
    return button
  }

  _showMain() {
    this.el.innerHTML = ''

    const panel = document.createElement('div')
    panel.className = 'menu-panel menu-panel--home'

    const logo = document.createElement('img')
    logo.className = 'menu-title'
    logo.src = 'assets/logo.png'
    logo.alt = 'Dawn of Empires'
    panel.appendChild(logo)

    const divider = document.createElement('div')
    divider.className = 'menu-divider'
    panel.appendChild(divider)

    const buttons = document.createElement('div')
    buttons.className = 'button-group'
    buttons.appendChild(this._btn(t('newGame'), this.onStart))
    buttons.appendChild(this._btn(t('loadGame'), () => this._openSaveList(), 'btn-dark secondary'))
    buttons.appendChild(this._btn(t('settings'), () => this._openSettings(), 'btn-dark secondary'))
    panel.appendChild(buttons)

    const copyright = document.createElement('div')
    copyright.className = 'menu-copyright'
    copyright.textContent = '© 2026 Dawn of Empires'

    this.el.appendChild(panel)
    this.el.appendChild(copyright)
  }

  _openSettings() {
    const content = document.createElement('div')
    content.className = 'config-form'

    const row = document.createElement('div')
    row.className = 'config-row'

    const label = document.createElement('label')
    label.textContent = t('language')

    const select = document.createElement('select')
    SUPPORTED_LANGS.forEach(({ code, label }) => {
      const option = document.createElement('option')
      option.value = code
      option.textContent = label
      select.appendChild(option)
    })
    select.value = getLang()
    select.onchange = evt => {
      setLang(evt.target.value)
      this._showMain()
    }

    row.appendChild(label)
    row.appendChild(select)
    content.appendChild(row)

    new Modal({ title: t('settings'), content })
  }

  _openSaveList() {
    openSaveListModal({
      onLoad: saveData => this.onLoad(saveData),
    })
  }

  destroy() {
    this.el.remove()
  }
}
