import { ACTION_TYPES, MINING_RESOURCE_CONFIG, SHEET_TYPES, STEP_TIME } from '../constants'
import { showFatigueFeedback } from './combatFeedback'
import { t } from './lang'
import { isHeroControlled } from './unitControl'
import type { EnergyEntity, RuntimeEntity, UnitEntity } from '../types/entities'

export const HERO_ENERGY_COLOR = '#2f8cff'
export const DEFAULT_UNIT_TOTAL_ENERGY = 10
export const DEFAULT_UNIT_ENERGY_REGEN_PER_SECOND = 2
export const DEFAULT_UNIT_ENERGY_REGEN_DELAY_MS = 650
export const NPC_ATTACK_RETREAT_DISTANCE = 96
export const LOW_ENERGY_MOVE_PENALTY_THRESHOLD = 0.5
export const LOW_ENERGY_MOVE_MIN_MULTIPLIER = 0.55

function getMiningActions(): string[] {
  const configured = Object.values(MINING_RESOURCE_CONFIG ?? {})
    .map(config => config.action)
    .filter((action): action is string => Boolean(action))
  if (configured.length) return configured
  return [ACTION_TYPES.minestone, ACTION_TYPES.minegold].filter((action): action is string => Boolean(action))
}

const DEFAULT_ACTION_ENERGY_COST: Record<string, number> = {
  [ACTION_TYPES.attack]: 2,
  [ACTION_TYPES.flee]: 0.25,
  flee: 0.25,
  [ACTION_TYPES.hunt]: 2,
  [ACTION_TYPES.chopwood]: 2,
  ...Object.fromEntries(getMiningActions().map(action => [action, 3])),
  [ACTION_TYPES.build]: 2,
  [ACTION_TYPES.forageberry]: 0.75,
  [ACTION_TYPES.farm]: 1,
  [ACTION_TYPES.takemeat]: 0.5,
  [ACTION_TYPES.heal]: 1.5,
  [ACTION_TYPES.convert]: 2,
  heroBowCharge: 2,
  heroDefense: 2,
  heroWhiff: 0.75,
}

function notifyHeroEnergyChanged(unit: EnergyEntity): void {
  const controls = unit.context?.controls
  if (controls?.heroUnit === unit) {
    unit.context?.menu?.updateHeroStatus?.(unit as UnitEntity)
  }
}

export function ensureUnitEnergy(unit: EnergyEntity): void {
  const total = unit.totalEnergy ?? DEFAULT_UNIT_TOTAL_ENERGY
  unit.totalEnergy = Math.max(0, total)
  unit.energyRegenRate = Math.max(0, unit.energyRegenRate ?? DEFAULT_UNIT_ENERGY_REGEN_PER_SECOND)
  unit.energyRegenDelay = Math.max(0, unit.energyRegenDelay ?? DEFAULT_UNIT_ENERGY_REGEN_DELAY_MS)
  unit.energyRegenMultiplier = Math.max(0, unit.energyRegenMultiplier ?? 1)
  if (unit.energy == null) unit.energy = unit.totalEnergy
  unit.energy = Math.max(0, Math.min(unit.energy, unit.totalEnergy))
}

export function getActionEnergyCost(unit: EnergyEntity, action: string | null | undefined): number {
  if (!action) return 0
  ensureUnitEnergy(unit)
  const base = unit.energyCosts?.[action] ?? DEFAULT_ACTION_ENERGY_COST[action] ?? 0
  return Math.max(0, base)
}

export function hasEnergyForAction(unit: EnergyEntity, action: string | null | undefined): boolean {
  const cost = getActionEnergyCost(unit, action)
  if (cost <= 0) return true
  return (unit.energy ?? 0) >= cost
}

export function spendEnergyForAction(unit: EnergyEntity, action: string | null | undefined): boolean {
  const cost = getActionEnergyCost(unit, action)
  return spendEnergyAmount(unit, cost)
}

