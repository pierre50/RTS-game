import { ACTION_TYPES, RESOURCE_NAMES, RESOURCE_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import type { RuntimeEntity, UnitEntity, VillagerAutonomyJob, VillagerShelterState } from '../../types/entities'

type ResourceName = (typeof RESOURCE_NAMES)[number]

export type VillagerAssignmentSummary = {
  total: number
  assigned: Record<ResourceName, number>
  construction: number
  horseCapture: number
  idle: number
  sleeping: number
  moving: number
}

const RESOURCE_JOB_BY_AUTONOMY: Partial<Record<VillagerAutonomyJob, ResourceName>> = {
  food: 'food',
  wood: 'wood',
  stone: 'stone',
  gold: 'gold',
}

function createAssignedCounts(): Record<ResourceName, number> {
  return Object.fromEntries(RESOURCE_NAMES.map(resource => [resource, 0])) as Record<ResourceName, number>
}

function resourceFromMiningTarget(unit: UnitEntity): ResourceName {
  const destType = ((unit.dest as RuntimeEntity | null | undefined)?.type ?? '').toString()
  if (destType === RESOURCE_TYPES.copper || unit.action === ACTION_TYPES.minecopper) return 'copper'
  if (destType === RESOURCE_TYPES.iron || unit.action === ACTION_TYPES.mineiron) return 'iron'
  return 'gold'
}

function resourceFromWork(unit: UnitEntity, work: string | null | undefined): ResourceName | null {
  if (work === WORK_TYPES.woodcutter) return 'wood'
  if (work === WORK_TYPES.stoneminer) return 'stone'
  if (work === WORK_TYPES.goldminer) return resourceFromMiningTarget(unit)
  if (work === WORK_TYPES.forager || work === WORK_TYPES.farmer || work === WORK_TYPES.hunter) return 'food'
  return null
}

function shelterResource(unit: UnitEntity, state: VillagerShelterState): ResourceName | null {
  const previousJob = state.previousAutonomousJob ? RESOURCE_JOB_BY_AUTONOMY[state.previousAutonomousJob] : null
  return previousJob ?? resourceFromWork(unit, state.previousWork)
}

function assignedResource(unit: UnitEntity): ResourceName | null {
  const state = unit.shelterState
  if (state?.reason === 'sleep') return shelterResource(unit, state)
  const autonomousResource = unit.autonomousJob ? RESOURCE_JOB_BY_AUTONOMY[unit.autonomousJob] : null
  return autonomousResource ?? resourceFromWork(unit, unit.work)
}

export function summarizeVillagerAssignments(units: Iterable<UnitEntity> = []): VillagerAssignmentSummary {
  const assigned = createAssignedCounts()
  const summary: VillagerAssignmentSummary = {
    total: 0,
    assigned,
    construction: 0,
    horseCapture: 0,
    idle: 0,
    sleeping: 0,
    moving: 0,
  }

  for (const unit of units) {
    if (unit.type !== UNIT_TYPES.villager || unit.isDead || unit.isDestroyed) continue
    summary.total++
    if (unit.shelterState?.reason === 'sleep') summary.sleeping++
    if ((unit.path?.length ?? 0) > 0) summary.moving++

    const resource = assignedResource(unit)
    if (resource) {
      summary.assigned[resource]++
      continue
    }
    if (unit.autonomousJob === 'construction' || unit.work === WORK_TYPES.builder) {
      summary.construction++
      continue
    }
    if (unit.autonomousJob === 'horseCapture' || unit.work === WORK_TYPES.horseCapture) {
      summary.horseCapture++
      continue
    }
    summary.idle++
  }

  return summary
}
