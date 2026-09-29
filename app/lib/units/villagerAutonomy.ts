import { applyUnitActivitySpritesheets } from './unitSpriteAssets'
import { ANIMAL_CORPSE_DROPS } from '../../config/animalGatherLoot'
import { wakeUnitSimulation } from './unitSuspension'
import {
  knownResources,
  knownFoodTargets,
  knownConstructionTargets,
  knownCapturableHorses,
} from './autonomy/villagerKnownTargets'
import { cancelVillagerExplorationResume, scheduleVillagerExplorationResume } from './autonomy/villagerExploration'
import { ACTION_TYPES, FAMILY_TYPES, RESOURCE_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import { getNearestAvailableStableForUnit } from '../horses/horseCapture'
import { canMineIronResource } from '../resources/ironMining'
import { shouldVillagerWork } from './villagerSchedule'
import { hasPriorityCombat, villagerAutonomySuspension } from './autonomy/villagerAutonomyAvailability'

import { sendUnitToMiningAction } from './miningActions'
import {
  clearVillagerAutonomyTargetRejections,
  targetWorkerLoad,
  tryVillagerJobCandidates,
  type VillagerJobCandidate,
} from './villagerAutonomyTargeting'
import type { BuildingEntity, RuntimeEntity, UnitEntity, VillagerAutonomyJob } from '../../types/entities'

type AssignmentOptions = { exploreWhenNoTarget?: boolean; preserveRejectedTargets?: boolean }
type ResourceAutonomyJob = Exclude<VillagerAutonomyJob, 'food' | 'construction' | 'horseCapture'>

const RESOURCE_AUTONOMY_CONFIG: Record<ResourceAutonomyJob, { action: string; resourceType: string; work: string }> = {
  wood: { action: ACTION_TYPES.chopwood, resourceType: RESOURCE_TYPES.tree, work: WORK_TYPES.woodcutter },
  stone: { action: ACTION_TYPES.minestone, resourceType: RESOURCE_TYPES.stone, work: WORK_TYPES.stoneminer },
  gold: { action: ACTION_TYPES.minegold, resourceType: RESOURCE_TYPES.gold, work: WORK_TYPES.goldminer },
  copper: { action: ACTION_TYPES.minecopper, resourceType: RESOURCE_TYPES.copper, work: WORK_TYPES.goldminer },
  iron: { action: ACTION_TYPES.mineiron, resourceType: RESOURCE_TYPES.iron, work: WORK_TYPES.goldminer },
}

function distance(a: Pick<RuntimeEntity, 'i' | 'j'>, b: Pick<RuntimeEntity, 'i' | 'j'>): number {
  return Math.abs(a.i - b.i) + Math.abs(a.j - b.j)
}

function closest<T extends RuntimeEntity>(unit: UnitEntity, candidates: Iterable<T>): T | null {
  let best: T | null = null
  let bestDist = Infinity
  for (const candidate of candidates) {
    const dist = distance(unit, candidate)
    if (dist < bestDist) {
      best = candidate
      bestDist = dist
    }
  }
  return best
}

function markUnavailableWork(unit: UnitEntity, job: VillagerAutonomyJob): void {
  unit.autonomyBlockedJob = job
  unit.work = null
  applyUnitActivitySpritesheets(unit, null, null)
  unit.setTextures?.('standingSheet')
}

function exploreForAutonomy(unit: UnitEntity, job: VillagerAutonomyJob): boolean {
  const started = unit.explore?.() ?? false
  if (started) unit.autonomousJob = job
  else {
    setVillagerAutonomy(unit, job)
    unit.dest = null
    unit.path = []
    unit.action = null
    unit.inactif = true
    markUnavailableWork(unit, job)
    scheduleVillagerExplorationResume(unit, resumeVillagerAutonomy, 2000)
  }

  return started
}

function noStrictTargetForAutonomy(unit: UnitEntity, job: VillagerAutonomyJob, options: AssignmentOptions): boolean {
  if (!unit.owner?.isPlayed && options.exploreWhenNoTarget !== false) return exploreForAutonomy(unit, job)
  cancelVillagerExplorationResume(unit)
  unit.exploringForAutonomy = false
  setVillagerAutonomy(unit, job)
  unit.dest = null
  unit.path = []
  unit.action = null
  unit.inactif = true
  markUnavailableWork(unit, job)
  return false
}

export function hasVillagerAutonomyTarget(unit: UnitEntity, job: VillagerAutonomyJob): boolean {
  if (unit.type !== UNIT_TYPES.villager || unit.isDead || unit.isDestroyed) return false
  if (!canMineIronResource(unit, { type: job })) return false
  if (job === 'construction') return knownConstructionTargets(unit).length > 0
  if (job === 'food') return knownFoodTargets(unit, 1).length > 0
  if (job === 'horseCapture') {
    const horses = knownCapturableHorses(unit)
    return (
      horses.length > 0 &&
      horses.some(horse => Boolean(getNearestAvailableStableForUnit(unit, horse, { maxDistance: null })))
    )
  }

  return knownResources(unit, RESOURCE_AUTONOMY_CONFIG[job].resourceType, 1).length > 0
}

export function clearVillagerAutonomy(unit: UnitEntity): void {
  unit.collectiveTask = null
  if (unit.type !== UNIT_TYPES.villager) return
  if (unit.owner?.isPlayed) wakeUnitSimulation(unit)
  unit.autonomousJob = null
}

export function setVillagerAutonomy(unit: UnitEntity, job: VillagerAutonomyJob | null): void {
  if (unit.type !== UNIT_TYPES.villager) return
  if (unit.owner?.isPlayed) wakeUnitSimulation(unit)
  unit.autonomousJob = job
}

function foodCandidateFor(unit: UnitEntity, target: RuntimeEntity): VillagerJobCandidate {
  if (target.family === FAMILY_TYPES.animal) {
    return {
      action: target.isDead ? ACTION_TYPES.takemeat : ACTION_TYPES.hunt,
      send: candidate => (target.isDead ? unit.sendToTakeMeat?.(candidate, true) : unit.sendToHunt?.(candidate, true)),
      target,
      work: WORK_TYPES.hunter,
    }
  }
  if (target.type === RESOURCE_TYPES.wheat) {
    return {
      action: ACTION_TYPES.farm,
      send: candidate => unit.sendToFarm?.(candidate, true),
      target,
      work: WORK_TYPES.farmer,
    }
  }
  return {
    action: ACTION_TYPES.forageberry,
    send: candidate => unit.sendToBerrybush?.(candidate, true),
    target,
    work: WORK_TYPES.forager,
  }
}

type AutonomyScoring = { targetWorkerLoad(target: RuntimeEntity, work: string, action: string): number }

function assignFoodAutonomy(unit: UnitEntity, options: AssignmentOptions, scoring: AutonomyScoring): boolean {
  const job = 'food'
  const jobResource = unit.collectiveTask
  const plant =
    jobResource === 'fiber'
      ? RESOURCE_TYPES.fiberPlant
      : jobResource === 'herb'
        ? RESOURCE_TYPES.medicinalHerb
        : jobResource === 'toxicHerb'
          ? RESOURCE_TYPES.toxicHerb
          : undefined
  const targets = plant
    ? knownResources(unit, plant, 18)
    : knownFoodTargets(unit, 18).filter(target => {
        if (jobResource === 'wheat') return target.type === RESOURCE_TYPES.wheat
        if (jobResource === 'berry') return target.type === RESOURCE_TYPES.berrybush
        if (jobResource === 'meat') return target.family === FAMILY_TYPES.animal
        if (['leather', 'sinew', 'feather'].includes(jobResource ?? ''))
          return (
            target.family === FAMILY_TYPES.animal &&
            (target.isDead
              ? (('inventory' in target ? target.inventory?.resources : undefined)?.[
                  jobResource as 'leather' | 'sinew' | 'feather'
                ] ?? 0) > 0
              : (ANIMAL_CORPSE_DROPS[target.type] ?? []).some(drop => drop.resource === jobResource))
          )
        return true
      })
  if (!targets.length) return noStrictTargetForAutonomy(unit, job, options)
  if (
    tryVillagerJobCandidates(
      unit,
      job,
      targets.map(target => foodCandidateFor(unit, target)),
      scoring
    )
  )
    return true
  return noStrictTargetForAutonomy(unit, job, options)
}

function assignHorseAutonomy(unit: UnitEntity, options: AssignmentOptions, scoring: AutonomyScoring): boolean {
  const job = 'horseCapture'
  const target = closest(unit, knownCapturableHorses(unit))
  if (!target) return noStrictTargetForAutonomy(unit, job, options)
  if (!getNearestAvailableStableForUnit(unit, target)) return false
  return tryVillagerJobCandidates(
    unit,
    job,
    [
      {
        action: ACTION_TYPES.captureHorse,
        send: candidate => unit.sendToCaptureHorse?.(candidate, true),
        target,
        work: WORK_TYPES.horseCapture,
      },
    ],
    scoring
  )
}

function assignConstructionAutonomy(unit: UnitEntity, _options: AssignmentOptions, scoring: AutonomyScoring): boolean {
  const job = 'construction'
  const targets = knownConstructionTargets(unit)
  if (!targets.length) {
    return noStrictTargetForAutonomy(unit, job, { exploreWhenNoTarget: false })
  }
  const accepted = tryVillagerJobCandidates(
    unit,
    job,
    targets.map(target => ({
      action: ACTION_TYPES.build,
      send: (candidate: RuntimeEntity) => unit.sendToBuilding?.(candidate as BuildingEntity),
      target,
      work: WORK_TYPES.builder,
    })),
    scoring
  )
  if (accepted) return true
  return noStrictTargetForAutonomy(unit, job, { exploreWhenNoTarget: false })
}

function assignResourceAutonomy(
  unit: UnitEntity,
  job: ResourceAutonomyJob,
  options: AssignmentOptions,
  scoring: AutonomyScoring
): boolean {
  const resourceJob = job
  const resourceConfig = RESOURCE_AUTONOMY_CONFIG[resourceJob]
  const targets = knownResources(unit, resourceConfig.resourceType, 18)
  if (!targets.length) {
    return noStrictTargetForAutonomy(unit, job, options)
  }

  const candidates = targets.map(target => {
    if (resourceJob === 'wood') {
      return {
        action: resourceConfig.action,
        send: (candidate: RuntimeEntity) => unit.sendToTree?.(candidate, true),
        target,
        work: resourceConfig.work,
      }
    }
    return {
      action: resourceConfig.action,
      send: (candidate: RuntimeEntity) => sendUnitToMiningAction(unit, candidate, resourceConfig.action, true),
      target,
      work: resourceConfig.work,
    }
  })
  if (tryVillagerJobCandidates(unit, job, candidates, scoring)) {
    return true
  }

  return noStrictTargetForAutonomy(unit, job, options)
}

export function assignVillagerAutonomy(
  unit: UnitEntity,
  job: VillagerAutonomyJob,
  options: AssignmentOptions = {}
): boolean {
  if (unit.type !== UNIT_TYPES.villager || unit.isDead || unit.isDestroyed) return false
  if (hasPriorityCombat(unit) || !shouldVillagerWork(unit)) return false
  if (!canMineIronResource(unit, { type: job })) return false
  if (!options.preserveRejectedTargets) clearVillagerAutonomyTargetRejections(unit, job)
  unit.autonomyBlockedJob = null
  setVillagerAutonomy(unit, job)
  const scoring = {
    targetWorkerLoad: (target: RuntimeEntity, work: string, action: string) =>
      targetWorkerLoad(unit, target, work, action),
  }

  unit.assigningAutonomousJob = true
  try {
    if (job === 'food') return assignFoodAutonomy(unit, options, scoring)
    if (job === 'horseCapture') return assignHorseAutonomy(unit, options, scoring)
    if (job === 'construction') return assignConstructionAutonomy(unit, options, scoring)
    return assignResourceAutonomy(unit, job, options, scoring)
  } finally {
    unit.assigningAutonomousJob = false
  }
}

export function resumeVillagerAutonomy(unit: UnitEntity): boolean {
  if (!unit.autonomousJob || unit.type !== UNIT_TYPES.villager || villagerAutonomySuspension(unit)) {
    return false
  }
  return assignVillagerAutonomy(unit, unit.autonomousJob, { preserveRejectedTargets: true })
}
