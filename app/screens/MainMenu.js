import { playClickSound } from '../lib/uiSound'
import { getLang, setLang, SUPPORTED_LANGS, t } from '../lib/lang'

export default class MainMenu {
  constructor(onStart, onLoad) {
    this.onStart = onStart
    this.onLoad = onLoad

    this.el = document.createElement('div')
    this.el.id = 'main-menu'
    this.el.style.backgroundImage = "url('/assets/background/bg1.png')"

    this._showMain()
    document.body.appendChild(this.el)
  }

  _clear() {
    this.el.innerHTML = ''
  }

  _createPanel(subtitleKey, { logo = true } = {}) {
    const panel = document.createElement('div')
    panel.className = 'menu-panel'

    if (logo) {
      const title = document.createElement('img')
      title.className = 'menu-title'
      title.src = '/assets/logo.png'
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
    buttons.className = 'menu-buttons'

    const btnStart = document.createElement('button')
    btnStart.className = 'menu-btn'
    btnStart.textContent = t('newGame')
    btnStart.onmousedown = playClickSound
    btnStart.onclick = this.onStart

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.json'
    fileInput.style.display = 'none'
    fileInput.onchange = evt => {
      const file = evt.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = e => this.onLoad(JSON.parse(e.target.result))
      reader.readAsText(file)
    }

    const btnLoad = document.createElement('button')
    btnLoad.className = 'menu-btn secondary'
    btnLoad.textContent = t('loadGame')
    btnLoad.onmousedown = playClickSound
    btnLoad.onclick = () => fileInput.click()

    const btnSettings = document.createElement('button')
    btnSettings.className = 'menu-btn secondary'
    btnSettings.textContent = t('settings')
    btnSettings.onmousedown = playClickSound
    btnSettings.onclick = () => this._showSettings()

    buttons.appendChild(btnStart)
    buttons.appendChild(btnLoad)
    buttons.appendChild(btnSettings)
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
    buttons.className = 'menu-buttons'

    const btnBack = document.createElement('button')
    btnBack.className = 'menu-btn secondary'
    btnBack.textContent = t('back')
    btnBack.onmousedown = playClickSound
    btnBack.onclick = () => this._showMain()

    buttons.appendChild(btnBack)
    panel.appendChild(form)
    panel.appendChild(buttons)
    this.el.appendChild(panel)
  }

  destroy() {
    this.el.remove()
  }
}
