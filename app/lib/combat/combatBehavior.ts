import { ACTION_TYPES, CELL_HEIGHT, CELL_WIDTH, SHEET_TYPES } from '../constants'
import { getCellsAroundPoint, getInstancePath } from '../grid'
import type { CombatBehaviorConfig, CombatRecoveryMode } from '../../types/config'
import type { EnergyEntity, RuntimeEntity } from '../../types/entities'
import type { RuntimeCell, RuntimeMap } from '../../types/map'

const CELL_WORLD_DISTANCE = Math.hypot(CELL_WIDTH, CELL_HEIGHT)

const DEFAULT_COMBAT_BEHAVIOR: Required<
  Pick<
    CombatBehaviorConfig,
    | 'recoveryMode'
    | 'reengageEnergyRatio'
    | 'recoveryMinDistance'
    | 'recoveryMaxDistance'
    | 'recoveryStrafeDistance'
    | 'recoveryRepositionMs'
    | 'recoverySearchRadius'
    | 'fleeHealthRatio'
    | 'aggression'
    | 'bravery'
  >
> = {
  recoveryMode: 'orbit',
  reengageEnergyRatio: 1,
  recoveryMinDistance: 1.1,
  recoveryMaxDistance: 2.7,
  recoveryStrafeDistance: 1,
  recoveryRepositionMs: 750,
  recoverySearchRadius: 5,
  fleeHealthRatio: 0.3,
  aggression: 0.5,
  bravery: 0.35,
}

const COMBAT_BEHAVIOR_PRESETS: Record<string, CombatBehaviorConfig> = {
  animalAggressive: {
    recoveryMode: 'orbit',
    reengageEnergyRatio: 1,
    recoveryMinDistance: 1.25,
    recoveryMaxDistance: 3,
    recoveryStrafeDistance: 1,
    recoveryRepositionMs: 650,
    recoverySearchRadius: 5,
    fleeHealthRatio: 0.25,
    aggression: 0.85,
    bravery: 0.55,
  },
  meleeAggressive: {
    recoveryMode: 'orbit',
    reengageEnergyRatio: 0.9,
    recoveryMinDistance: 1.1,
    recoveryMaxDistance: 2.4,
    recoveryStrafeDistance: 0.75,
    recoveryRepositionMs: 750,
    recoverySearchRadius: 4,
    fleeHealthRatio: 0.22,
    aggression: 0.8,
    bravery: 0.7,
  },
  meleeDisciplined: {
    recoveryMode: 'retreat',
    reengageEnergyRatio: 0.85,
    recoveryMinDistance: 1.4,
    recoveryMaxDistance: 2.8,
    recoveryStrafeDistance: 0.35,
    recoveryRepositionMs: 900,
    recoverySearchRadius: 4,
    fleeHealthRatio: 0.18,
    aggression: 0.65,
    bravery: 0.85,
  },
  rangedKite: {
    recoveryMode: 'retreat',
    reengageEnergyRatio: 0.75,
    recoveryMinDistance: 3,
    recoveryMaxDistance: 5,
    recoveryStrafeDistance: 1.25,
    recoveryRepositionMs: 700,
    recoverySearchRadius: 7,
    fleeHealthRatio: 0.25,
    aggression: 0.55,
    bravery: 0.6,
  },
}

export type ResolvedCombatBehavior = typeof DEFAULT_COMBAT_BEHAVIOR

type CombatBehaviorSource = {
  combatBehavior?: CombatBehaviorConfig
  combatBehaviorPreset?: string
}

type CombatMoraleSource = CombatBehaviorSource & {
  combatMoraleRoll?: number
  label?: string
  type?: string
}

