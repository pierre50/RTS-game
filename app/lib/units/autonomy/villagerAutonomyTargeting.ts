import { canUseResourceApproachCell } from '../../grid/resourceApproachDestination'
import { searchInstancePath } from '../../../services/Pathfinding'
import { resolveResource } from '../../../classes/resources/CompactResourceSet'
import { RESOURCE_TYPES, UNIT_TYPES, WORK_TYPES } from '../../../constants'
import { knownTarget } from '../playerTargetKnowledge'
import type { RuntimeEntity, UnitEntity, VillagerAutonomyJob } from '../../../types/entities'
import type { RuntimeCell } from '../../../types/map'
import {
  canUseReservedPassageCellForTransit,
  createReservedPassageCellLookup,
  type ReservedPassageCellLookup,
} from '../../buildings/passageCells'
import { getInstancePath, getInstanceClosestFreeCellPath, searchInstanceClosestFreeCellPath } from '../../grid/movement'
import { prepareContactPath, takePreparedContactPath } from '../../grid/preparedContactPath'
import { getEntitySpaceMapLike } from '../../mapSpaces'
import { nearestDropoffDistance } from './villagerDropoffDistance'

import { isPursuingRememberedTarget } from '../combat/targetPursuit'

export type VillagerJobCandidate = {
  action: string
  send: (target: RuntimeEntity) => unknown
  target: RuntimeEntity
  work: string
}

type CandidateEvaluation = VillagerJobCandidate & {
  commit: <T>(send: () => T) => T
  valid: () => boolean
  readyWood: boolean
  dropoffDistance: number
  pathLength: number
  rejectedReason: string | null
  score: number
  workerLoad: number
}

type CandidateScoringOptions = {
  incremental?: boolean
  targetWorkerLoad: (target: RuntimeEntity, work: string, action: string) => number
}

const AUTONOMY_REJECT_TTL_MS = 8000
const MAX_CANDIDATES_TO_PATH = 18
const WORKER_LOAD_SCORE = 6
const DROPOFF_DISTANCE_SCORE = 0.15
const rejectionOrigins = new WeakMap<UnitEntity, { i: number; j: number; space: unknown }>()
const rejectedAutonomyTargets = new WeakMap<UnitEntity, Map<VillagerAutonomyJob, Map<string, number>>>()
const candidateSearches = new WeakMap<UnitEntity, Map<string, { space: unknown; offset: number }>>()

function candidateSearch(unit: UnitEntity, job: VillagerAutonomyJob) {
  let searches = candidateSearches.get(unit)
  if (!searches) {
    searches = new Map()
    candidateSearches.set(unit, searches)
  }
  const key = `${job}:${unit.collectiveTask ?? ''}`
  let state = searches.get(key)
  if (!state || state.space !== unit.spaceId) {
    state = { space: unit.spaceId, offset: 0 }
    searches.set(key, state)
  }
  return state
}

/** Read enough nearby records for the next batch, but still path at most 18 per attempt. */
export function villagerJobCandidateLimit(unit: UnitEntity, job: VillagerAutonomyJob): number {
  return candidateSearch(unit, job).offset + MAX_CANDIDATES_TO_PATH
}

function distance(a: Pick<RuntimeEntity, 'i' | 'j'>, b: Pick<RuntimeEntity, 'i' | 'j'>): number {
  return Math.abs(a.i - b.i) + Math.abs(a.j - b.j)
}

function sameTarget(a: RuntimeEntity | null | undefined, b: RuntimeEntity | null | undefined): boolean {
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
  const origin = rejectionOrigins.get(unit)
  if (origin && (origin.i !== unit.i || origin.j !== unit.j || origin.space !== unit.spaceId)) {
    rejectedAutonomyTargets.delete(unit)
    rejectionOrigins.delete(unit)
  }
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
  candidateSearches.delete(unit)
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
  rejectTarget(unit, job, target)
}

