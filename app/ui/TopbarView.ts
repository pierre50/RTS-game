import { RESOURCE_NAMES } from '../constants'
import { t } from '../lib/lang'
import { createResourceIconMaps } from './resourceIcons'
import type Menu from '../classes/Menu'

const AGE_LABEL_KEYS = ['stoneAge', 'toolAge', 'bronzeAge', 'ironAge'] as const
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
    const resourceIcons = createResourceIconMaps()
    menu.icons = resourceIcons.icons
    menu.infoIcons = resourceIcons.infoIcons

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
    const age = this.getClampedAge()
    this.menu.age.textContent = t(AGE_LABEL_KEYS[age])
    this.updateAgeTheme()
  }

  updateAgeTheme(): void {
    this.menu.gameHud.classList.remove('ui-age-0', 'ui-age-1', 'ui-age-2', 'ui-age-3')
    this.menu.gameHud.classList.add(`ui-age-${this.getClampedAge()}`)
  }

  private getClampedAge(): number {
    const {
      menu: {
        context: { player },
      },
    } = this
    const age = Math.floor((player as ResourcePlayer | null)?.age ?? 0)
    return Math.max(0, Math.min(age, AGE_LABEL_KEYS.length - 1))
  }

  destroy(): void {
    this.menu.topbar?.remove()
  }
}
