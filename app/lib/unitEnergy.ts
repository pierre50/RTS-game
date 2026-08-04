import { ACTION_TYPES, SHEET_TYPES, STEP_TIME } from '../constants'
import { showFatigueFeedback } from './combatFeedback'
import { t } from './lang'
import { isHeroControlled } from './unitControl'
import type { RuntimeEntity, UnitEntity } from '../types/entities'

export const HERO_ENERGY_COLOR = '#2f8cff'
export const DEFAULT_UNIT_TOTAL_ENERGY = 10
export const DEFAULT_UNIT_ENERGY_REGEN_PER_SECOND = 2
export const DEFAULT_UNIT_ENERGY_REGEN_DELAY_MS = 650
export const NPC_ATTACK_RETREAT_DISTANCE = 96

const DEFAULT_ACTION_ENERGY_COST: Record<string, number> = {
  [ACTION_TYPES.attack]: 2,
  [ACTION_TYPES.hunt]: 2,
  [ACTION_TYPES.chopwood]: 2,
  [ACTION_TYPES.minestone]: 3,
  [ACTION_TYPES.minegold]: 3,
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

function notifyHeroEnergyChanged(unit: UnitEntity): void {
  const controls = unit.context?.controls
  if (controls?.heroUnit === unit) {
    unit.context?.menu?.updateHeroStatus?.(unit)
  }
}

export function ensureUnitEnergy(unit: UnitEntity): void {
  const total = unit.totalEnergy ?? DEFAULT_UNIT_TOTAL_ENERGY
  unit.totalEnergy = Math.max(0, total)
  unit.energyRegenRate = Math.max(0, unit.energyRegenRate ?? DEFAULT_UNIT_ENERGY_REGEN_PER_SECOND)
  unit.energyRegenDelay = Math.max(0, unit.energyRegenDelay ?? DEFAULT_UNIT_ENERGY_REGEN_DELAY_MS)
  unit.energyRegenMultiplier = Math.max(0, unit.energyRegenMultiplier ?? 1)
  if (unit.energy == null) unit.energy = unit.totalEnergy
  unit.energy = Math.max(0, Math.min(unit.energy, unit.totalEnergy))
}

export function getActionEnergyCost(unit: UnitEntity, action: string | null | undefined): number {
  if (!action) return 0
  ensureUnitEnergy(unit)
  const base = unit.energyCosts?.[action] ?? DEFAULT_ACTION_ENERGY_COST[action] ?? 0
  return Math.max(0, base)
}

export function hasEnergyForAction(unit: UnitEntity, action: string | null | undefined): boolean {
  const cost = getActionEnergyCost(unit, action)
  if (cost <= 0) return true
  return (unit.energy ?? 0) >= cost
}

export function spendEnergyForAction(unit: UnitEntity, action: string | null | undefined): boolean {
  const cost = getActionEnergyCost(unit, action)
  return spendEnergyAmount(unit, cost)
}

export function spendEnergyAmount(unit: UnitEntity, amount: number): boolean {
  const cost = Math.max(0, amount)
  if (cost <= 0) return true
  ensureUnitEnergy(unit)
  if ((unit.energy ?? 0) < cost) return false
  unit.energy = Math.max(0, (unit.energy ?? 0) - cost)
  unit.lastEnergySpentAt = unit.context?.scheduler?.elapsedMs ?? 0
  notifyHeroEnergyChanged(unit)
  return true
}

export function drainEnergyAmount(unit: UnitEntity, amount: number): boolean {
  const cost = Math.max(0, amount)
  if (cost <= 0) return true
  ensureUnitEnergy(unit)
  const current = unit.energy ?? 0
  unit.energy = Math.max(0, current - cost)
  unit.lastEnergySpentAt = unit.context?.scheduler?.elapsedMs ?? 0
  notifyHeroEnergyChanged(unit)
  return current >= cost
}

export function updateUnitEnergy(unit: UnitEntity, elapsedMs = STEP_TIME): void {
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

export function isUnitEnergyFull(unit: UnitEntity): boolean {
  ensureUnitEnergy(unit)
  return (unit.energy ?? 0) >= (unit.totalEnergy ?? 0)
}

function getEnergyWaitAction(unit: UnitEntity): string | null {
  return unit.waitingForEnergyAction ?? unit.action ?? null
}

function retreatFromTarget(unit: UnitEntity, target: RuntimeEntity): void {
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

export function waitForEnergy(unit: UnitEntity, action: string | null | undefined, target?: RuntimeEntity | null): false {
  ensureUnitEnergy(unit)
  if (isHeroControlled(unit)) {
    showFatigueFeedback(unit)
    unit.context?.menu?.showMessage(t('heroNotEnoughEnergy'), 'warning')
    unit.actionLocked = false
    return false
  }
  unit.waitingForEnergyAction = action ?? null
  unit.waitingForEnergyTarget = target ?? (unit.dest && 'family' in unit.dest ? unit.dest : null)
  showFatigueFeedback(unit)
  unit.stopInterval?.()
  unit.actionLocked = false
  if (!isHeroControlled(unit) && action === ACTION_TYPES.attack && unit.waitingForEnergyTarget) {
    retreatFromTarget(unit, unit.waitingForEnergyTarget)
    return false
  } else if (!isHeroControlled(unit)) {
    unit.setTextures?.(SHEET_TYPES.standing)
    unit.sprite?.stop?.()
  }
  unit.startInterval?.(() => {
    updateUnitEnergy(unit)
    if (!isUnitEnergyFull(unit)) return
    const resumeAction = getEnergyWaitAction(unit)
    const resumeTarget = unit.waitingForEnergyTarget
    unit.waitingForEnergyAction = null
    unit.waitingForEnergyTarget = null
    unit.stopInterval?.()
    if (resumeAction && resumeTarget && !resumeTarget.isDestroyed && !resumeTarget.isDead) {
      unit.sendToEvt?.(resumeTarget, resumeAction, { forceRepath: true })
    } else {
      unit.stop?.()
    }
  }, STEP_TIME, false, 'unit.energyWait')
  return false
}

export function resumeEnergyWaitIfReady(unit: UnitEntity): boolean {
  if (!unit.waitingForEnergyAction) return false
  updateUnitEnergy(unit)
  if (!isUnitEnergyFull(unit)) return false
  const resumeAction = unit.waitingForEnergyAction
  const resumeTarget = unit.waitingForEnergyTarget
  unit.waitingForEnergyAction = null
  unit.waitingForEnergyTarget = null
  if (resumeAction && resumeTarget && !resumeTarget.isDestroyed && !resumeTarget.isDead) {
    unit.sendToEvt?.(resumeTarget, resumeAction, { forceRepath: true })
  } else {
    unit.stop?.()
  }
  return true
}

export function spendOrWaitForEnergy(
  unit: UnitEntity,
  action: string | null | undefined,
  target?: RuntimeEntity | null
): boolean {
  if (spendEnergyForAction(unit, action)) return true
  return waitForEnergy(unit, action, target)
}
