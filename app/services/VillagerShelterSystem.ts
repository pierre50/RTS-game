import { BUILDING_TYPES, FADE_DURATION_MS, SHEET_TYPES, UNIT_TYPES } from '../constants'
import {
  cartesianToIsometric,
  getFreeLandCellAroundInstance,
  getGroundReliefLevel,
  getInstanceZIndex,
  resumeVillagerAutonomy,
  updateInstanceVisibility,
} from '../lib'
import { cancelFade, fadeIn, fadeOut } from '../lib/entityFade'
import { clearUnitOverheadIndicator, setUnitOverheadIndicator } from '../lib/overheadIndicator'
import { isHeroControlled } from '../lib/unitControl'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type {
  BuildingEntity,
  RuntimeEntity,
  UnitEntity,
  VillagerShelterReason,
  VillagerShelterState,
} from '../types/entities'
import type { RuntimeCell, RuntimeMap } from '../types/map'

const SHELTER_CHECK_INTERVAL_MS = 1000
const SLEEP_START_HOUR = 22
const WAKE_HOUR = 6
const DANGER_SHELTER_MIN_MS = 8000
const CRITICAL_SHELTER_HITPOINT_RATIO = 0.25
const SHELTER_ORDER_GRACE_MS = 2500
const SHELTER_MAX_RETRIES = 3
const SHELTER_TYPES = new Set<string>([BUILDING_TYPES.house, BUILDING_TYPES.townCenter])

type RuntimeMapWithBuckets = RuntimeMap & {
  addChild?: (child: UnitEntity) => void
  removeFromInstanceBucket?: (entity: RuntimeEntity) => void
  addToInstanceBucket?: (entity: RuntimeEntity) => void
  updateInstanceBucket?: (entity: RuntimeEntity, oldI: number, oldJ: number) => void
}

type TimedVillagerShelterState = VillagerShelterState & { hiddenAt?: number }
type UnitWithDetachedShadows = UnitEntity & {
  horseShadow?: { visible?: boolean } | null
  syncShadow?: () => void
}

function distance(a: Pick<RuntimeEntity, 'i' | 'j'>, b: Pick<RuntimeEntity, 'i' | 'j'>): number {
  return Math.abs(a.i - b.i) + Math.abs(a.j - b.j)
}

function hitPointRatio(entity: Pick<RuntimeEntity, 'hitPoints' | 'totalHitPoints'>): number {
  const total = entity.totalHitPoints ?? 0
  if (total <= 0) return 1
  return Math.max(0, Math.min(1, (entity.hitPoints ?? total) / total))
}

function isSleepTime(context: GameContextLike): boolean {
  const hour = context.dayNight?.state?.hour ?? 12
  return hour >= SLEEP_START_HOUR || hour < WAKE_HOUR
}

function isWakeTime(context: GameContextLike): boolean {
  return !isSleepTime(context)
}

function isUsableShelter(building: BuildingEntity | null | undefined, owner: UnitEntity['owner']): building is BuildingEntity {
  return Boolean(
    building &&
      building.owner === owner &&
      SHELTER_TYPES.has(building.type) &&
      building.isBuilt &&
      !building.isDead &&
      !building.isDestroyed
  )
}

function isShelterUnsafe(building: BuildingEntity | null | undefined): boolean {
  return Boolean(
    !building ||
      !isUsableShelter(building, building.owner) ||
      hitPointRatio(building) <= CRITICAL_SHELTER_HITPOINT_RATIO
  )
}

function getShelterEntryCell(unit: UnitEntity, shelter: BuildingEntity): RuntimeCell | null {
  const map = unit.context?.map
  if (!map) return null
  return getFreeLandCellAroundInstance(shelter, map.grid, (items: RuntimeCell[]) => {
    let best: RuntimeCell | null = null
    let bestDistance = Infinity
    for (const cell of items) {
      const dist = Math.abs(cell.i - unit.i) + Math.abs(cell.j - unit.j)
      if (dist < bestDistance) {
        best = cell
        bestDistance = dist
      }
    }
    return best ?? items[0]
  })
}

function getShelterScore(unit: UnitEntity, building: BuildingEntity, reason: VillagerShelterReason): number {
  const townCenterBias = reason === 'danger' && building.type === BUILDING_TYPES.townCenter ? -1000 : 0
  return distance(unit, building) + townCenterBias
}

function getNearestShelter(unit: UnitEntity, reason: VillagerShelterReason): { shelter: BuildingEntity; targetCell: RuntimeCell } | null {
  let best: { shelter: BuildingEntity; targetCell: RuntimeCell; score: number } | null = null
  for (const building of unit.owner?.buildings ?? []) {
    if (!isUsableShelter(building, unit.owner)) continue
    if (hitPointRatio(building) <= CRITICAL_SHELTER_HITPOINT_RATIO) continue
    const targetCell = getShelterEntryCell(unit, building)
    if (!targetCell) continue
    const score = getShelterScore(unit, building, reason)
    if (!best || score < best.score) best = { shelter: building, targetCell, score }
  }
  return best
}

