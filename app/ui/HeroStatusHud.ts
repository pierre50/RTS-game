import { renderUnitHeadAvatar } from '../lib/avatar'
import { t } from '../lib/lang'
import { getUnitOverallLevel } from '../lib/units/unitExperience'
import type { UnitEntity } from '../types/entities'
import type { MenuHost } from './MenuHost'

const HEALTH_RECOVERY_FILL_MS = 180

export class HeroStatusHud {
  menu: MenuHost
  element: HTMLDivElement
  avatarCanvas: HTMLCanvasElement
  title: HTMLDivElement
  level: HTMLDivElement
  value: HTMLDivElement
  healthBar: HTMLDivElement
  energyBar: HTMLDivElement
  energyValue: HTMLDivElement
  hero: UnitEntity | null
  displayedHitPoints: number | null
  lastHealthDisplayUpdateAt: number | null
  private lastTitleText: string | null
  private lastLevelText: string | null
  private lastHealthText: string | null
  private lastHealthPercent: string | null
  private lastEnergyText: string | null
  private lastEnergyPercent: string | null

  constructor(menu: MenuHost) {
    this.menu = menu
    this.hero = null
    this.displayedHitPoints = null
    this.lastHealthDisplayUpdateAt = null
    this.lastTitleText = null
    this.lastLevelText = null
    this.lastHealthText = null
    this.lastHealthPercent = null
    this.lastEnergyText = null
    this.lastEnergyPercent = null

    this.element = document.createElement('div')
    this.element.className = 'hero-status-hud hidden'

    const frame = document.createElement('div')
    frame.className = 'hero-status-frame hud-info-panel'

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

    header.appendChild(this.title)
    header.appendChild(this.level)
    this.healthBar.appendChild(this.value)
    this.energyBar.appendChild(this.energyValue)
    content.appendChild(header)
    content.appendChild(this.healthBar)
    content.appendChild(this.energyBar)
    frame.appendChild(avatarWrap)
    frame.appendChild(content)
    this.element.appendChild(frame)
    menu.gameHud.appendChild(this.element)
  }

  private resetRenderCache(): void {
    this.lastTitleText = null
    this.lastLevelText = null
    this.lastHealthText = null
    this.lastHealthPercent = null
    this.lastEnergyText = null
    this.lastEnergyPercent = null
  }

  setHero(hero: UnitEntity | null): void {
    this.hero = hero
    this.displayedHitPoints = null
    this.lastHealthDisplayUpdateAt = null
    this.resetRenderCache()
    if (hero) {
      renderUnitHeadAvatar(this.menu.context.app, hero, this.avatarCanvas)
    }
    this.update(hero)
  }

  private setText(
    element: HTMLElement,
    cacheKey: 'lastTitleText' | 'lastLevelText' | 'lastHealthText' | 'lastEnergyText',
    text: string
  ): void {
    if (this[cacheKey] === text) return
    element.textContent = text
    this[cacheKey] = text
  }

  private setBarPercent(
    element: HTMLElement,
    property: string,
    cacheKey: 'lastHealthPercent' | 'lastEnergyPercent',
    percent: string
  ): void {
    if (this[cacheKey] === percent) return
    element.style.setProperty(property, percent)
    this[cacheKey] = percent
  }

  private updateIdentity(hero: UnitEntity): void {
    this.setText(this.title, 'lastTitleText', hero.name || t(hero.type || 'heroStatusTitle'))
    this.setText(this.level, 'lastLevelText', `${t('levelShort')} ${getUnitOverallLevel(hero)}`)
  }

  private updateHealth(hero: UnitEntity, elapsedMs: number): void {
    const rawHitPoints = Math.max(0, hero.hitPoints ?? 0)
    const rawTotalHitPoints = Math.max(0, hero.totalHitPoints ?? 0)
    const max = Math.ceil(rawTotalHitPoints)
    const current = Math.min(max, Math.floor(rawHitPoints))
    const targetHitPoints = Math.min(rawTotalHitPoints, rawHitPoints)
    if (this.displayedHitPoints == null || targetHitPoints < this.displayedHitPoints) {
      this.displayedHitPoints = targetHitPoints
    } else if (targetHitPoints > this.displayedHitPoints) {
      const fillPerMs = rawTotalHitPoints / HEALTH_RECOVERY_FILL_MS
      this.displayedHitPoints = Math.min(targetHitPoints, this.displayedHitPoints + fillPerMs * elapsedMs)
    }
    const ratio =
      rawTotalHitPoints > 0
        ? Math.max(0, Math.min(1, (this.displayedHitPoints ?? targetHitPoints) / rawTotalHitPoints))
        : 0

    this.setText(this.value, 'lastHealthText', `${current}/${max}`)
    this.setBarPercent(this.healthBar, '--hero-health-percent', 'lastHealthPercent', `${(ratio * 100).toFixed(2)}%`)
  }

  private updateEnergy(hero: UnitEntity): void {
    const rawEnergy = Math.max(0, hero.energy ?? hero.totalEnergy ?? 0)
    const rawTotalEnergy = Math.max(0, hero.totalEnergy ?? 0)
    const totalEnergy = Math.ceil(rawTotalEnergy)
    const energy = Math.min(totalEnergy, Math.floor(rawEnergy))
    const energyRatio = rawTotalEnergy > 0 ? Math.max(0, Math.min(1, rawEnergy / rawTotalEnergy)) : 0
    const energyPercent = `${(energyRatio * 100).toFixed(2)}%`

    this.setText(this.energyValue, 'lastEnergyText', `${energy}/${totalEnergy}`)
    this.setBarPercent(this.energyBar, '--hero-energy-percent', 'lastEnergyPercent', energyPercent)
  }

  update(hero: UnitEntity | null = this.hero): void {
    const now = performance.now()
    const elapsedMs = this.lastHealthDisplayUpdateAt == null ? 0 : Math.max(0, now - this.lastHealthDisplayUpdateAt)
    this.lastHealthDisplayUpdateAt = now
    this.hero = hero
    if (!hero || hero.isDead || hero.isDestroyed) {
      this.element.classList.add('hidden')
      this.displayedHitPoints = null
      this.resetRenderCache()
      return
    }

    this.updateIdentity(hero)
    this.updateHealth(hero, elapsedMs)
    this.updateEnergy(hero)
    this.element.classList.remove('hidden')
  }

  destroy(): void {
    this.element.remove()
  }
}
