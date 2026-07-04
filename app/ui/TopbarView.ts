import { getIconPath } from '../lib'
import { t } from '../lib/lang'
import type Menu from '../classes/menu'

const AGE_LABEL_KEYS = ['stoneAge', 'toolAge', 'bronzeAge', 'ironAge'] as const
const RESOURCE_NAMES = ['wood', 'food', 'stone', 'gold'] as const
type ResourceName = (typeof RESOURCE_NAMES)[number]
type ResourcePlayer = Partial<Record<ResourceName, number>> & { age?: number }

export class TopbarView {
  menu: Menu
  resourceEls: Record<string, HTMLDivElement>

  constructor(menu: Menu) {
    this.menu = menu
    this.resourceEls = {}
  }

  build(): void {
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
    RESOURCE_NAMES.forEach(res => this.setResourceBox(res))

    menu.age = document.createElement('div')
    menu.age.className = 'topbar-age'

    const options = document.createElement('div')
    options.className = 'topbar-options'
    options.appendChild(menu.pauseMenu.createOpenButton())

    menu.topbar.appendChild(menu.resources)
    menu.topbar.appendChild(menu.age)
    menu.topbar.appendChild(options)
    menu.gameHud.prepend(menu.topbar)
  }

  setResourceBox(name: ResourceName): void {
    const { menu } = this
    const icons = menu.icons as Record<ResourceName, string>
    const box = document.createElement('div')
    box.className = 'resource'

    const img = document.createElement('img')
    img.className = 'resource-content'
    img.src = icons[name]

    const valueEl = document.createElement('div')
    this.resourceEls[name] = valueEl
    box.appendChild(img)
    box.appendChild(valueEl)
    menu.resources.appendChild(box)
  }

  update(): void {
    const {
      menu: {
        context: { player },
      },
    } = this
    RESOURCE_NAMES.forEach(prop => {
      const resourcePlayer = player as ResourcePlayer | null
      const val = Math.min(resourcePlayer?.[prop] || 0, 99999)
      this.resourceEls[prop].textContent = String(val)
    })
    const age = (player as ResourcePlayer | null)?.age || 0
    this.menu.age.textContent = t(AGE_LABEL_KEYS[Math.max(0, Math.min(age, 3))])
    this.updateAgeTheme(age)
  }

  updateAgeTheme(age = 0): void {
    this.menu.gameHud.classList.remove('ui-age-0', 'ui-age-1', 'ui-age-2', 'ui-age-3')
    this.menu.gameHud.classList.add(`ui-age-${Math.max(0, Math.min(age, 3))}`)
  }

  destroy(): void {
    this.menu.topbar?.remove()
  }
}