function rememberShelterState(
  unit: UnitEntity,
  state: Omit<VillagerShelterState, 'previousDest' | 'previousWork' | 'previousAction' | 'previousAutonomousJob'>
): VillagerShelterState {
  const existing = unit.shelterState
  const shelterState: VillagerShelterState = {
    ...state,
    reason: state.reason ?? existing?.reason ?? 'sleep',
    previousDest: existing?.previousDest ?? unit.dest ?? null,
    previousWork: existing?.previousWork ?? unit.work ?? null,
    previousAction: existing?.previousAction ?? unit.action ?? null,
    previousAutonomousJob: existing?.previousAutonomousJob ?? unit.autonomousJob ?? null,
  }
  unit.shelterState = shelterState
  return shelterState
}

function clearUnitCell(unit: UnitEntity): void {
  const cell = unit.currentCell
  if (cell?.has === unit || cell?.has?.label === unit.label) {
    cell.has = null
    cell.solid = false
  }
}

function stopUnitForShelter(unit: UnitEntity): void {
  unit.stopInterval?.()
  unit.stopTimeout?.()
  unit.path = []
  unit.realDest = null
  unit.pendingOrder = null
  unit.blockedGatherApproach = null
  unit.inactif = true
}

function setDetachedShadowsVisible(unit: UnitEntity, visible: boolean): void {
  const shadowed = unit as UnitWithDetachedShadows
  if (shadowed.shadow) shadowed.shadow.visible = visible
  if (shadowed.horseShadow) shadowed.horseShadow.visible = visible
}

function hideUnitInsideShelter(unit: UnitEntity, shelter: BuildingEntity): void {
  const state = unit.shelterState
  if (state?.status !== 'inside' || state.shelter !== shelter) return
  const map = unit.context?.map as RuntimeMapWithBuckets | undefined
  clearUnitCell(unit)
  map?.removeFromInstanceBucket?.(unit)
  setDetachedShadowsVisible(unit, false)
  unit.alpha = 0
  unit.visible = false
}

function sleepOutside(unit: UnitEntity, reason: VillagerShelterReason = unit.shelterState?.reason ?? 'sleep'): void {
  rememberShelterState(unit, { status: 'outside', reason, location: 'outside', shelter: null, targetCell: null })
  cancelFade(unit)
  unit.alpha = 1
  unit.visible = true
  setDetachedShadowsVisible(unit, true)
  stopUnitForShelter(unit)
  unit.dest = null
  unit.action = null
  unit.actionLocked = true
  unit.setTextures?.(SHEET_TYPES.dying)
  unit.sprite?.gotoAndStop?.(0)
  unit.sprite?.stop?.()
  setUnitOverheadIndicator(unit, 'sleep')
}

function keepSleepingOutsideVisual(unit: UnitEntity): void {
  if (unit.shelterState?.status !== 'outside') return
  cancelFade(unit)
  unit.alpha = 1
  unit.visible = true
  setDetachedShadowsVisible(unit, true)
  unit.setTextures?.(SHEET_TYPES.dying)
  unit.sprite?.gotoAndStop?.(0)
  unit.sprite?.stop?.()
}

function markShelterEnteredAt(unit: UnitEntity): void {
  const state = unit.shelterState as TimedVillagerShelterState | null | undefined
  if (!state) return
  state.hiddenAt = unit.context?.scheduler?.elapsedMs ?? 0
}

function enterShelter(unit: UnitEntity, shelter: BuildingEntity): void {
  rememberShelterState(unit, {
    status: 'inside',
    reason: unit.shelterState?.reason ?? 'sleep',
    location: 'shelter',
    shelter,
    targetCell: null,
  })
  markShelterEnteredAt(unit)
  stopUnitForShelter(unit)
  unit.dest = null
  unit.action = null
  unit.actionLocked = true
  clearUnitOverheadIndicator(unit)
  fadeOut(unit, FADE_DURATION_MS, () => hideUnitInsideShelter(unit, shelter))
}