type RecoveryCandidate = {
  cell: RuntimeCell
  path: RuntimeCell[]
  score: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readRecoveryMode(value: unknown, fallback: CombatRecoveryMode): CombatRecoveryMode {
  return value === 'hold' || value === 'orbit' || value === 'retreat' ? value : fallback
}

export function getCombatBehavior(unit: CombatBehaviorSource): ResolvedCombatBehavior {
  const preset = unit.combatBehaviorPreset ? COMBAT_BEHAVIOR_PRESETS[unit.combatBehaviorPreset] : undefined
  const configured = { ...(preset ?? {}), ...(unit.combatBehavior ?? {}) }
  const minDistance = Math.max(
    0.25,
    readNumber(configured.recoveryMinDistance, DEFAULT_COMBAT_BEHAVIOR.recoveryMinDistance)
  )
  const maxDistance = Math.max(
    minDistance + 0.25,
    readNumber(configured.recoveryMaxDistance, DEFAULT_COMBAT_BEHAVIOR.recoveryMaxDistance)
  )
  return {
    recoveryMode: readRecoveryMode(configured.recoveryMode, DEFAULT_COMBAT_BEHAVIOR.recoveryMode),
    reengageEnergyRatio: clamp(
      readNumber(configured.reengageEnergyRatio, DEFAULT_COMBAT_BEHAVIOR.reengageEnergyRatio),
      0.05,
      1
    ),
    recoveryMinDistance: minDistance,
    recoveryMaxDistance: maxDistance,
    recoveryStrafeDistance: Math.max(
      0,
      readNumber(configured.recoveryStrafeDistance, DEFAULT_COMBAT_BEHAVIOR.recoveryStrafeDistance)
    ),
    recoveryRepositionMs: Math.max(
      100,
      readNumber(configured.recoveryRepositionMs, DEFAULT_COMBAT_BEHAVIOR.recoveryRepositionMs)
    ),
    recoverySearchRadius: Math.max(
      Math.ceil(maxDistance + 1),
      Math.ceil(readNumber(configured.recoverySearchRadius, DEFAULT_COMBAT_BEHAVIOR.recoverySearchRadius))
    ),
    fleeHealthRatio: clamp(readNumber(configured.fleeHealthRatio, DEFAULT_COMBAT_BEHAVIOR.fleeHealthRatio), 0, 1),
    aggression: clamp(readNumber(configured.aggression, DEFAULT_COMBAT_BEHAVIOR.aggression), 0, 1),
    bravery: clamp(readNumber(configured.bravery, DEFAULT_COMBAT_BEHAVIOR.bravery), 0, 1),
  }
}

function hashToUnitInterval(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 0xffffffff
}

export function getCombatMoraleRoll(unit: CombatMoraleSource): number {
  if (typeof unit.combatMoraleRoll === 'number' && Number.isFinite(unit.combatMoraleRoll)) {
    return clamp(unit.combatMoraleRoll, 0, 1)
  }
  if (!unit.label) return 1
  return hashToUnitInterval(`${unit.type ?? 'unit'}:${unit.label}`)
}

function getNowMs(unit: EnergyEntity): number {
  const schedulerNow = unit.context?.scheduler?.elapsedMs
  if (typeof schedulerNow === 'number') return schedulerNow
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function getOrbitDirection(unit: EnergyEntity): 1 | -1 {
  if (unit.combatRecoveryOrbitDirection === 1 || unit.combatRecoveryOrbitDirection === -1) {
    return unit.combatRecoveryOrbitDirection
  }
  const seed = `${unit.label ?? ''}${unit.type ?? ''}`
    .split('')
    .reduce((total, char) => total + char.charCodeAt(0), 0)
  unit.combatRecoveryOrbitDirection = seed % 2 === 0 ? 1 : -1
  return unit.combatRecoveryOrbitDirection
}

function isOpenRecoveryCell(unit: EnergyEntity, cell: RuntimeCell | null | undefined): cell is RuntimeCell {
  const occupiedBySelf = Boolean(cell?.has && cell.has.label === unit.label)
  if (
    !cell ||
    (cell.solid && !occupiedBySelf) ||
    (cell.border && (!cell.waterBorder || cell.solid)) ||
    cell.category === 'Water'
  ) {
    return false
  }
  return cell.i !== unit.i || cell.j !== unit.j
}

function getRecoveryVector(unit: EnergyEntity, target: RuntimeEntity): { x: number; y: number } {
  let dx = unit.x - target.x
  let dy = unit.y - target.y
  let len = Math.hypot(dx, dy)
  if (!len) {
    dx = unit.i - target.i
    dy = unit.j - target.j
    len = Math.hypot(dx, dy)
  }
  if (!len) {
    dx = 1
    dy = 0
    len = 1
  }
  return { x: dx / len, y: dy / len }
}

function getDesiredRecoveryPoint(
  unit: EnergyEntity,
  target: RuntimeEntity,
  behavior: ResolvedCombatBehavior
): { x: number; y: number; distanceCells: number } {
  const radial = getRecoveryVector(unit, target)
  const direction = getOrbitDirection(unit)
  const tangent = behavior.recoveryMode === 'orbit' ? { x: -radial.y * direction, y: radial.x * direction } : { x: 0, y: 0 }
  const currentDistanceCells = Math.hypot(unit.x - target.x, unit.y - target.y) / CELL_WORLD_DISTANCE
  const targetDistanceCells =
    behavior.recoveryMode === 'retreat'
      ? behavior.recoveryMaxDistance
      : clamp(currentDistanceCells + 0.65, behavior.recoveryMinDistance, behavior.recoveryMaxDistance)

  return {
    x:
      target.x +
      radial.x * targetDistanceCells * CELL_WORLD_DISTANCE +
      tangent.x * behavior.recoveryStrafeDistance * CELL_WORLD_DISTANCE,
    y:
      target.y +
      radial.y * targetDistanceCells * CELL_WORLD_DISTANCE +
      tangent.y * behavior.recoveryStrafeDistance * CELL_WORLD_DISTANCE,
    distanceCells: targetDistanceCells,
  }
}

function scoreRecoveryCell(
  unit: EnergyEntity,
  target: RuntimeEntity,
  cell: RuntimeCell,
  path: RuntimeCell[],
  behavior: ResolvedCombatBehavior,
  desired: { x: number; y: number; distanceCells: number }
): number {
  const targetDistanceCells = Math.hypot(cell.i - target.i, cell.j - target.j)
  const tooClosePenalty =
    targetDistanceCells < behavior.recoveryMinDistance
      ? (behavior.recoveryMinDistance - targetDistanceCells) * 8
      : 0
  const tooFarPenalty =
    targetDistanceCells > behavior.recoveryMaxDistance
      ? (targetDistanceCells - behavior.recoveryMaxDistance) * 4
      : 0
  const desiredPenalty = Math.hypot(cell.x - desired.x, cell.y - desired.y) / CELL_WORLD_DISTANCE
  const bandPenalty = Math.abs(targetDistanceCells - desired.distanceCells) * 0.65
  const pathPenalty = path.length * 0.12
  const stillnessPenalty = cell.i === unit.i && cell.j === unit.j ? 10 : 0
  return desiredPenalty + bandPenalty + pathPenalty + tooClosePenalty + tooFarPenalty + stillnessPenalty
}

function findCombatRecoveryCell(
  unit: EnergyEntity,
  target: RuntimeEntity,
  behavior: ResolvedCombatBehavior
): RecoveryCandidate | null {
  const map = unit.context?.map as RuntimeMap | undefined
  if (!map) return null
  const desired = getDesiredRecoveryPoint(unit, target, behavior)
  const candidates = getCellsAroundPoint(target.i, target.j, map.grid, behavior.recoverySearchRadius, cell =>
    isOpenRecoveryCell(unit, cell)
  )

  let best: RecoveryCandidate | null = null
  for (const cell of candidates) {
    const targetDistanceCells = Math.hypot(cell.i - target.i, cell.j - target.j)
    if (targetDistanceCells < behavior.recoveryMinDistance * 0.65) continue
    if (targetDistanceCells > behavior.recoveryMaxDistance + 1.5) continue
    const path = getInstancePath<RuntimeCell>(unit, cell.i, cell.j, map)
    if (!path.length) continue
    const score = scoreRecoveryCell(unit, target, cell, path, behavior, desired)
    if (!best || score < best.score) best = { cell, path, score }
  }
  return best
}

function stopRecoveryVisuals(unit: EnergyEntity): void {
  unit.action = null
  unit.setTextures?.(SHEET_TYPES.standing)
  if (unit.sprite && 'stop' in unit.sprite) unit.sprite.stop()
}

export function enterCombatRecovery(unit: EnergyEntity, target: RuntimeEntity): void {
  unit.combatMode = 'recover'
  unit.actionLocked = false
  unit.lastCombatRecoveryMoveAt = null
  stopRecoveryVisuals(unit)
  updateCombatRecoveryMovement(unit, target, true)
}

export function shouldSuppressAggroDuringCombatRecovery(unit: EnergyEntity): boolean {
  return unit.combatMode === 'recover' && unit.waitingForEnergyAction === ACTION_TYPES.attack
}

export function updateCombatRecoveryMovement(
  unit: EnergyEntity,
  explicitTarget?: RuntimeEntity | null,
  force = false
): boolean {
  if (unit.combatMode !== 'recover') return false
  const target = explicitTarget ?? unit.waitingForEnergyTarget
  if (!target || target.isDead || target.isDestroyed) return false

  const behavior = getCombatBehavior(unit)
  if (behavior.recoveryMode === 'hold') {
    stopRecoveryVisuals(unit)
    return false
  }
  if (!force && (unit.path?.length ?? 0) > 0) return false

  const now = getNowMs(unit)
  if (!force && now - (unit.lastCombatRecoveryMoveAt ?? -Infinity) < behavior.recoveryRepositionMs) return false

  const candidate = findCombatRecoveryCell(unit, target, behavior)
  if (!candidate) {
    stopRecoveryVisuals(unit)
    return false
  }

  unit.combatMode = 'recover'
  unit.action = null
  unit.lastCombatRecoveryMoveAt = now
  unit.sendTo?.(candidate.cell)
  return true
}

export function isCombatRecoveryReadyToReengage(unit: EnergyEntity): boolean {
  const totalEnergy = unit.totalEnergy ?? 0
  if (totalEnergy <= 0) return true
  const behavior = getCombatBehavior(unit)
  return (unit.energy ?? 0) / totalEnergy >= behavior.reengageEnergyRatio
}

export function exitCombatRecovery(unit: EnergyEntity): void {
  if (unit.combatMode === 'recover') unit.combatMode = null
  unit.lastCombatRecoveryMoveAt = null
}

export function markCombatFlee(unit: EnergyEntity): void {
  unit.combatMode = 'flee'
  unit.lastCombatRecoveryMoveAt = null
  unit.waitingForEnergyAction = null
  unit.waitingForEnergyTarget = null
  if (unit.energyWaitTaskId != null) {
    unit.context?.scheduler?.remove?.(unit.energyWaitTaskId)
    unit.energyWaitTaskId = null
  }
}

export function markCombatAttack(unit: EnergyEntity): void {
  if (unit.action === ACTION_TYPES.attack) unit.combatMode = 'attack'
}
