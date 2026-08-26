import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import {
  enterShelter,
  keepSleepingOutsideVisual,
  retryShelterPath,
  sendUnitToShelter,
  sleepOutside,
  wakeUnit,
} from './VillagerShelterLifecycle'
import type { TimedVillagerShelterState } from './VillagerShelterLifecycle'
import {
  DANGER_SHELTER_MIN_MS,
  isShelterUnsafe,
  isSleepTime,
  isUsableShelter,
  isViolentVillagerThreat,
  isWakeTime,
  SHELTER_CHECK_INTERVAL_MS,
  SHELTER_ORDER_GRACE_MS,
  shouldShelter,
} from './VillagerShelterRules'

function hasPendingShelterOrder(unit: UnitEntity, targetCell: UnitEntity['currentCell'] | null | undefined): boolean {
  const pending = unit.pendingOrder
  if (!pending || !targetCell) return false
  if (pending.execute) return true
  return pending.dest === targetCell || (pending.dest?.i === targetCell.i && pending.dest?.j === targetCell.j)
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