function placeUnitAtCell(unit: UnitEntity, cell: RuntimeCell): void {
  const map = unit.context?.map as RuntimeMapWithBuckets | undefined
  const oldI = unit.i
  const oldJ = unit.j
  const [x, y] = cartesianToIsometric(cell.i, cell.j)
  clearUnitCell(unit)
  unit.i = cell.i
  unit.j = cell.j
  unit.x = x
  unit.y = y
  unit.z = cell.z
  unit.zIndex = getInstanceZIndex(unit)
  unit.currentCell = cell
  cell.place(unit)
  cell.solid = true
  map?.addChild?.(unit)
  map?.addToInstanceBucket?.(unit)
  map?.updateInstanceBucket?.(unit, oldI, oldJ)
  unit.applyReliefLift?.(getGroundReliefLevel(cell), true)
  updateInstanceVisibility(unit)
}

function resumePreviousActivity(unit: UnitEntity, state: VillagerShelterState): void {
  unit.shelterState = null
  unit.actionLocked = false
  unit.alpha = 1
  setDetachedShadowsVisible(unit, true)
  clearUnitOverheadIndicator(unit)
  unit.setTextures?.(SHEET_TYPES.standing)
  unit.sprite?.stop?.()
  unit.inactif = true
  unit.syncShadow?.()
  fadeIn(unit, FADE_DURATION_MS)

  unit.autonomousJob = state.previousAutonomousJob ?? null
  if (unit.autonomousJob && resumeVillagerAutonomy(unit)) return

  const previousDest = state.previousDest
  if (previousDest && !(previousDest as RuntimeEntity).isDestroyed) {
    unit.work = state.previousWork ?? unit.work ?? null
    unit.sendToEvt?.(previousDest, state.previousAction ?? null, { forceRepath: true, preserveAutonomy: true })
  }
}

function wakeUnit(unit: UnitEntity, options: { force?: boolean } = {}): void {
  const state = unit.shelterState
  if (!state) return
  if (state.status === 'inside') {
    const shelter = state.shelter
    if (isUsableShelter(shelter, unit.owner)) {
      const targetCell = getShelterEntryCell(unit, shelter)
      if (!targetCell && !options.force) return
      if (targetCell) placeUnitAtCell(unit, targetCell)
    } else if (!options.force) {
      return
    }
  }
  resumePreviousActivity(unit, state)
}

function shouldShelter(unit: UnitEntity): boolean {
  return Boolean(
    unit.type === UNIT_TYPES.villager &&
      !unit.isDead &&
      !unit.isDestroyed &&
      !isHeroControlled(unit) &&
      unit.controlMode !== 'hero' &&
      !unit.trainingTargetType
  )
}

function isViolentVillagerThreat(unit: UnitEntity, attacker: RuntimeEntity | null | undefined): boolean {
  if (!attacker || attacker.isDead || attacker.isDestroyed) return false
  if (!shouldShelter(unit)) return false
  if (attacker.family === 'animal') return hitPointRatio(unit) <= 0.35
  return Boolean(attacker.owner && unit.owner?.isEnemy?.(attacker.owner))
}

function sendUnitToShelter(unit: UnitEntity, reason: VillagerShelterReason): boolean {
  if (!shouldShelter(unit)) return false
  const shelter = getNearestShelter(unit, reason)
  if (!shelter) {
    if (reason === 'sleep') sleepOutside(unit, reason)
    return reason === 'sleep'
  }
  rememberShelterState(unit, {
    status: 'movingToShelter',
    reason,
    location: 'shelter',
    shelter: shelter.shelter,
    targetCell: shelter.targetCell,
    startedAtMs: unit.context?.scheduler?.elapsedMs ?? 0,
    retryCount: 0,
  })
  unit.sendToEvt?.(shelter.targetCell, null, { forceRepath: true, preserveAutonomy: true })
  return true
}

function hasPendingShelterOrder(unit: UnitEntity, targetCell: RuntimeCell | null | undefined): boolean {
  const pending = unit.pendingOrder
  if (!pending || !targetCell) return false
  if (pending.execute) return true
  return pending.dest === targetCell || (pending.dest?.i === targetCell.i && pending.dest?.j === targetCell.j)
}

function retryShelterPath(unit: UnitEntity, state: VillagerShelterState): boolean {
  if (!state.shelter || !isUsableShelter(state.shelter, unit.owner)) return false
  const retryCount = state.retryCount ?? 0
  if (retryCount >= SHELTER_MAX_RETRIES) return false
  const nextCell = getShelterEntryCell(unit, state.shelter)
  if (!nextCell) return false
  state.targetCell = nextCell
  state.retryCount = retryCount + 1
  state.startedAtMs = unit.context?.scheduler?.elapsedMs ?? state.startedAtMs ?? 0
  unit.sendToEvt?.(nextCell, null, { forceRepath: true, preserveAutonomy: true })
  return true
}

function handleVillagerDangerShelter(unit: UnitEntity, attacker: RuntimeEntity | null | undefined): boolean {
  if (!isViolentVillagerThreat(unit, attacker)) return false
  if (unit.shelterState?.status === 'inside') return true
  return sendUnitToShelter(unit, 'danger')
}

