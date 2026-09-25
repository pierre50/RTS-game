import { playerRelation } from '../lib/combat/playerRelation'
import { getBaseTerritory } from '../lib/territory/baseTerritory'
import { factionIdForCivilization } from '../lib/campaign/playerRoster'
import { t } from '../lib/lang'
import { openBaseReport } from './minimap/MinimapResourcePanel'
import type { MenuHost } from './MenuHost'
import type { Modal } from '../lib/ui/Modal'
import type { FactionRelationState } from '../types/save'

const RELATIONS: Record<FactionRelationState, [string, string]> = {
  allied: ['♥', 'worldMapRelationAllied'],
  friendly: ['◈', 'worldMapRelationFriendly'],
  neutral: ['◇', 'worldMapRelationNeutral'],
  wary: ['!', 'worldMapRelationWary'],
  hostile: ['⚔', 'worldMapRelationHostile'],
}

export class TerritoryIndicator {
  private element = document.createElement('button')
  private report?: Modal
  private own = false
  private nextUpdate = 0

  constructor(private menu: MenuHost) {
    this.element.type = 'button'
    this.element.className = 'territory-indicator ui-btn'
    this.element.hidden = true
    this.element.addEventListener('pointerdown', event => event.stopPropagation())
    this.element.addEventListener('pointerup', event => event.stopPropagation())
    this.element.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      if (!this.own || (this.report && !this.report._closed)) return
      this.menu.closeInventory?.()
      this.report = openBaseReport(this.menu)
    })
    menu.gameHud.appendChild(this.element)
  }

  update(): void {
    if (performance.now() < this.nextUpdate) return
    this.nextUpdate = performance.now() + 250
    const { player, players, controls } = this.menu.context
    const hero = controls.heroUnit
    const territory = hero && !hero.isDead && !hero.isDestroyed ? getBaseTerritory(hero, players ?? [player]) : null
    this.element.hidden = !territory
    if (!territory) {
      this.own = false
      return
    }
    const owner = territory.owner
    this.own = owner === player || owner.label === player.label
    const factions = this.menu.context.getCampaignFactions?.()
    const faction = factions?.[owner.factionId ?? factionIdForCivilization(owner.civ ?? '')]
    const relation = playerRelation(this.menu.context, owner)
    const [icon, key] = RELATIONS[relation]
    const name = owner.civ ? t(owner.civ) : (faction?.name ?? owner.name ?? owner.label ?? '')
    const label = `${name} · ${this.own ? '⊕' : icon}`
    if (this.element.textContent !== label) this.element.textContent = label
    this.element.title = this.own ? t('baseReport') : t(key)
    this.element.setAttribute('aria-label', `${name} · ${this.element.title}`)
    this.element.setAttribute('aria-disabled', String(!this.own))
    this.element.classList.toggle('is-foreign', !this.own)
  }

  destroy(): void {
    this.report?.close()
    this.element.remove()
  }
}
