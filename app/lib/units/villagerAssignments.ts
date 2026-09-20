import { ACTION_TYPES, RESOURCE_NAMES, RESOURCE_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import type { RuntimeEntity, UnitEntity, VillagerAutonomyJob, UnitRestState } from '../../types/entities'

type ResourceName = (typeof RESOURCE_NAMES)[number]
type ResourceJob = Extract<VillagerAutonomyJob, 'food' | 'wood' | 'stone' | 'gold' | 'copper' | 'iron'>

export type VillagerAssignmentSummary = {
  total: number
  assigned: Record<ResourceName, number>
  construction: number
  horseCapture: number
  idle: number
  sleeping: number
  moving: number
}

const RESOURCE_JOB_BY_AUTONOMY: Partial<Record<VillagerAutonomyJob, ResourceJob>> = {
  food: 'food',
  wood: 'wood',
  stone: 'stone',
  gold: 'gold',
  copper: 'copper',
  iron: 'iron',
}

function createAssignedCounts(): Record<ResourceName, number> {
  return Object.fromEntries(RESOURCE_NAMES.map(resource => [resource, 0])) as Record<ResourceName, number>
}

function resourceFromMiningTarget(unit: UnitEntity): ResourceJob {
  const target = unit.dest ?? (unit.lookingAtHero ? unit.previousDest : null)
  const destType = ((target as RuntimeEntity | null | undefined)?.type ?? '').toString()
  if (destType === RESOURCE_TYPES.copper || unit.action === ACTION_TYPES.minecopper) return 'copper'
  if (destType === RESOURCE_TYPES.iron || unit.action === ACTION_TYPES.mineiron) return 'iron'
  return 'gold'
}

function resourceFromWork(unit: UnitEntity, work: string | null | undefined): ResourceJob | null {
  if (work === WORK_TYPES.woodcutter) return 'wood'
  if (work === WORK_TYPES.stoneminer) return 'stone'
  if (work === WORK_TYPES.goldminer) return resourceFromMiningTarget(unit)
  if (work === WORK_TYPES.forager || work === WORK_TYPES.farmer || work === WORK_TYPES.hunter) return 'food'
  return null
}

function shelterResource(unit: UnitEntity, state: UnitRestState): ResourceJob | null {
  const previousJob = state.previousAutonomousJob ? RESOURCE_JOB_BY_AUTONOMY[state.previousAutonomousJob] : null
  return previousJob ?? resourceFromWork(unit, state.previousWork)
}

function assignedResource(unit: UnitEntity): ResourceJob | null {
  const state = unit.shelterState
  if (state?.reason === 'sleep') return shelterResource(unit, state)
  const autonomousResource = unit.autonomousJob ? RESOURCE_JOB_BY_AUTONOMY[unit.autonomousJob] : null
  return autonomousResource ?? resourceFromWork(unit, unit.work)
}

// AI orders may set work without autonomousJob; use the same role resolution for UI and dialogue.
export function getVillagerAssignedJob(unit: UnitEntity): VillagerAutonomyJob | null {
  const resource = assignedResource(unit)
  if (resource) return resource
  if (unit.autonomousJob === 'construction' || unit.work === WORK_TYPES.builder) return 'construction'
  if (unit.autonomousJob === 'horseCapture' || unit.work === WORK_TYPES.horseCapture) return 'horseCapture'
  return null
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

    const job = getVillagerAssignedJob(unit)
    if (job === 'construction') summary.construction++
    else if (job === 'horseCapture') summary.horseCapture++
    else if (job) summary.assigned[job]++
    else summary.idle++
  }

  return summary
}