function rejectTarget(unit: UnitEntity, job: VillagerAutonomyJob, target: RuntimeEntity): void {
  getRejectedTargets(unit, job)
  rejectionOrigins.set(unit, { i: unit.i, j: unit.j, space: unit.spaceId })
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

export function isVillagerWorkTargetRejected(unit: UnitEntity, target: RuntimeEntity): boolean {
  if (unit.type !== UNIT_TYPES.villager) return false
  const job = unit.autonomousJob ?? getAutonomyJobForWork(unit.work)
  return Boolean(job && isRejectedTarget(unit, job, target))
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

function* getCandidatePath(
  unit: UnitEntity,
  candidate: VillagerJobCandidate,
  getPassageLookup: () => ReservedPassageCellLookup,
  incremental: boolean
): Generator<
  void,
  { length: number | null; commit: <T>(send: () => T) => T; valid: () => boolean; stale?: boolean },
  void
> {
  const commit = <T>(send: () => T): T => send()
  const valid = () => true
  if (unit.isUnitAtDest?.(candidate.action, candidate.target)) return { length: 0, commit, valid }
  const map = getEntitySpaceMapLike(unit, unit.context?.map)
  if (!map?.grid) return { length: distance(unit, candidate.target), commit, valid }
  const passageLookup = getPassageLookup()
  const pathOptions = {
    isCellAllowed: (cell: RuntimeCell) => canUseResourceApproachCell(unit, cell, candidate.target, { passageLookup }),
    pathfinding: {
      canPassThroughSolidCell: (cell: RuntimeCell) => canUseReservedPassageCellForTransit(cell, passageLookup),
    },
  }
  const { i, j, size } = candidate.target
  const direct = !candidate.action && !map.grid[i]?.[j]?.solid
  const path = direct
    ? incremental
      ? yield* searchInstancePath(unit, i, j, { grid: map.grid, context: unit.context }, pathOptions.pathfinding)
      : getInstancePath(unit, i, j, map, pathOptions.pathfinding)
    : incremental
      ? yield* searchInstanceClosestFreeCellPath(unit, candidate.target, map, pathOptions)
      : getInstanceClosestFreeCellPath(unit, candidate.target, map, pathOptions)
  if (candidate.target.i !== i || candidate.target.j !== j || candidate.target.size !== size)
    return { length: null, commit, valid: () => false, stale: true }
  const prepared = prepareContactPath(unit, candidate.target, map, path)
  return {
    length: path.length || null,
    commit: prepared,
    valid: () => {
      if (!incremental) return true
      const currentMap = getEntitySpaceMapLike(unit, unit.context?.map)
      if (!currentMap) return false
      const passages = createReservedPassageCellLookup(unit.context)
      return (
        prepared(() =>
          takePreparedContactPath(
            unit,
            candidate.target,
            currentMap,
            cell => canUseResourceApproachCell(unit, cell, candidate.target, { passageLookup: passages }),
            { canPassThroughSolidCell: cell => canUseReservedPassageCellForTransit(cell, passages) }
          )
        ) !== null
      )
    },
  }
}

/** Shared incremental route preparation, including path reuse when the order is committed. */
export function* planResourceApproach(unit: UnitEntity, target: RuntimeEntity, action: string, incremental: boolean) {
  let passages: ReservedPassageCellLookup | undefined
  return yield* getCandidatePath(
    unit,
    { target, action, work: '', send: () => false },
    () => (passages ??= createReservedPassageCellLookup(unit.context)),
    incremental
  )
}

function* evaluateCandidate(
  unit: UnitEntity,
  job: VillagerAutonomyJob,
  candidate: VillagerJobCandidate,
  options: CandidateScoringOptions,
  getPassageLookup: () => ReservedPassageCellLookup
): Generator<void, CandidateEvaluation, void> {
  candidate = { ...candidate, target: resolveResource(candidate.target) }
  const workerLoad = options.targetWorkerLoad(candidate.target, candidate.work, candidate.action)
  const dropoffDistance = nearestDropoffDistance(unit, candidate)
  const rejected = isRejectedTarget(unit, job, candidate.target)
  let rejectedReason: string | null = null
  if (rejected) rejectedReason = 'recently-rejected'
  else if (!unit.getActionCondition?.(candidate.target, candidate.action)) rejectedReason = 'invalid-action'
  const route = rejectedReason
    ? null
    : yield* getCandidatePath(unit, candidate, getPassageLookup, Boolean(options.incremental))
  const pathLength = route?.length ?? null
  if (route?.stale) rejectedReason = 'target-moved'
  if (!rejectedReason && pathLength === null) {
    rejectedReason = 'no-contact-path'
    rejectTarget(unit, job, candidate.target)
  }

  const dropoffScore = Number.isFinite(dropoffDistance) ? dropoffDistance * DROPOFF_DISTANCE_SCORE : 0
  const score = (pathLength ?? distance(unit, candidate.target)) + workerLoad * WORKER_LOAD_SCORE + dropoffScore
  const observation = job === 'wood' ? knownTarget(unit.owner, candidate.target, unit) : undefined
  const readyWood = Boolean(
    observation?.type === RESOURCE_TYPES.tree && observation.hitPoints === 0 && (observation.quantity ?? 0) > 0
  )
  return {
    ...candidate,
    commit: route?.commit ?? (send => send()),
    valid: route?.valid ?? (() => false),
    readyWood,
    dropoffDistance,
    pathLength: pathLength ?? Infinity,
    rejectedReason,
    score,
    workerLoad,
  }
}

function* rankVillagerJobCandidates(
  unit: UnitEntity,
  job: VillagerAutonomyJob,
  candidates: VillagerJobCandidate[],
  options: CandidateScoringOptions
): Generator<void, CandidateEvaluation[], void> {
  const offset = candidateSearch(unit, job).offset
  let passageLookup: ReservedPassageCellLookup | undefined
  const getPassageLookup = () => (passageLookup ??= createReservedPassageCellLookup(unit.context))
  const ranked: CandidateEvaluation[] = []
  const batch = [...candidates]
    .sort((a, b) => distance(unit, a.target) - distance(unit, b.target))
    .slice(offset, offset + MAX_CANDIDATES_TO_PATH)
  for (const candidate of batch) {
    yield
    ranked.push(yield* evaluateCandidate(unit, job, candidate, options, getPassageLookup))
  }
  return ranked.sort((a, b) => Number(b.readyWood) - Number(a.readyWood) || a.score - b.score)
}

function wasAutonomyOrderAccepted(unit: UnitEntity, candidate: VillagerJobCandidate, result: unknown): boolean {
  if (result !== false && isPursuingRememberedTarget(unit, candidate.target, candidate.action)) return true
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

export function* planVillagerJobCandidates(
  unit: UnitEntity,
  job: VillagerAutonomyJob,
  candidates: VillagerJobCandidate[],
  options: CandidateScoringOptions
): Generator<void, boolean, void> {
  const search = candidateSearch(unit, job)
  const ranked = yield* rankVillagerJobCandidates(unit, job, candidates, options)
  for (const candidate of ranked) {
    if (candidate.rejectedReason) {
      continue
    }
    yield
    if (!unit.getActionCondition?.(candidate.target, candidate.action) || !candidate.valid()) continue
    const result = candidate.commit(() => candidate.send(candidate.target))
    if (wasAutonomyOrderAccepted(unit, candidate, result)) {
      search.offset = 0
      // Keep other failures until their TTL expires, even after accepting a new target.
      return true
    }

    markVillagerAutonomyTargetRejected(unit, candidate.target)
  }
  // Do not let the nearest unreachable deposits hide the rest of the map forever.
  search.offset = ranked.length === MAX_CANDIDATES_TO_PATH ? search.offset + MAX_CANDIDATES_TO_PATH : 0
  return false
}

/** @public Synchronous entry point for restoration and isolated callers without a live planner. */
export function tryVillagerJobCandidates(
  unit: UnitEntity,
  job: VillagerAutonomyJob,
  candidates: VillagerJobCandidate[],
  options: CandidateScoringOptions
): boolean {
  const plan = planVillagerJobCandidates(unit, job, candidates, options)
  let step = plan.next()
  while (!step.done) step = plan.next()
  return step.value
}
