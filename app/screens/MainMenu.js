export default class MainMenu {
  constructor(onStart, onLoad) {
    this.el = document.createElement('div')
    this.el.id = 'main-menu'

    const panel = document.createElement('div')
    panel.className = 'menu-panel'

    const title = document.createElement('div')
    title.className = 'menu-title'
    title.textContent = 'RTS'

    const subtitle = document.createElement('div')
    subtitle.className = 'menu-subtitle'
    subtitle.textContent = 'Age of Empires'

    const divider = document.createElement('div')
    divider.className = 'menu-divider'

    const buttons = document.createElement('div')
    buttons.className = 'menu-buttons'

    const btnStart = document.createElement('button')
    btnStart.className = 'menu-btn'
    btnStart.textContent = 'Nouvelle Partie'
    btnStart.onclick = onStart

    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.json'
    fileInput.style.display = 'none'
    fileInput.onchange = evt => {
      const file = evt.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = e => onLoad(JSON.parse(e.target.result))
      reader.readAsText(file)
    }

    const btnLoad = document.createElement('button')
    btnLoad.className = 'menu-btn secondary'
    btnLoad.textContent = 'Charger une Partie'
    btnLoad.onclick = () => fileInput.click()

    buttons.appendChild(btnStart)
    buttons.appendChild(btnLoad)
    buttons.appendChild(fileInput)

    panel.appendChild(title)
    panel.appendChild(subtitle)
    panel.appendChild(divider)
    panel.appendChild(buttons)

    this.el.appendChild(panel)
    document.body.appendChild(this.el)
  }

  destroy() {
    this.el.remove()
  }
}
