import { LOADING_FOOD_TYPES } from '../constants'
import { renderUnitHeadAvatar } from '../lib/avatar'
import { t } from '../lib/lang'
import { HERO_ENERGY_COLOR } from '../lib/unitEnergy'
import { getUnitOverallLevel } from '../lib/unitExperience'
import type Menu from '../classes/Menu'
import type { UnitEntity } from '../types/entities'

export class HeroStatusHud {
  menu: Menu
  element: HTMLDivElement
  avatarCanvas: HTMLCanvasElement
  title: HTMLDivElement
  level: HTMLDivElement
  value: HTMLDivElement
  healthBar: HTMLDivElement
  energyBar: HTMLDivElement
  energyValue: HTMLDivElement
  energyFill: HTMLDivElement
  carry: HTMLDivElement
  carryIcon: HTMLImageElement
  carryValue: HTMLDivElement
  hero: UnitEntity | null
  displayedHitPoints: number | null
  lastHealthDisplayUpdateAt: number | null

  constructor(menu: Menu) {
    this.menu = menu
    this.hero = null
    this.displayedHitPoints = null
    this.lastHealthDisplayUpdateAt = null

    this.element = document.createElement('div')
    this.element.className = 'hero-status-hud hidden'

    const frame = document.createElement('div')
    frame.className = 'hero-status-frame'

    const avatarWrap = document.createElement('div')
    avatarWrap.className = 'unit-avatar-frame'
    this.avatarCanvas = document.createElement('canvas')
    this.avatarCanvas.width = 120
    this.avatarCanvas.height = 120
    avatarWrap.appendChild(this.avatarCanvas)

    const content = document.createElement('div')
    content.className = 'hero-status-content'

    const header = document.createElement('div')
    header.className = 'hero-status-header'

    this.title = document.createElement('div')
    this.title.className = 'hero-status-title'

    this.level = document.createElement('div')
    this.level.className = 'hero-status-level'

    this.value = document.createElement('div')
    this.value.className = 'hero-status-value'

    this.healthBar = document.createElement('div')
    this.healthBar.className = 'hero-status-bar'

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
    header.appendChild(this.level)
    this.healthBar.appendChild(this.value)
    this.energyBar.appendChild(this.energyFill)
    this.energyBar.appendChild(this.energyValue)
    this.carry.appendChild(this.carryIcon)
    this.carry.appendChild(this.carryValue)
    content.appendChild(header)
    content.appendChild(this.healthBar)
    content.appendChild(this.energyBar)
    content.appendChild(this.carry)
    frame.appendChild(avatarWrap)
    frame.appendChild(content)
    this.element.appendChild(frame)
    menu.gameHud.appendChild(this.element)
  }

  setHero(hero: UnitEntity | null): void {
    this.hero = hero
    this.displayedHitPoints = null
    this.lastHealthDisplayUpdateAt = null
    if (hero) {
      renderUnitHeadAvatar(this.menu.context.app, hero, this.avatarCanvas)
    }
    this.update(hero)
  }

  update(hero: UnitEntity | null = this.hero): void {
    const now = performance.now()
    const elapsedMs = this.lastHealthDisplayUpdateAt == null ? 0 : Math.max(0, now - this.lastHealthDisplayUpdateAt)
    this.lastHealthDisplayUpdateAt = now
    this.hero = hero
    if (!hero || hero.isDead || hero.isDestroyed) {
      this.element.classList.add('hidden')
      this.displayedHitPoints = null
      return
    }

    const rawHitPoints = Math.max(0, hero.hitPoints ?? 0)
    const rawTotalHitPoints = Math.max(0, hero.totalHitPoints ?? 0)
    const max = Math.ceil(rawTotalHitPoints)
    const current = Math.min(max, Math.floor(rawHitPoints))
    const targetHitPoints = Math.min(rawTotalHitPoints, rawHitPoints)
    if (this.displayedHitPoints == null || targetHitPoints < this.displayedHitPoints) {
      this.displayedHitPoints = targetHitPoints
    } else if (targetHitPoints > this.displayedHitPoints) {
      const fillPerMs = rawTotalHitPoints / 180
      this.displayedHitPoints = Math.min(targetHitPoints, this.displayedHitPoints + fillPerMs * elapsedMs)
    }
    const ratio =
      rawTotalHitPoints > 0 ? Math.max(0, Math.min(1, (this.displayedHitPoints ?? targetHitPoints) / rawTotalHitPoints)) : 0

    this.title.textContent = hero.name || t(hero.type || 'heroStatusTitle')
    this.level.textContent = `${t('levelShort')} ${getUnitOverallLevel(hero)}`
    this.value.textContent = `${current}/${max}`
    const healthPercent = `${(ratio * 100).toFixed(2)}%`
    this.healthBar.style.setProperty('--hero-health-percent', healthPercent)

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
