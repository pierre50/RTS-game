import { ACTION_TYPES, BUILDING_TYPES, MINING_RESOURCE_CONFIG, UNIT_TYPES, WORK_TYPES } from '../../constants'
import { canUnitUseCellAsIdleDestination, createReservedPassageCellLookup } from '../buildings/passageCells'
import { getInstanceClosestFreeCellPath } from '../grid/movement'
import type { RuntimeEntity, UnitEntity, VillagerAutonomyJob } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

export type VillagerJobCandidate = {
  action: string
  send: (target: RuntimeEntity) => unknown
  target: RuntimeEntity
  work: string
}

type CandidateEvaluation = VillagerJobCandidate & {
  dropoffDistance: number
  pathLength: number
  rejectedReason: string | null
  score: number
  workerLoad: number
}

type CandidateScoringOptions = {
  targetWorkerLoad: (target: RuntimeEntity, work: string, action: string) => number
}

const AUTONOMY_REJECT_TTL_MS = 8000
const MAX_CANDIDATES_TO_PATH = 18
const WORKER_LOAD_SCORE = 6
const DROPOFF_DISTANCE_SCORE = 0.15
const rejectedAutonomyTargets = new WeakMap<UnitEntity, Map<VillagerAutonomyJob, Map<string, number>>>()

function distance(a: Pick<RuntimeEntity, 'i' | 'j'>, b: Pick<RuntimeEntity, 'i' | 'j'>): number {
  return Math.abs(a.i - b.i) + Math.abs(a.j - b.j)
}

export function sameTarget(a: RuntimeEntity | null | undefined, b: RuntimeEntity | null | undefined): boolean {
  if (!a || !b) return false
  if (a === b) return true
  return Boolean(a.label && b.label && a.label === b.label)
}

