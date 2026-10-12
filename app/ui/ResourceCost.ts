import { RESOURCE_ICON_IDS } from '../constants'
import { getIconPath } from '../lib/graphics/assets'
import { t } from '../lib/lang'
import type { ResourceAmount } from '../types/common'
import { getResourceDisplayName } from './utils/resourceDisplayName'

export type ResourceCost = {
  cost: ResourceAmount
  heading?: string
  showResourceNames?: boolean
} & (
  | { mode: 'craft'; available: ResourceAmount }
  | { mode: 'progress'; progress: ResourceAmount }
  | { mode: 'delivery' | 'remaining' | 'reward' }
)

/** Shared resource presentation; callers retain ownership of affordability and delivery rules. */
export function createResourceCost(options: ResourceCost): HTMLElement {
  const root = document.createElement('span')
  root.className = 'resource-cost'
  const heading = document.createElement('span')
  heading.className = 'resource-cost-heading'
  heading.textContent =
    options.heading ??
    t(
      options.mode === 'remaining'
        ? 'resourceCostRemaining'
        : options.mode === 'reward'
          ? 'questResourceRewards'
          : options.mode === 'progress'
            ? 'questObjectives'
            : 'resourceCostRequired'
    )
  const list = document.createElement('span')
  list.className = 'resource-cost-list'
  for (const [key, value] of Object.entries(options.cost)) {
    const needed = Math.max(0, Math.floor(value ?? 0))
    if (needed <= 0) continue
    const resource = key as keyof ResourceAmount
    const available = options.mode === 'craft' ? Math.max(0, Math.floor(options.available[resource] ?? 0)) : null
    const progress =
      options.mode === 'progress' ? Math.min(needed, Math.max(0, Math.floor(options.progress[resource] ?? 0))) : null
    const completed = progress !== null && progress >= needed
    const amount =
      progress !== null
        ? `${progress}/${needed}${completed ? ' ✓' : ''}`
        : available === null
          ? String(needed)
          : `${available}/${needed}`
    const label = getResourceDisplayName(resource)
    const item = document.createElement('span')
    item.className = 'resource-cost-item'
    if (available !== null) {
      item.classList.add(available >= needed ? 'inventory-cost-is-available' : 'inventory-cost-is-missing')
    }
    item.title =
      available === null ? `${label}: ${needed}` : t('resourceCostAvailable', { resource: label, available, needed })
    if (progress !== null) {
      item.title = t('questResourceProgress', { resource: label, count: progress, needed })
      if (completed) item.classList.add('resource-cost-is-complete')
    }
    item.setAttribute('aria-label', item.title)
    const icon = createResourceIcon(resource)
    const quantity = document.createElement('span')
    quantity.textContent = options.showResourceNames ? `${amount} ${label}` : amount
    item.append(icon, quantity)
    list.appendChild(item)
  }
  if (!list.childElementCount) {
    if (options.mode === 'remaining') root.textContent = t('constructionMaterialsDelivered')
    return root
  }
  root.append(heading, list)
  if (options.mode === 'delivery') {
    const hint = document.createElement('span')
    hint.className = 'resource-cost-hint'
    hint.textContent = t('resourceCostGradualDelivery')
    root.appendChild(hint)
  }
  return root
}

/** Resource sprites shared by cost badges and inline dialogue. */
export function createResourceIcon(resource: keyof ResourceAmount): HTMLImageElement {
  const icon = document.createElement('img')
  icon.src = getIconPath(RESOURCE_ICON_IDS[resource].commodity)
  icon.alt = ''
  return icon
}
