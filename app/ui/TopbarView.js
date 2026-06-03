import { getIconPath } from '../lib'
import { t } from '../lib/lang'

export class TopbarView {
  constructor(menu) {
    this.menu = menu
  }

  build() {
    const { menu } = this
    menu.topbar = document.createElement('div')
    menu.topbar.id = 'topbar'
    menu.topbar.className = 'topbar bar'
    menu.icons = {
      wood: getIconPath('000_50732'),
      food: getIconPath('002_50732'),
      stone: getIconPath('001_50732'),
      gold: getIconPath('003_50732'),
    }
    menu.infoIcons = {
      wood: getIconPath('000_50731'),
      stone: getIconPath('001_50731'),
      food: getIconPath('002_50731'),
      gold: getIconPath('003_50731'),
    }

    menu.resources = document.createElement('div')
    menu.resources.className = 'topbar-resources'
    ;['wood', 'food', 'stone', 'gold'].forEach(res => this.setResourceBox(res))

    menu.age = document.createElement('div')
    menu.age.className = 'topbar-age'

    const options = document.createElement('div')
    options.className = 'topbar-options'
    options.appendChild(menu.pauseMenu.createOpenButton())

    menu.topbar.appendChild(menu.resources)
    menu.topbar.appendChild(menu.age)
    menu.topbar.appendChild(options)
    document.body.prepend(menu.topbar)
  }

  setResourceBox(name) {
    const { menu } = this
    const box = document.createElement('div')
    box.className = 'resource'

    const img = document.createElement('img')
    img.className = 'resource-content'
    img.src = menu.icons[name]

    menu[name] = document.createElement('div')
    box.appendChild(img)
    box.appendChild(menu[name])
    menu.resources.appendChild(box)
  }

  update() {
    const {
      menu,
      menu: {
        context: { player },
      },
    } = this
    const ageLabels = {
      0: t('stoneAge'),
      1: t('toolAge'),
      2: t('bronzeAge'),
      3: t('ironAge'),
    }
    ;['wood', 'food', 'stone', 'gold', 'age'].forEach(prop => {
      const val = Math.min((player && player[prop]) || 0, 99999)
      menu[prop].textContent = prop === 'age' ? ageLabels[val] : val
    })
    this.updateAgeTheme(player?.age || 0)
  }

  updateAgeTheme(age = 0) {
    document.body.classList.remove('ui-age-0', 'ui-age-1', 'ui-age-2', 'ui-age-3')
    document.body.classList.add(`ui-age-${Math.max(0, Math.min(age, 3))}`)
  }

  destroy() {
    this.menu.topbar?.remove()
    document.body.classList.remove('ui-age-0', 'ui-age-1', 'ui-age-2', 'ui-age-3')
  }
}
