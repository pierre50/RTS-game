import { LOADING_FOOD_TYPES } from '../constants'
import { t } from '../lib/lang'
import { HERO_ENERGY_COLOR } from '../lib/unitEnergy'
import type Menu from '../classes/Menu'
import type { UnitEntity } from '../types/entities'

export class HeroStatusHud {
  menu: Menu
  element: HTMLDivElement
  title: HTMLDivElement
  value: HTMLDivElement
  fill: HTMLDivElement
  energyBar: HTMLDivElement
  energyValue: HTMLDivElement
  energyFill: HTMLDivElement
  carry: HTMLDivElement
  carryIcon: HTMLImageElement
  carryValue: HTMLDivElement
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

    const energyHeader = document.createElement('div')
    energyHeader.className = 'hero-status-header hero-status-energy-header'

    const energyTitle = document.createElement('div')
    energyTitle.className = 'hero-status-title'
    energyTitle.textContent = t('heroEnergyTitle')

    this.energyValue = document.createElement('div')
    this.energyValue.className = 'hero-status-value'

    this.energyBar = document.createElement('div')
    this.energyBar.className = 'hero-status-bar hero-status-energy-bar'

    this.energyFill = document.createElement('div')
    this.energyFill.className = 'hero-status-fill hero-status-energy-fill'
    this.energyFill.style.background = HERO_ENERGY_COLOR

    this.carry = document.createElement('div')
    this.carry.className = 'hero-status-carry hidden'

    this.carryIcon = document.createElement('img')
    this.carryIcon.className = 'hero-status-carry-icon'

    this.carryValue = document.createElement('div')
    this.carryValue.className = 'hero-status-carry-value'

    header.appendChild(this.title)
    header.appendChild(this.value)
    bar.appendChild(this.fill)
    energyHeader.appendChild(energyTitle)
    energyHeader.appendChild(this.energyValue)
    this.energyBar.appendChild(this.energyFill)
    this.carry.appendChild(this.carryIcon)
    this.carry.appendChild(this.carryValue)
    frame.appendChild(header)
    frame.appendChild(bar)
    frame.appendChild(energyHeader)
    frame.appendChild(this.energyBar)
    frame.appendChild(this.carry)
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

    const rawHitPoints = Math.max(0, hero.hitPoints ?? 0)
    const rawTotalHitPoints = Math.max(0, hero.totalHitPoints ?? 0)
    const max = Math.ceil(rawTotalHitPoints)
    const current = Math.min(max, Math.floor(rawHitPoints))
    const ratio = rawTotalHitPoints > 0 ? Math.max(0, Math.min(1, rawHitPoints / rawTotalHitPoints)) : 0

    this.title.textContent = hero.name || t(hero.type || 'heroStatusTitle')
    this.value.textContent = `${current}/${max}`
    this.fill.style.width = `${(ratio * 100).toFixed(2)}%`

    const rawEnergy = Math.max(0, hero.energy ?? hero.totalEnergy ?? 0)
    const rawTotalEnergy = Math.max(0, hero.totalEnergy ?? 0)
    const totalEnergy = Math.ceil(rawTotalEnergy)
    const energy = Math.min(totalEnergy, Math.floor(rawEnergy))
    const energyRatio = rawTotalEnergy > 0 ? Math.max(0, Math.min(1, rawEnergy / rawTotalEnergy)) : 0
    const energyPercent = `${(energyRatio * 100).toFixed(2)}%`
    this.energyValue.textContent = `${energy}/${totalEnergy}`
    this.energyBar.style.setProperty('--hero-energy-percent', energyPercent)
    this.energyFill.style.width = energyPercent
    this.element.classList.remove('hidden')

    const loading = hero.loading ?? 0
    if (loading > 0 && hero.loadingType) {
      const iconKey = LOADING_FOOD_TYPES.includes(hero.loadingType) ? 'food' : hero.loadingType
      this.carryIcon.src = this.menu.infoIcons?.[iconKey] ?? ''
      this.carryValue.textContent = String(loading)
      this.carry.classList.remove('hidden')
    } else {
      this.carry.classList.add('hidden')
    }
  }

  destroy(): void {
    this.element.remove()
  }
}
