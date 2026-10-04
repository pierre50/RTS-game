import { remainingConstructionMaterials } from '../../lib/economy/constructionMaterials'
import { formatHitPointsText } from '../../lib/entities/hitPointsText'
import { t } from '../../lib/lang'
import type { BuildingEntity } from '../../types/entities'

/** Shared by inspection and interaction panels for every unfinished structure. */
export function appendConstructionInfo(element: HTMLElement, building: BuildingEntity): void {
  const missing = remainingConstructionMaterials(building)
  const status = document.createElement('div')
  status.className = 'construction-work-status'
  status.textContent = Object.keys(missing).length
    ? t('constructionSiteMissing', {
        materials: Object.entries(missing)
          .map(([key, amount]) => `${amount} ${t(key)}`)
          .join(', '),
      })
    : t('constructionSiteReady')
  element.appendChild(status)
  if ((building.hitPoints ?? 0) < (building.totalHitPoints ?? 0)) {
    const damage = document.createElement('div')
    damage.className = 'construction-damage-status'
    damage.textContent = t('constructionSiteDamaged', {
      health: formatHitPointsText(building.hitPoints ?? 0, building.totalHitPoints ?? 0),
    })
    element.appendChild(damage)
  }
}