export function spendEnergyAmount(unit: EnergyEntity, amount: number): boolean {
  const cost = Math.max(0, amount)
  if (cost <= 0) return true
  ensureUnitEnergy(unit)
  if ((unit.energy ?? 0) < cost) return false
  unit.energy = Math.max(0, (unit.energy ?? 0) - cost)
  unit.lastEnergySpentAt = unit.context?.scheduler?.elapsedMs ?? 0
  notifyHeroEnergyChanged(unit)
  return true
}

export function drainEnergyAmount(unit: EnergyEntity, amount: number): boolean {
  const cost = Math.max(0, amount)
  if (cost <= 0) return true
  ensureUnitEnergy(unit)
  const current = unit.energy ?? 0
  unit.energy = Math.max(0, current - cost)
  unit.lastEnergySpentAt = unit.context?.scheduler?.elapsedMs ?? 0
  notifyHeroEnergyChanged(unit)
  return current >= cost
}

export function updateUnitEnergy(unit: EnergyEntity, elapsedMs = STEP_TIME): void {
  ensureUnitEnergy(unit)
  if ((unit.energy ?? 0) >= (unit.totalEnergy ?? 0)) {
    const previousEnergy = unit.energy
    unit.energy = unit.totalEnergy
    if (unit.energy !== previousEnergy) notifyHeroEnergyChanged(unit)
    return
  }
  const now = unit.context?.scheduler?.elapsedMs ?? 0
  const spentAt = unit.lastEnergySpentAt ?? -Infinity
  if (now - spentAt < (unit.energyRegenDelay ?? 0)) return
  const regenPerMs = ((unit.energyRegenRate ?? 0) * (unit.energyRegenMultiplier ?? 1)) / 1000
  const previousEnergy = unit.energy ?? 0
  unit.energy = Math.min(unit.totalEnergy ?? 0, previousEnergy + regenPerMs * elapsedMs)
  if (unit.energy !== previousEnergy) notifyHeroEnergyChanged(unit)
}

export function isUnitEnergyFull(unit: EnergyEntity): boolean {
  ensureUnitEnergy(unit)
  return (unit.energy ?? 0) >= (unit.totalEnergy ?? 0)
}

export function getEnergyMoveSpeedMultiplier(unit: EnergyEntity): number {
  if (unit.mountedOnHorse) return 1
  const totalEnergy = unit.totalEnergy ?? 0
  if (totalEnergy <= 0 || unit.energy == null) return 1
  const energyRatio = Math.max(0, Math.min(1, unit.energy / totalEnergy))
  if (energyRatio >= LOW_ENERGY_MOVE_PENALTY_THRESHOLD) return 1
  const fatigueRatio = energyRatio / LOW_ENERGY_MOVE_PENALTY_THRESHOLD
  return LOW_ENERGY_MOVE_MIN_MULTIPLIER + (1 - LOW_ENERGY_MOVE_MIN_MULTIPLIER) * fatigueRatio
}

function getEnergyWaitAction(unit: EnergyEntity): string | null {
  return unit.waitingForEnergyAction ?? unit.action ?? null
}

function clearEnergyWaitTask(unit: EnergyEntity): void {
  const taskId = unit.energyWaitTaskId
  if (taskId == null) return
  unit.context?.scheduler?.remove?.(taskId)
  unit.energyWaitTaskId = null
}

function resumeWaitedEnergyAction(unit: EnergyEntity): void {
  const resumeAction = getEnergyWaitAction(unit)
  const resumeTarget = unit.waitingForEnergyTarget
  unit.waitingForEnergyAction = null
  unit.waitingForEnergyTarget = null
  clearEnergyWaitTask(unit)
  unit.stopInterval?.()
  if (resumeAction && resumeTarget && !resumeTarget.isDestroyed && !resumeTarget.isDead) {
    if (unit.sendToEvt) {
      unit.sendToEvt(resumeTarget, resumeAction, { forceRepath: true })
    } else {
      unit.sendTo?.(resumeTarget, resumeAction, { forceRepath: true })
    }
  } else {
    unit.stop?.()
  }
}

