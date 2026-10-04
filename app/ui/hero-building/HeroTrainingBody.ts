import { renderUnitTypeAvatar } from '../../lib/avatar'
import { t } from '../../lib/lang'
import { formatTrainingEntryTimeRemaining } from '../../lib/buildings/trainingTimeRemaining'
import { BUILDING_TRAINING_CAPACITY, isTraineeTrainingType } from '../../lib/buildings/buildingTraining'
import { cancelBuildingTrainingRequest, requestBuildingTraining } from '../../lib/training/trainingRequests'
import type { BuildingEntity } from '../../types/entities'
import type { MenuHost } from '../MenuHost'

export function createHeroTrainingBody(
  building: BuildingEntity,
  menu: MenuHost,
  refresh: () => void
): HTMLElement | null {
  const types = (building.units ?? []).filter(type => isTraineeTrainingType(building, type))
  if (!building.isBuilt || !types.length || building.owner?.label !== menu.context.player.label) return null
  const panel = document.createElement('div')
  panel.className = 'hero-training-panel'
  const choices = document.createElement('section')
  choices.className = 'hero-training-choices'
  const queue = document.createElement('section')
  queue.className = 'hero-training-queue'
  for (const [section, key] of [
    [choices, 'windowTrainingChoices'],
    [queue, 'windowTrainingQueue'],
  ] as const) {
    const heading = document.createElement('h3')
    heading.className = 'inventory-section-title'
    heading.textContent = t(key)
    section.appendChild(heading)
    panel.appendChild(section)
  }
  const button = (id: string, label: string, run: () => void) => {
    const element = document.createElement('button')
    element.type = 'button'
    element.id = id
    element.className = 'ui-btn'
    element.disabled = Boolean(building.buildingUpgrade)
    element.textContent = label
    element.addEventListener('click', () => {
      run()
      refresh()
      document.getElementById?.(id)?.focus?.()
    })
    return element
  }
  const summary = document.createElement('p')
  summary.textContent = t('buildingTrainingPlaces', {
    count:
      (building.trainingQueue?.length ?? 0) +
      (building.trainingRequests?.filter(request => request.traineeLabel).length ?? 0),
    max: BUILDING_TRAINING_CAPACITY,
  })
  queue.appendChild(summary)
  for (const type of types) {
    const recruit = button(`training-add-${type}`, t('buildingTrainingRecruit', { type: t(type) }), () => {
      requestBuildingTraining(building, type, 1)
    })
    recruit.classList.add('hero-training-choice')
    const avatar = document.createElement('canvas')
    avatar.width = avatar.height = 64
    if (building.owner && renderUnitTypeAvatar(menu.context.app, type, building.owner, avatar)) recruit.prepend(avatar)
    choices.appendChild(recruit)
    const waiting = building.trainingRequests?.filter(request => request.type === type && !request.traineeLabel) ?? []
    if (waiting.length) {
      const row = document.createElement('div')
      row.className = 'hero-training-entry'
      const text = document.createElement('span')
      text.textContent = t('buildingTrainingWaiting', { type: t(type), count: waiting.length })
      row.appendChild(text)
      row.appendChild(
        button(`training-remove-${type}`, t('buildingTrainingRemoveOne'), () => {
          cancelBuildingTrainingRequest(building, waiting[waiting.length - 1])
        })
      )
      queue.appendChild(row)
    }
  }
  for (const request of building.trainingRequests ?? []) {
    if (!request.traineeLabel) continue
    const unit = building.owner?.units.find(unit => unit.label === request.traineeLabel)
    const row = document.createElement('div')
    row.className = 'hero-training-entry'
    const text = document.createElement('span')
    text.textContent = t('buildingTrainingIncoming', { name: unit?.name || t(request.type), type: t(request.type) })
    row.appendChild(text)
    row.appendChild(
      button(`training-incoming-${request.traineeLabel}`, t('cancel'), () => {
        cancelBuildingTrainingRequest(building, request)
      })
    )
    queue.appendChild(row)
  }
  building.trainingQueue?.forEach((entry, index) => {
    const row = document.createElement('div')
    row.className = 'hero-training-entry'
    row.dataset.trainingIndex = String(index)
    row.dataset.actionId = entry.type
    const name = document.createElement('span')
    name.textContent = entry.trainee.name ? `${entry.trainee.name} · ${t(entry.type)}` : t(entry.type)
    row.appendChild(name)
    const status = document.createElement('span')
    status.className = 'hero-building-menu-status is-visible'
    const time = document.createElement('span')
    time.className = 'hero-building-menu-status-text'
    time.textContent = formatTrainingEntryTimeRemaining(building, entry) ?? `${Math.floor(entry.loading ?? 0)}%`
    status.appendChild(time)
    row.appendChild(status)
    row.appendChild(
      button(`training-cancel-${entry.trainee.label}`, t('cancel'), () => {
        building.cancelTrainingEntry?.(entry.trainee.label)
      })
    )
    queue.appendChild(row)
  })
  return panel
}
