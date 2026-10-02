import { createResourceIconMaps } from './utils/resourceIcons'
import type { MenuHost } from './MenuHost'

export class TopbarView {
  menu: MenuHost
  optionsEl: HTMLDivElement | null

  constructor(menu: MenuHost) {
    this.menu = menu
    this.optionsEl = null
  }

  build(): void {
    const { menu } = this
    const resourceIcons = createResourceIconMaps()
    menu.icons = resourceIcons.icons
    menu.infoIcons = resourceIcons.infoIcons

    menu.topbarStatusStack = document.createElement('div')
    menu.dayTime = document.createElement('div')
    menu.resources = document.createElement('div')

    const options = document.createElement('div')
    options.className = 'topbar-options'
    menu.dayTime.className = 'topbar-daytime hud-info-panel'
    options.appendChild(menu.questJournal.createOpenButton())
    options.appendChild(menu.pauseMenu.createOpenButton())
    this.optionsEl = options
    menu.gameHud.appendChild(menu.dayTime)
    menu.gameHud.appendChild(options)
  }

  update(): void {
    this.updateTheme()
    this.updateDayTime()
  }

  updateDayTime(): void {
    const dayNight = this.menu.context.dayNight
    const dayLabel = dayNight?.getDayLabel?.()
    const timeLabel = dayNight?.getTimeLabel?.()
    this.menu.dayTime.textContent = dayLabel && timeLabel ? `${dayLabel} - ${timeLabel}` : ''
    if (dayLabel && timeLabel) this.menu.dayTime.classList.remove('hidden')
    else this.menu.dayTime.classList.add('hidden')
  }

  updateTheme(): void {
    this.menu.gameHud.classList.add('ui-theme-default')
  }

  destroy(): void {
    this.menu.dayTime?.remove()
    this.optionsEl?.remove()
    this.optionsEl = null
  }
}