function startEnergyWaitInterval(unit: EnergyEntity): void {
  unit.startInterval?.(() => {
    updateUnitEnergy(unit)
    if (!isUnitEnergyFull(unit)) return
    resumeWaitedEnergyAction(unit)
  }, STEP_TIME, false, 'unit.energyWait')
}

function startEnergyWaitTask(unit: EnergyEntity): void {
  clearEnergyWaitTask(unit)
  const scheduler = unit.context?.scheduler
  if (!scheduler?.add) {
    startEnergyWaitInterval(unit)
    return
  }
  unit.energyWaitTaskId = scheduler.add(() => {
    if (!unit.waitingForEnergyAction) {
      clearEnergyWaitTask(unit)
      return
    }
    updateUnitEnergy(unit)
    if (!isUnitEnergyFull(unit)) return
    resumeWaitedEnergyAction(unit)
  }, STEP_TIME, 'unit.energyWait')
}

function retreatFromTarget(unit: EnergyEntity, target: RuntimeEntity): void {
  const map = unit.context?.map
  if (!map) return
  const dx = unit.x - target.x
  const dy = unit.y - target.y
  const len = Math.hypot(dx, dy) || 1
  const destination = {
    x: unit.x + (dx / len) * NPC_ATTACK_RETREAT_DISTANCE,
    y: unit.y + (dy / len) * NPC_ATTACK_RETREAT_DISTANCE,
  }
  const cell = map.grid
    .flat()
    .filter(candidate => !candidate.solid && !candidate.border)
    .sort(
      (a, b) =>
        Math.hypot(a.x - destination.x, a.y - destination.y) - Math.hypot(b.x - destination.x, b.y - destination.y)
    )[0]
  if (cell && !cell.solid && !cell.border) unit.sendTo?.(cell)
}

export function waitForEnergy(unit: EnergyEntity, action: string | null | undefined, target?: RuntimeEntity | null): false {
  ensureUnitEnergy(unit)
  const heroControlled = isHeroControlled(unit as UnitEntity)
  if (heroControlled) {
    showFatigueFeedback(unit as UnitEntity)
    unit.context?.menu?.showMessage(t('heroNotEnoughEnergy'), 'warning')
    unit.actionLocked = false
    return false
  }
  unit.waitingForEnergyAction = action ?? null
  unit.waitingForEnergyTarget = target ?? (unit.dest && 'family' in unit.dest ? unit.dest : null)
  clearEnergyWaitTask(unit)
  showFatigueFeedback(unit as UnitEntity)
  unit.stopInterval?.()
  unit.actionLocked = false
  if (!heroControlled && action === ACTION_TYPES.attack && unit.waitingForEnergyTarget) {
    retreatFromTarget(unit, unit.waitingForEnergyTarget)
    startEnergyWaitTask(unit)
    return false
  } else if (!heroControlled) {
    unit.setTextures?.(SHEET_TYPES.standing)
    if (unit.sprite && 'stop' in unit.sprite) unit.sprite.stop()
  }
  startEnergyWaitInterval(unit)
  return false
}

export function resumeEnergyWaitIfReady(unit: EnergyEntity): boolean {
  if (!unit.waitingForEnergyAction) return false
  updateUnitEnergy(unit)
  if (!isUnitEnergyFull(unit)) return false
  resumeWaitedEnergyAction(unit)
  return true
}

export function spendOrWaitForEnergy(
  unit: EnergyEntity,
  action: string | null | undefined,
  target?: RuntimeEntity | null
): boolean {
  if (spendEnergyForAction(unit, action)) return true
  return waitForEnergy(unit, action, target)
}
