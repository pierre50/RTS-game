import { canManageConstructionPause, setConstructionPaused } from '../../lib/buildings/constructionPause'
import { createConstructionSite, constructionSiteOptions } from '../ConstructionSite'
import { formatHitPointsText } from '../../lib/entities/hitPointsText'
import { t } from '../../lib/lang'
import type { BuildingEntity } from '../../types/entities'

/** Shared by inspection and interaction panels for every unfinished structure. */
export function appendConstructionInfo(element: HTMLElement, building: BuildingEntity): void {
  element.appendChild(createConstructionSite(constructionSiteOptions(building)))
  if ((building.hitPoints ?? 0) < (building.totalHitPoints ?? 0)) {
    const damage = document.createElement('div')
    damage.className = 'construction-damage-status'
    damage.textContent = t('constructionSiteDamaged', {
      health: formatHitPointsText(building.hitPoints ?? 0, building.totalHitPoints ?? 0),
    })
    element.appendChild(damage)
  }
}

export function createConstructionPauseButton(building: BuildingEntity): HTMLButtonElement | null {
  if (!canManageConstructionPause(building)) return null
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'entity-construction-pause-button ui-btn'
  const render = () => {
    button.textContent = t(building.constructionPaused ? 'constructionResume' : 'constructionPause')
    button.setAttribute('aria-pressed', String(Boolean(building.constructionPaused)))
  }
  render()
  button.addEventListener('click', () => {
    if (setConstructionPaused(building, !building.constructionPaused)) render()
  })
  return button
}
