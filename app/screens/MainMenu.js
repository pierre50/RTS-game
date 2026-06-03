import { playClickSound } from '../lib/uiSound'
import { getLang, setLang, SUPPORTED_LANGS, t } from '../lib/lang'
import { parseSaveJSON } from '../serialization/SaveValidator'

export default class MainMenu {
  constructor({ onStart, onLoad }) {
    this.onStart = onStart
    this.onLoad = onLoad

    this.el = document.createElement('div')
    this.el.id = 'main-menu'

    this._showMain()
    document.body.appendChild(this.el)
  }

  _clear() {
    this.el.innerHTML = ''
  }

  _createButton(label, onClick, className = 'btn-dark') {
    const button = document.createElement('button')
    button.className = className
    button.textContent = label
    button.onmousedown = playClickSound
    button.onclick = onClick
    return button
  }

  _createPanel(subtitleKey, { logo = true } = {}) {
    const panel = document.createElement('div')
    panel.className = 'menu-panel'

    if (logo) {
      const title = document.createElement('img')
      title.className = 'menu-title'
      title.src = 'assets/logo.png'
      title.alt = 'Dawn of Empires'
      panel.appendChild(title)

    } else {
      const title = document.createElement('div')
      title.className = 'menu-title'
      title.textContent = t(subtitleKey)
      panel.appendChild(title)
    }

    const divider = document.createElement('div')
    divider.className = 'menu-divider'
    panel.appendChild(divider)

    return panel
  }

  _showMain() {
    this._clear()
    const panel = this._createPanel()
    panel.classList.add('menu-panel--home')
    const buttons = document.createElement('div')
    buttons.className = 'button-group'

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.json'
    fileInput.classList.add('hidden')
    fileInput.onchange = evt => {
      const file = evt.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = e => {
        try {
          this.onLoad(parseSaveJSON(e.target.result))
        } catch (error) {
          alert(t('invalidSaveFile'))
          console.error(error)
        } finally {
          fileInput.value = ''
        }
      }
      reader.readAsText(file)
    }

    buttons.appendChild(this._createButton(t('newGame'), this.onStart))
    buttons.appendChild(this._createButton(t('loadGame'), () => fileInput.click(), 'btn-dark secondary'))
    buttons.appendChild(this._createButton(t('settings'), () => this._showSettings(), 'btn-dark secondary'))
    buttons.appendChild(fileInput)

    const copyright = document.createElement('div')
    copyright.className = 'menu-copyright'
    copyright.textContent = '© 2026 Dawn of Empires'

    panel.appendChild(buttons)
    this.el.appendChild(panel)
    this.el.appendChild(copyright)
  }

  _showSettings() {
    this._clear()
    const panel = this._createPanel('settings', { logo: false })
    const form = document.createElement('div')
    form.className = 'config-form'

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
      this._showSettings()
    }

    row.appendChild(label)
    row.appendChild(select)
    form.appendChild(row)

    const buttons = document.createElement('div')
    buttons.className = 'button-group'

    buttons.appendChild(this._createButton(t('back'), () => this._showMain(), 'btn-dark secondary'))
    panel.appendChild(form)
    panel.appendChild(buttons)
    this.el.appendChild(panel)
  }

  destroy() {
    this.el.remove()
  }
}