function targetKey(target: RuntimeEntity): string {
  return target.label || `${target.type}:${target.i}:${target.j}`
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function getRejectedTargets(unit: UnitEntity, job: VillagerAutonomyJob): Map<string, number> | null {
  return rejectedAutonomyTargets.get(unit)?.get(job) ?? null
}

function clearEmptyRejectedTargets(unit: UnitEntity, job: VillagerAutonomyJob): void {
  const byJob = rejectedAutonomyTargets.get(unit)
  const targets = byJob?.get(job)
  if (!byJob || !targets || targets.size > 0) return
  byJob.delete(job)
  if (byJob.size === 0) rejectedAutonomyTargets.delete(unit)
}

export function clearVillagerAutonomyTargetRejections(unit: UnitEntity, job: VillagerAutonomyJob): void {
  const byJob = rejectedAutonomyTargets.get(unit)
  byJob?.delete(job)
  if (byJob && byJob.size === 0) rejectedAutonomyTargets.delete(unit)
}

export function getAutonomyJobForWork(work: string | null | undefined): VillagerAutonomyJob | null {
  if (work === WORK_TYPES.woodcutter) return 'wood'
  if (work === WORK_TYPES.stoneminer) return 'stone'
  if (work === WORK_TYPES.goldminer) return 'gold'
  if (work === WORK_TYPES.builder) return 'construction'
  if (work === WORK_TYPES.horseCapture) return 'horseCapture'
  if (work === WORK_TYPES.forager || work === WORK_TYPES.farmer || work === WORK_TYPES.hunter) {
    return 'food'
  }
  return null
}

export function markVillagerAutonomyTargetRejected(unit: UnitEntity, target: RuntimeEntity | null | undefined): void {
  if (unit.type !== UNIT_TYPES.villager || !target) return
  const job = unit.autonomousJob ?? getAutonomyJobForWork(unit.work)
  if (!job) return
  let byJob = rejectedAutonomyTargets.get(unit)
  if (!byJob) {
    byJob = new Map()
    rejectedAutonomyTargets.set(unit, byJob)
  }
  let targets = byJob.get(job)
  if (!targets) {
    targets = new Map()
    byJob.set(job, targets)
  }
  targets.set(targetKey(target), nowMs() + AUTONOMY_REJECT_TTL_MS)
}

export function targetWorkerLoad(unit: UnitEntity, target: RuntimeEntity, work: string, action: string): number {
  const workers = unit.owner?.units ?? []
  let load = 0
  for (const worker of workers) {
    if (worker === unit || worker.isDead || worker.isDestroyed) continue
    if (worker.type !== UNIT_TYPES.villager || worker.work !== work || worker.action !== action) continue
    if (sameTarget(worker.dest as RuntimeEntity | null | undefined, target)) load++
  }
  return load
}

function isRejectedTarget(unit: UnitEntity, job: VillagerAutonomyJob, target: RuntimeEntity): boolean {
  const targets = getRejectedTargets(unit, job)
  if (!targets) return false
  const key = targetKey(target)
  const expiresAt = targets.get(key)
  if (!expiresAt) return false
  if (expiresAt > nowMs()) return true
  targets.delete(key)
  clearEmptyRejectedTargets(unit, job)
  return false
}

function getCompatibleDropoffTypes(candidate: VillagerJobCandidate): Set<string> | null {
  if (candidate.action === ACTION_TYPES.forageberry || candidate.action === ACTION_TYPES.farm) {
    return new Set([BUILDING_TYPES.granary, BUILDING_TYPES.townCenter])
  }
  const miningActions = new Set(Object.values(MINING_RESOURCE_CONFIG ?? {}).map(config => config.action))
  if (candidate.action === ACTION_TYPES.chopwood || miningActions.has(candidate.action)) {
    return new Set([BUILDING_TYPES.storagePit, BUILDING_TYPES.townCenter])
  }
  if (candidate.action === ACTION_TYPES.takemeat) {
    return new Set([BUILDING_TYPES.granary, BUILDING_TYPES.townCenter])
  }
  return null
}

function nearestDropoffDistance(unit: UnitEntity, candidate: VillagerJobCandidate): number {
  const compatibleTypes = getCompatibleDropoffTypes(candidate)
  if (!compatibleTypes) return 0
  let best = Infinity
  for (const building of unit.owner?.buildings ?? []) {
    if (building.owner !== unit.owner || !building.isBuilt || building.isDead || building.isDestroyed) continue
    if (!compatibleTypes.has(building.type)) continue
    best = Math.min(best, distance(candidate.target, building))
  }
  return best
}

function getCandidatePathLength(unit: UnitEntity, candidate: VillagerJobCandidate): number | null {
  if (unit.isUnitAtDest?.(candidate.action, candidate.target)) return 0
  const map = unit.context?.map
  if (!map?.grid) return distance(unit, candidate.target)
  const passageLookup = createReservedPassageCellLookup(unit.context)
  const path = getInstanceClosestFreeCellPath<RuntimeCell>(unit, candidate.target, map, {
    isCellAllowed: cell => canUnitUseCellAsIdleDestination(unit, cell, { passageLookup }),
  })
  return path.length ? path.length : null
}

function evaluateCandidate(
  unit: UnitEntity,
  job: VillagerAutonomyJob,
  candidate: VillagerJobCandidate,
  options: CandidateScoringOptions
): CandidateEvaluation {
  const workerLoad = options.targetWorkerLoad(candidate.target, candidate.work, candidate.action)
  const dropoffDistance = nearestDropoffDistance(unit, candidate)
  const pathLength = getCandidatePathLength(unit, candidate)
  let rejectedReason: string | null = null
  if (isRejectedTarget(unit, job, candidate.target)) rejectedReason = 'recently-rejected'
  else if (!unit.getActionCondition?.(candidate.target, candidate.action)) rejectedReason = 'invalid-action'
  else if (pathLength === null) rejectedReason = 'no-contact-path'

  const dropoffScore = Number.isFinite(dropoffDistance) ? dropoffDistance * DROPOFF_DISTANCE_SCORE : 0
  const score = (pathLength ?? distance(unit, candidate.target)) + workerLoad * WORKER_LOAD_SCORE + dropoffScore
  return {
    ...candidate,
    dropoffDistance,
    pathLength: pathLength ?? Infinity,
    rejectedReason,
    score,
    workerLoad,
  }
}

function rankVillagerJobCandidates(
  unit: UnitEntity,
  job: VillagerAutonomyJob,
  candidates: VillagerJobCandidate[],
  options: CandidateScoringOptions
): CandidateEvaluation[] {
  return [...candidates]
    .sort((a, b) => distance(unit, a.target) - distance(unit, b.target))
    .slice(0, MAX_CANDIDATES_TO_PATH)
    .map(candidate => evaluateCandidate(unit, job, candidate, options))
    .sort((a, b) => a.score - b.score)
}

function wasAutonomyOrderAccepted(unit: UnitEntity, candidate: VillagerJobCandidate, result: unknown): boolean {
  const dest = unit.dest as RuntimeEntity | null | undefined
  if (sameTarget(dest, candidate.target) && unit.action === candidate.action) return true
  if (
    unit.blockedGatherApproach?.target &&
    sameTarget(unit.blockedGatherApproach.target, candidate.target) &&
    unit.blockedGatherApproach.action === candidate.action
  ) {
    return true
  }
  if (unit.isUnitAtDest?.(candidate.action, candidate.target) && unit.action === candidate.action) return true
  return result !== false && sameTarget(dest, candidate.target) && unit.work === candidate.work
}

export function tryVillagerJobCandidates(
  unit: UnitEntity,
  job: VillagerAutonomyJob,
  candidates: VillagerJobCandidate[],
  options: CandidateScoringOptions
): boolean {
  for (const candidate of rankVillagerJobCandidates(unit, job, candidates, options)) {
    if (candidate.rejectedReason) continue
    const result = candidate.send(candidate.target)
    if (wasAutonomyOrderAccepted(unit, candidate, result)) {
      clearVillagerAutonomyTargetRejections(unit, job)
      return true
    }
    markVillagerAutonomyTargetRejected(unit, candidate.target)
  }
  return false
}
