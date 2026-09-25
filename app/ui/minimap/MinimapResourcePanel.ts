import { createInventorySectionTitle } from '../inventory/InventorySection'
import { Modal } from '../../lib/ui/Modal'
import { createInventoryResourceIcon } from '../inventory/InventoryItemIcons'
import { BUILDING_TYPES, POPULATION_MAX, RESOURCE_NAMES, RESOURCE_STORAGE_NAMES, UNIT_TYPES } from '../../constants'
import { DAILY_CONSUMPTION_PER_VILLAGER } from '../../constants/consumption'
import { STABLE_HORSE_CAPACITY, getStableHorseAmount } from '../../lib/horses/stableHorses'
import { t } from '../../lib/lang'
import { getPlayerResourceTotals } from '../../lib/resources/playerResourceTotals'
import { getAutonomyJobForWork } from '../../lib/units/villagerAutonomyTargeting'
import type { BuildingEntity, UnitEntity, VillagerAutonomyJob } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import type { MenuHost } from '../MenuHost'

type ResourceName = (typeof RESOURCE_NAMES)[number]
const VILLAGER_AUTONOMY_JOB_ORDER: VillagerAutonomyJob[] = [
  'food',
  'wood',
  'stone',
  'gold',
  'copper',
  'iron',
  'construction',
  'horseCapture',
]
const MINIMAP_RESOURCE_LABEL_KEYS: Record<ResourceName, string> = {
  copper: 'minimapResourceCopper',
  food: 'minimapResourceFood',
  gold: 'minimapResourceGold',
  iron: 'minimapResourceIron',
  stone: 'minimapResourceStone',
  wood: 'minimapResourceWood',
}

function getActivePlayerBuildings(player: PlayerLike | null | undefined): BuildingEntity[] {
  if (!player) return []
  return (player.buildings ?? []).filter(building => !building.isDead && !building.isDestroyed)
}

function getActiveVillagers(player: PlayerLike | null | undefined): UnitEntity[] {
  if (!player) return []
  return (player.units ?? []).filter(unit => unit.type === UNIT_TYPES.villager && !unit.isDead && !unit.isDestroyed)
}

function countQueuedTraining(buildings: BuildingEntity[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const building of buildings) {
    for (const type of building.queue ?? []) {
      if (!type) continue
      counts.set(type, (counts.get(type) ?? 0) + 1)
    }
    if (building.trainingType && !(building.queue ?? []).includes(building.trainingType)) {
      counts.set(building.trainingType, (counts.get(building.trainingType) ?? 0) + 1)
    }
  }
  return counts
}

function getStableHorseSummary(buildings: BuildingEntity[]): { available: number; capacity: number } {
  const stables = buildings.filter(building => building.type === BUILDING_TYPES.stable)
  return {
    available: stables.reduce((total, stable) => total + getStableHorseAmount(stable), 0),
    capacity: stables.length * STABLE_HORSE_CAPACITY,
  }
}

function resolveVillagerAutonomyJob(villager: UnitEntity): VillagerAutonomyJob | null {
  const sleepState = villager.shelterState?.reason === 'sleep' ? villager.shelterState : null
  return (
    sleepState?.previousAutonomousJob ??
    villager.autonomousJob ??
    getAutonomyJobForWork(sleepState?.previousWork ?? villager.work)
  )
}

function countVillagersByAutonomy(villagers: UnitEntity[]): {
  jobCounts: Map<VillagerAutonomyJob, number>
  unassigned: number
} {
  const jobCounts = new Map<VillagerAutonomyJob, number>()
  let unassigned = 0
  for (const villager of villagers) {
    const job = resolveVillagerAutonomyJob(villager)
    if (!job) {
      unassigned++
      continue
    }
    jobCounts.set(job, (jobCounts.get(job) ?? 0) + 1)
  }
  return { jobCounts, unassigned }
}

function minimapResourceLabel(resource: ResourceName): string {
  return t(MINIMAP_RESOURCE_LABEL_KEYS[resource])
}

function formatDailyConsumption(villagerCount: number): string {
  const parts = RESOURCE_NAMES.map(resource => {
    const amount = Math.max(0, Math.floor((DAILY_CONSUMPTION_PER_VILLAGER[resource] ?? 0) * villagerCount))
    return amount > 0 ? `${amount} ${minimapResourceLabel(resource)}` : null
  }).filter((part): part is string => Boolean(part))
  return parts.join(', ') || '0'
}

function createReportSection(title: string, content: HTMLElement): HTMLElement {
  const section = document.createElement('section')
  section.className = 'inventory-section base-report-section'
  section.append(createInventorySectionTitle(title), content)
  return section
}