function evacuateVillagersFromShelter(building: BuildingEntity, options: { force?: boolean } = {}): void {
  for (const unit of building.owner?.units ?? []) {
    const state = unit.shelterState
    if (state?.shelter !== building) continue
    wakeUnit(unit, { force: options.force ?? true })
    if (isSleepTime(unit.context!) && !unit.shelterState) sendUnitToShelter(unit, 'sleep')
  }
}

function evacuateVillagersIfShelterUnsafe(building: BuildingEntity): void {
  if (!isShelterUnsafe(building)) return
  evacuateVillagersFromShelter(building, { force: true })
}

function updateDangerShelter(unit: UnitEntity): void {
  const state = unit.shelterState as TimedVillagerShelterState | null | undefined
  if (!state || state.reason !== 'danger') return
  if (state.status === 'inside' && isShelterUnsafe(state.shelter)) {
    if (state.shelter) evacuateVillagersFromShelter(state.shelter, { force: true })
    else wakeUnit(unit, { force: true })
    return
  }
  const elapsed = unit.context?.scheduler?.elapsedMs ?? 0
  const hiddenAt = state.hiddenAt ?? elapsed
  if (state.status === 'inside' && elapsed - hiddenAt >= DANGER_SHELTER_MIN_MS) wakeUnit(unit)
}

export class VillagerShelterSystem {
  context: GameContextLike
  taskId: SchedulerTaskId | null

  constructor(context: GameContextLike) {
    this.context = context
    this.taskId = null
    this.taskId = context.scheduler.add(() => this.update(), SHELTER_CHECK_INTERVAL_MS, 'villager.shelter')
    this.update()
  }

  update(): void {
    if (isSleepTime(this.context)) this.sendVillagersToSleep()
    if (isWakeTime(this.context)) this.wakeVillagers()
    this.updateAllDangerShelters()
    this.updateSleepingOutsideVisuals()
  }

  handleVillagerDangerShelter(unit: UnitEntity, attacker: RuntimeEntity | null | undefined): boolean {
    return handleVillagerDangerShelter(unit, attacker)
  }

  evacuateVillagersFromShelter(building: BuildingEntity, options: { force?: boolean } = {}): void {
    evacuateVillagersFromShelter(building, options)
  }

  evacuateVillagersIfShelterUnsafe(building: BuildingEntity): void {
    evacuateVillagersIfShelterUnsafe(building)
  }

  sendVillagersToSleep(): void {
    for (const player of this.context.players ?? []) {
      for (const unit of player.units ?? []) {
        if (!shouldShelter(unit) || unit.shelterState) continue
        sendUnitToShelter(unit, 'sleep')
      }
    }
    for (const player of this.context.players ?? []) {
      for (const unit of player.units ?? []) this.updateShelteringUnit(unit)
    }
  }

  updateShelteringUnit(unit: UnitEntity): void {
    const state = unit.shelterState
    if (!state || state.status !== 'movingToShelter') return
    keepSleepingOutsideVisual(unit)
    if (!isUsableShelter(state.shelter, unit.owner)) {
      if (state.reason === 'sleep') sleepOutside(unit, state.reason)
      else wakeUnit(unit, { force: true })
      return
    }
    const targetCell = state.targetCell
    const arrived = Boolean(targetCell && unit.i === targetCell.i && unit.j === targetCell.j)
    const elapsed = (unit.context?.scheduler?.elapsedMs ?? 0) - (state.startedAtMs ?? 0)
    const orderStillPending = hasPendingShelterOrder(unit, targetCell)
    const failedPath = !orderStillPending && elapsed >= SHELTER_ORDER_GRACE_MS && !unit.path?.length && unit.dest !== targetCell
    if (arrived) enterShelter(unit, state.shelter)
    else if (failedPath) {
      if (retryShelterPath(unit, state)) return
      if (state.reason === 'sleep') sleepOutside(unit, state.reason)
      else wakeUnit(unit, { force: true })
    }
  }

  updateAllDangerShelters(): void {
    for (const player of this.context.players ?? []) {
      for (const unit of player.units ?? []) updateDangerShelter(unit)
    }
  }

  updateSleepingOutsideVisuals(): void {
    for (const player of this.context.players ?? []) {
      for (const unit of player.units ?? []) keepSleepingOutsideVisual(unit)
    }
  }

  wakeVillagers(): void {
    for (const player of this.context.players ?? []) {
      for (const unit of player.units ?? []) {
        if (unit.shelterState?.reason !== 'danger') wakeUnit(unit)
      }
    }
  }

  destroy(): void {
    if (this.taskId != null) {
      this.context.scheduler.remove(this.taskId)
      this.taskId = null
    }
  }
}
