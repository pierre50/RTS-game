import { RESOURCE_NAMES } from '../constants'
import { t } from '../lib/lang'
import { getPlayerChestResourceTotals } from '../lib/resources/playerResourceTotals'
import { summarizeVillagerAssignments } from '../lib/units/villagerAssignments'
import { createResourceIconMaps } from './utils/resourceIcons'
import type { UnitEntity } from '../types/entities'
import type { MenuHost } from './MenuHost'

const AGE_LABEL_KEYS = ['stoneAge', 'toolAge', 'bronzeAge', 'ironAge'] as const
type ResourceName = (typeof RESOURCE_NAMES)[number]
type ResourcePlayer = { age?: number; units?: UnitEntity[] }

export class TopbarView {
  menu: MenuHost
  resourceEls: Record<string, HTMLDivElement>
  resourceWorkerEls: Record<string, HTMLSpanElement>
  villagerTotalEl: HTMLDivElement | null

  constructor(menu: MenuHost) {
    this.menu = menu
    this.resourceEls = {}
    this.resourceWorkerEls = {}
    this.villagerTotalEl = null
  }

  build(): void {
    const { menu } = this
    menu.topbar = document.createElement('div')
    menu.topbar.id = 'topbar'
    menu.topbar.className = 'topbar bar'
    const resourceIcons = createResourceIconMaps()
    menu.icons = resourceIcons.icons
    menu.infoIcons = resourceIcons.infoIcons

    menu.topbarStatusStack = document.createElement('div')
    menu.topbarStatusStack.className = 'topbar-status-stack'

    menu.age = document.createElement('div')
    menu.age.className = 'topbar-age'

    menu.dayTime = document.createElement('div')
    menu.dayTime.className = 'topbar-daytime'

    const status = document.createElement('div')
    status.className = 'topbar-status hud-info-panel'

    menu.resources = document.createElement('div')
    menu.resources.className = 'topbar-resources'
    RESOURCE_NAMES.forEach(res => this.setResourceBox(res))

    this.villagerTotalEl = document.createElement('div')
    this.villagerTotalEl.className = 'topbar-villagers'
    this.villagerTotalEl.title = 'Villageois'

    const options = document.createElement('div')
    options.className = 'topbar-options'
    options.appendChild(menu.pauseMenu.createOpenButton())

    status.appendChild(menu.resources)
    status.appendChild(this.villagerTotalEl)
    status.appendChild(menu.age)
    status.appendChild(menu.dayTime)
    menu.topbarStatusStack.appendChild(status)
    menu.topbar.appendChild(menu.topbarStatusStack)
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
    valueEl.className = 'resource-value'
    this.resourceEls[name] = valueEl

    const workerEl = document.createElement('span')
    workerEl.className = 'resource-workers'
    workerEl.title = 'Villageois affectes'
    this.resourceWorkerEls[name] = workerEl
    valueEl.appendChild(workerEl)
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
    const assignments = summarizeVillagerAssignments(player?.units ?? [])
    const storedResources = getPlayerChestResourceTotals(player)
    RESOURCE_NAMES.forEach(prop => {
      const val = Math.min(storedResources[prop] || 0, 99999)
      const valueEl = this.resourceEls[prop]
      valueEl.textContent = String(val)
      const workerEl = this.resourceWorkerEls[prop]
      if (workerEl) {
        workerEl.textContent = ` (${assignments.assigned[prop] ?? 0})`
        valueEl.appendChild(workerEl)
      }
    })
    if (this.villagerTotalEl) this.villagerTotalEl.textContent = `V: ${assignments.total}`
    const age = this.getClampedAge()
    this.menu.age.textContent = t(AGE_LABEL_KEYS[age])
    this.updateDayTime()
    this.updateAgeTheme()
  }

  updateDayTime(): void {
    const dayNight = this.menu.context.dayNight
    this.menu.dayTime.textContent = dayNight ? `${dayNight.getDayLabel()} - ${dayNight.getTimeLabel()}` : ''
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
