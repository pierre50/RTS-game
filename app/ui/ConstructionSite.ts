import { estimateConstructionDuration } from '../lib/buildings/constructionDuration'
import {
  constructionWorkTotal,
  constructionProgressPercentage,
  constructionMaterialsReady,
} from '../lib/economy/constructionMaterials'
import { getBuildingConfigForLevel, getBuildingLevel } from '../lib/buildings/buildingLevel'
import { getLang, t } from '../lib/lang'
import type { BuildingConfig } from '../types/config'
import type { BuildingEntity } from '../types/entities'
import type { ResourceAmount } from '../types/common'
import { constructionDurationDescription } from './ConstructionDurationDescription'
import { createResourceCost } from './ResourceCost'

export type ConstructionSiteOptions = {
  config: BuildingConfig
  level: number
  cost: ResourceAmount
  building?: BuildingEntity
}

/** The same materials/time card in the catalogue, inspections and renovations. */
export function createConstructionSite(options: ConstructionSiteOptions): HTMLElement {
  const { config, level, building } = options
  const root = document.createElement('div')
  root.className = 'construction-site'
  const heading = document.createElement('span')
  heading.className = 'construction-site-heading'
  heading.textContent = t('constructionSiteHeading')
  const badges = document.createElement('div')
  badges.className = 'construction-site-badges'
  const ledger = building?.constructionMaterials
  const cost = ledger?.cost ?? options.cost
  const progress: ResourceAmount = {}
  if (building)
    for (const key of Object.keys(cost) as Array<keyof ResourceAmount>) {
      progress[key] = ledger ? (ledger.delivered[key] ?? 0) + (ledger.consumed[key] ?? 0) : (cost[key] ?? 0)
    }
  badges.appendChild(
    createResourceCost(
      building ? { mode: 'progress', cost, progress, heading: '' } : { mode: 'delivery', cost, heading: '' }
    )
  )
  const percentage = building ? constructionProgressPercentage(building) : 0
  const work = building ? constructionWorkTotal(building) : (config.constructionWorkRequired ?? config.constructionTime)
  const remaining = building ? (work ?? 0) * Math.max(0, 1 - percentage / 100) : work
  const estimate = estimateConstructionDuration(remaining, level)
  if (estimate) {
    const time = document.createElement('span')
    time.className = 'resource-cost-item construction-site-time'
    time.title = `${t(building ? 'constructionTimeRemaining' : 'constructionTimeTotal')}. ${constructionDurationDescription(config, level, remaining)}`
    time.setAttribute('aria-label', time.title)
    const icon = document.createElement('span')
    icon.className = 'construction-site-hourglass'
    icon.setAttribute('aria-hidden', 'true')
    icon.innerHTML =
      '<svg viewBox="0 0 16 16" fill="currentColor" shape-rendering="crispEdges"><path d="M3 1h10v2H3zm1 2h2v3l2 2-2 2v3H4V9l2-1-2-1zm6 0h2v4l-2 1 2 1v4h-2v-3L8 8l2-2zM3 13h10v2H3zM6 11h4v2H6z"/></svg>'
    const label = document.createElement('span')
    label.className = 'construction-site-duration'
    label.textContent = t(
      estimate.unit === 'days'
        ? estimate.value === 1
          ? 'constructionDurationDay'
          : 'constructionDurationDays'
        : 'constructionDurationHours',
      {
        value: estimate.value.toLocaleString(getLang()),
      }
    )
    if (building) label.textContent = t('constructionRemainingDuration', { duration: label.textContent })
    time.append(icon, label)
    badges.appendChild(time)
  }
  root.append(heading, badges)
  if (building) {
    const paused = Boolean(building.constructionPaused)
    const supplied = constructionMaterialsReady(building)
    if (paused) root.classList.add('is-paused')
    const status = document.createElement('div')
    status.className = 'construction-work-status'
    const label = document.createElement('span')
    label.textContent = paused
      ? t('constructionPaused')
      : t(supplied ? 'constructionBuildStage' : 'constructionDeliveryStage')
    status.appendChild(label)
    if (supplied || paused) {
      const bar = document.createElement('progress')
      bar.className = 'construction-site-progress'
      bar.max = 100
      bar.value = percentage
      bar.setAttribute('aria-label', t('constructionBuildStage'))
      const value = document.createElement('span')
      value.textContent = paused ? '⏸' : `${Math.floor(percentage)}%`
      status.append(bar, value)
    }
    root.appendChild(status)
  }
  return root
}

export function constructionSiteOptions(building: BuildingEntity): ConstructionSiteOptions {
  const level = building.buildingUpgrade?.targetLevel ?? getBuildingLevel(building)
  const config = getBuildingConfigForLevel(
    building.owner?.config?.buildings?.[building.type] ?? {
      constructionTime: building.constructionTime,
      constructionWorkRequired: building.constructionWorkRequired,
    },
    level
  )
  return { config, level, cost: building.constructionMaterials?.cost ?? config.cost ?? {}, building }
}