function createStatRow(labelText: string, valueText: string): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'base-report-stat'
  const label = document.createElement('span')
  label.className = 'base-report-label'
  label.textContent = labelText
  const value = document.createElement('span')
  value.className = 'base-report-value'
  value.textContent = valueText
  row.append(label, value)
  return row
}

function villagerAutonomyJobLabel(job: VillagerAutonomyJob): string {
  if (job === 'construction') return t('npcOrderConstruction')
  if (job === 'horseCapture') return t('npcOrderHorseCapture')
  return minimapResourceLabel(job)
}

function createVillagerSection(menu: MenuHost): HTMLElement {
  const player = menu.context.player
  const villagers = getActiveVillagers(player)
  const { jobCounts, unassigned } = countVillagersByAutonomy(villagers)
  const rows = document.createElement('div')
  rows.className = 'base-report-stats'
  rows.appendChild(
    createStatRow(
      t('minimapUnits'),
      `${player?.population ?? 0}/${Math.min(POPULATION_MAX, player?.populationMax ?? 0)}`
    )
  )
  rows.appendChild(createStatRow(t('minimapVillagers'), String(villagers.length)))
  rows.appendChild(createStatRow(t('minimapVillagerConsumption'), formatDailyConsumption(villagers.length)))

  for (const job of VILLAGER_AUTONOMY_JOB_ORDER) {
    const count = jobCounts.get(job) ?? 0
    if (count > 0) rows.appendChild(createStatRow(villagerAutonomyJobLabel(job), String(count)))
  }
  for (const [job, count] of [...jobCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (VILLAGER_AUTONOMY_JOB_ORDER.includes(job)) continue
    rows.appendChild(createStatRow(villagerAutonomyJobLabel(job), String(count)))
  }
  rows.appendChild(createStatRow(t('minimapVillagerUnassigned'), String(unassigned)))

  return createReportSection(t('minimapVillagers'), rows)
}

function createTrainingSection(menu: MenuHost): HTMLElement {
  const buildings = getActivePlayerBuildings(menu.context.player)
  const trainingCounts = countQueuedTraining(buildings)
  const horses = getStableHorseSummary(buildings)
  const rows = document.createElement('div')
  rows.className = 'base-report-stats'
  if (!trainingCounts.size) {
    const empty = document.createElement('div')
    empty.className = 'base-report-empty'
    empty.textContent = t('minimapTrainingEmpty')
    rows.appendChild(empty)
  } else {
    for (const [type, count] of [...trainingCounts.entries()].sort(
      (a, b) => b[1] - a[1] || t(a[0]).localeCompare(t(b[0]))
    )) {
      rows.appendChild(createStatRow(t(type), String(count)))
    }
  }
  rows.appendChild(createStatRow(t('minimapStableHorses'), `${horses.available}/${horses.capacity}`))

  return createReportSection(t('minimapTraining'), rows)
}

export function renderBaseReport(container: HTMLElement, menu: MenuHost): void {
  container.replaceChildren()
  const totals = getPlayerResourceTotals(menu.context.player, { includeHero: false })
  const grid = document.createElement('div')
  grid.className = 'base-resource-grid'
  for (const resource of RESOURCE_STORAGE_NAMES) {
    if (totals[resource] <= 0) continue
    const item = document.createElement('div')
    item.className = 'base-resource-item'
    item.title = `${t(resource)}: ${totals[resource]}`
    item.setAttribute('aria-label', item.title)
    const amount = document.createElement('span')
    amount.textContent = String(totals[resource])
    item.append(createInventoryResourceIcon(resource), amount)
    grid.appendChild(item)
  }
  if (!grid.children.length) {
    const empty = document.createElement('div')
    empty.className = 'base-report-empty'
    empty.textContent = t('minimapLocalStockEmpty')
    grid.appendChild(empty)
  }
  container.append(
    createReportSection(t('baseReserves'), grid),
    createVillagerSection(menu),
    createTrainingSection(menu)
  )
}

export function openBaseReport(menu: MenuHost): Modal {
  const content = document.createElement('div')
  content.className = 'base-report'
  renderBaseReport(content, menu)
  const pausedByReport = !menu.context.paused
  if (pausedByReport) {
    menu.context.pause?.()
    document.getElementById('pause')?.remove()
  }
  let released = false
  const release = () => {
    if (released) return
    released = true
    if (pausedByReport) menu.context.resume?.()
  }
  class ReportModal extends Modal {
    override close(): void {
      super.close()
      release()
    }
  }
  return new ReportModal({ title: t('baseReport'), content, onClose: release })
}
