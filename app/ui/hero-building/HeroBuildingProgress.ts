import {
  formatTrainingEntryTimeRemaining,
  formatTrainingTimeRemaining,
} from '../../lib/buildings/trainingTimeRemaining'
import type { BuildingEntity } from '../../types/entities'

function trainingStatus(
  building: BuildingEntity,
  id: string,
  index: number | null
): { visible: boolean; text: string } {
  const entry = index != null && Number.isFinite(index) ? building.trainingQueue?.[index] : null
  if (entry) {
    const progress = Math.max(0, Math.min(100, Math.floor(entry.loading ?? 0)))
    return { visible: true, text: formatTrainingEntryTimeRemaining(building, entry) ?? `${progress}%` }
  }
  const queued = building.queue?.filter(type => type === id).length ?? 0
  if (building.queue?.[0] === id) {
    const progress = Math.max(0, Math.min(100, Math.floor(building.loading ?? 0)))
    return { visible: true, text: formatTrainingTimeRemaining(building) ?? `${progress}%` }
  }
  return { visible: queued > 0, text: queued > 0 ? '...' : '' }
}

export function updateHeroBuildingProgress(body: HTMLElement, building: BuildingEntity): void {
  body.querySelectorAll<HTMLElement>('button.ui-btn').forEach(button => {
    const id = button.dataset.actionId || button.id.replace(/^hero-/, '')
    const status = button.querySelector<HTMLElement>('.hero-building-menu-status')
    const text = button.querySelector<HTMLElement>('.hero-building-menu-status-text')
    if (!status || !text) return
    const index = button.dataset.trainingIndex == null ? null : Number(button.dataset.trainingIndex)
    const result = trainingStatus(building, id, index)
    status.classList.toggle('is-visible', result.visible)
    text.textContent = result.text
  })
}
