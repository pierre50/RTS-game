import { t } from '../lib/lang'
import type Menu from '../classes/Menu'
import type { UnitEntity } from '../types/entities'

export class HeroStatusHud {
  menu: Menu
  element: HTMLDivElement
  title: HTMLDivElement
  value: HTMLDivElement
  fill: HTMLDivElement
  hero: UnitEntity | null

  constructor(menu: Menu) {
    this.menu = menu
    this.hero = null

    this.element = document.createElement('div')
    this.element.className = 'hero-status-hud hidden'

    const frame = document.createElement('div')
    frame.className = 'hero-status-frame'

    const header = document.createElement('div')
    header.className = 'hero-status-header'

    this.title = document.createElement('div')
    this.title.className = 'hero-status-title'

    this.value = document.createElement('div')
    this.value.className = 'hero-status-value'

    const bar = document.createElement('div')
    bar.className = 'hero-status-bar'

    this.fill = document.createElement('div')
    this.fill.className = 'hero-status-fill'

    header.appendChild(this.title)
    header.appendChild(this.value)
    bar.appendChild(this.fill)
    frame.appendChild(header)
    frame.appendChild(bar)
    this.element.appendChild(frame)
    menu.gameHud.appendChild(this.element)
  }

  setHero(hero: UnitEntity | null): void {
    this.hero = hero
    this.update(hero)
  }

  update(hero: UnitEntity | null = this.hero): void {
    this.hero = hero
    if (!hero || hero.isDead || hero.isDestroyed) {
      this.element.classList.add('hidden')
      return
    }

    const current = Math.max(0, Math.ceil(hero.hitPoints ?? 0))
    const max = Math.max(0, Math.ceil(hero.totalHitPoints ?? 0))
    const ratio = max > 0 ? Math.max(0, Math.min(1, current / max)) : 0

    this.title.textContent = t(hero.type || 'heroStatusTitle')
    this.value.textContent = `${current}/${max}`
    this.fill.style.width = `${Math.round(ratio * 100)}%`
    this.element.classList.remove('hidden')
  }

  destroy(): void {
    this.element.remove()
  }
}
