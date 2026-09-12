import type { Application } from 'pixi.js'
import type { UnitEntity } from '../types/entities'
import { t } from '../lib/lang'
import { createEntityAvatar } from './EntityInfoContent'
import { getEntityDisplayName } from './utils/entityDisplayName'

export function createNpcGroupSummary(app: Application, npcs: readonly UnitEntity[]): HTMLElement {
  const summary = document.createElement('div')
  summary.className = 'npc-group-summary'
  const groups = new Map<string, { representative: UnitEntity; count: number }>()
  let wounded = 0
  for (const npc of npcs) {
    const group = groups.get(npc.type)
    if (group) group.count++
    else groups.set(npc.type, { representative: npc, count: 1 })
    if (!npc.isDead && (npc.hitPoints ?? 0) > 0 && (npc.hitPoints ?? 0) < (npc.totalHitPoints ?? 0)) wounded++
  }

  const list = document.createElement('div')
  list.className = 'npc-group-types'
  list.setAttribute('role', 'list')
  for (const { representative, count } of groups.values()) {
    const card = document.createElement('div')
    card.className = 'npc-group-type'
    card.setAttribute('role', 'listitem')
    const typeName = getEntityDisplayName({ ...representative, name: undefined, assetType: undefined })
    card.setAttribute('aria-label', `${typeName} ×${count}`)
    const portrait = createEntityAvatar(app, representative)
    if (portrait) {
      portrait.setAttribute('aria-hidden', 'true')
      card.appendChild(portrait)
    }
    const amount = document.createElement('span')
    amount.className = 'npc-group-count'
    amount.textContent = `×${count}`
    const label = document.createElement('span')
    label.className = 'npc-group-type-name'
    label.textContent = typeName
    card.append(amount, label)
    list.appendChild(card)
  }
  summary.appendChild(list)
  if (wounded) {
    const status = document.createElement('div')
    status.className = 'npc-group-wounded'
    status.textContent = t(wounded === 1 ? 'npcGroupWoundedOne' : 'npcGroupWounded', { count: wounded })
    summary.appendChild(status)
  }
  return summary
}
