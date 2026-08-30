import { ACTION_TYPES, FAMILY_TYPES, RESOURCE_TYPES, UNIT_TYPES, WORK_TYPES } from '../constants'
import { isWheatMature } from '../combat'
import { findInstancesInSight } from '../grid/visibility'
import { isVillagerSleepTime } from '../units/villagerSchedule'
import {
  sameTarget,
  targetWorkerLoad,
  tryVillagerJobCandidates,
  type VillagerJobCandidate,
} from '../units/villagerAutonomyTargeting'
import type { RuntimeEntity, UnitEntity, VillagerAutonomyJob } from '../../types/entities'

const FOLLOW_ASSIST_RANGE = 4

type FollowAssistPlan = {
  action: string
  candidates: VillagerJobCandidate[]
  job: VillagerAutonomyJob
}

function isRuntimeEntityDest(value: UnitEntity['dest'] | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

function cellDistance(a: Pick<RuntimeEntity, 'i' | 'j'>, b: Pick<RuntimeEntity, 'i' | 'j'>): number {
  return Math.hypot((a.i ?? 0) - (b.i ?? 0), (a.j ?? 0) - (b.j ?? 0))
}

function isAliveTarget(target: RuntimeEntity | null | undefined): target is RuntimeEntity {
  return Boolean(target && !target.isDead && !target.isDestroyed && (target.hitPoints ?? 1) > 0)
}

function isUsableResource(target: RuntimeEntity | null | undefined, type: string): target is RuntimeEntity {
  return Boolean(
    isAliveTarget(target) &&
      target.family === FAMILY_TYPES.resource &&
      target.type === type &&
      (target.quantity ?? 1) > 0
  )
}

function isUsableCarcass(target: RuntimeEntity | null | undefined): target is RuntimeEntity {
  return Boolean(
    target &&
      target.family === FAMILY_TYPES.animal &&
      target.isDead &&
      !target.isDestroyed &&
      (target.quantity ?? 0) > 0
  )
}

function isLiveAnimal(target: RuntimeEntity | null | undefined): target is RuntimeEntity {
  return Boolean(
    isAliveTarget(target) &&
      target.family === FAMILY_TYPES.animal &&
      target.type !== 'Horse'
  )
}

function isNearHero(hero: UnitEntity, target: RuntimeEntity): boolean {
  return cellDistance(hero, target) <= FOLLOW_ASSIST_RANGE
}

function targetsAroundHero(
  hero: UnitEntity,
  matches: (target: RuntimeEntity) => boolean,
  primaryTarget?: RuntimeEntity | null
): RuntimeEntity[] {
  const seen = new Set<string>()
  const targets: RuntimeEntity[] = []
  const add = (target: RuntimeEntity | null | undefined) => {
    if (!target || !isNearHero(hero, target) || !matches(target)) return
    const key = target.label || `${target.type}:${target.i}:${target.j}`
    if (seen.has(key)) return
    seen.add(key)
    targets.push(target)
  }

  add(primaryTarget)
  add(isRuntimeEntityDest(hero.dest) ? hero.dest : null)
  for (const target of findInstancesInSight<UnitEntity, RuntimeEntity>(hero, matches, FOLLOW_ASSIST_RANGE)) {
    add(target)
  }
  return targets
}

function getHeroHuntAssistTarget(hero: UnitEntity): RuntimeEntity | null {
  const intentTarget = hero.followAssistIntent?.action === ACTION_TYPES.hunt ? hero.followAssistIntent.target : null
  if (isLiveAnimal(intentTarget)) return intentTarget
  const actionTarget = hero.action === ACTION_TYPES.hunt && isRuntimeEntityDest(hero.dest) ? hero.dest : null
  return isLiveAnimal(actionTarget) ? actionTarget : null
}

function canHuntWithoutMoving(follower: UnitEntity, target: RuntimeEntity): boolean {
  return Boolean(
    follower.getActionCondition?.(target, ACTION_TYPES.hunt) &&
      follower.isUnitAtDest?.(ACTION_TYPES.hunt, target)
  )
}

function resourcePlan(
  hero: UnitEntity,
  follower: UnitEntity,
  action: string,
  type: string,
  work: string,
  job: VillagerAutonomyJob,
  send: (target: RuntimeEntity) => unknown,
  matches: (target: RuntimeEntity) => boolean = target => isUsableResource(target, type)
): FollowAssistPlan | null {
  if (hero.action !== action || follower.type !== UNIT_TYPES.villager) return null
  const candidates = targetsAroundHero(hero, matches).map(target => ({
    action,
    send,
    target,
    work,
  }))
  return candidates.length ? { action, candidates, job } : null
}

function getFollowAssistPlan(hero: UnitEntity, follower: UnitEntity): FollowAssistPlan | null {
  if (follower.type === UNIT_TYPES.villager && isVillagerSleepTime(follower.context ?? hero.context)) return null

  const wood = resourcePlan(
    hero,
    follower,
    ACTION_TYPES.chopwood,
    RESOURCE_TYPES.tree,
    WORK_TYPES.woodcutter,
    'wood',
    target => follower.sendToTree?.(target, true)
  )
  if (wood) return wood

  const berry = resourcePlan(
    hero,
    follower,
    ACTION_TYPES.forageberry,
    RESOURCE_TYPES.berrybush,
    WORK_TYPES.forager,
    'food',
    target => follower.sendToBerrybush?.(target, true)
  )
  if (berry) return berry

  const wheat = resourcePlan(
    hero,
    follower,
    ACTION_TYPES.farm,
    RESOURCE_TYPES.wheat,
    WORK_TYPES.farmer,
    'food',
    target => follower.sendToFarm(target, true),
    target =>
      isUsableResource(target, RESOURCE_TYPES.wheat) &&
      isWheatMature(target) &&
      targetWorkerLoad(follower, target, WORK_TYPES.farmer, ACTION_TYPES.farm) < 1
  )
  if (wheat) return wheat

  const huntTarget = getHeroHuntAssistTarget(hero)
  if (huntTarget && follower.type === UNIT_TYPES.villager) {
    const targets =
      hero.followAssistIntent?.target === huntTarget
        ? canHuntWithoutMoving(follower, huntTarget)
          ? [huntTarget]
          : []
        : targetsAroundHero(hero, isLiveAnimal, huntTarget)
    const candidates = targets.map(target => ({
      action: ACTION_TYPES.hunt,
      send: (candidate: RuntimeEntity) => follower.sendToHunt(candidate, true),
      target,
      work: WORK_TYPES.hunter,
    }))
    if (candidates.length) return { action: ACTION_TYPES.hunt, candidates, job: 'food' }
  }

  if (hero.action === ACTION_TYPES.takemeat && follower.type === UNIT_TYPES.villager) {
    const candidates = targetsAroundHero(hero, isUsableCarcass).map(target => ({
      action: ACTION_TYPES.takemeat,
      send: (candidate: RuntimeEntity) => follower.sendToTakeMeat(candidate, true),
      target,
      work: WORK_TYPES.hunter,
    }))
    if (candidates.length) return { action: ACTION_TYPES.takemeat, candidates, job: 'food' }
  }

  return null
}

function clearFollowAssist(follower: UnitEntity): void {
  if (!follower.followAssist) return
  follower.followAssist = null
  if (follower.action) follower.stop?.()
}

function acceptFollowAssist(follower: UnitEntity, plan: FollowAssistPlan): boolean {
  const scoring = {
    targetWorkerLoad: (target: RuntimeEntity, work: string, action: string) =>
      targetWorkerLoad(follower, target, work, action),
  }
  if (!tryVillagerJobCandidates(follower, plan.job, plan.candidates, scoring)) return false
  const target = isRuntimeEntityDest(follower.dest) ? follower.dest : null
  follower.autonomousJob = null
  follower.followAssist = {
    action: plan.action,
    targetLabel: target?.label,
  }
  return true
}

function tryAttackAssist(hero: UnitEntity, follower: UnitEntity): boolean {
  if (hero.action !== ACTION_TYPES.attack) return false
  const target = isRuntimeEntityDest(hero.dest) ? hero.dest : null
  if (!isAliveTarget(target)) return false
  if (!follower.getActionCondition?.(target, ACTION_TYPES.attack)) return false
  if (sameTarget(follower.dest as RuntimeEntity | null | undefined, target) && follower.action === ACTION_TYPES.attack) {
    follower.followAssist = { action: ACTION_TYPES.attack, targetLabel: target.label }
    return true
  }
  follower.sendToAttack(target)
  if (!sameTarget(follower.dest as RuntimeEntity | null | undefined, target) || follower.action !== ACTION_TYPES.attack) {
    return false
  }
  follower.followAssist = { action: ACTION_TYPES.attack, targetLabel: target.label }
  return true
}

export function tryFollowAssistHero(hero: UnitEntity, follower: UnitEntity): boolean {
  const plan = getFollowAssistPlan(hero, follower)
  if (!plan && hero.action !== ACTION_TYPES.attack) {
    clearFollowAssist(follower)
    return false
  }
  if (plan) return acceptFollowAssist(follower, plan)
  if (tryAttackAssist(hero, follower)) return true
  clearFollowAssist(follower)
  return false
}
