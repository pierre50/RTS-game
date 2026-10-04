import { isSleepTime } from '../../services/rest/UnitRestRules'
import { ACTION_TYPES } from '../../constants'
import { hasDailyRestSchedule, shouldVillagerWork } from '../../lib/units/village/villagerSchedule'
import { definedProperties } from '../../lib/definedProperties'
import { startUnitWakeTransitionFromTask } from '../../services/rest/UnitRestLifecycle'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity, UnitResourceDeliveryReturnTask } from '../../types/entities'
import type { SaveEntityState, SaveReference } from '../../types/save'
import type { BuildingInteriorOccupantState } from './BuildingInteriorOccupants'
import type { BuildingInteriorTravelGame } from './BuildingInteriorTravelTypes'

function stateLabels(states: Array<Pick<SaveEntityState, 'label'> | null | undefined>): Set<string> {
  return new Set(
    states.map(unit => unit?.label).filter((label): label is string => typeof label === 'string' && label.length > 0)
  )
}

function removeRuntimeUnitsByLabels(context: GameContextLike, labels: Set<string>): UnitEntity[] {
  if (!labels.size) return []
  const { map, player } = context
  const removedUnits = player.units.filter(unit => unit.label && labels.has(unit.label))

  for (const unit of removedUnits) {
    unit.stopInterval?.()
    ;(unit as { stopTimeout?: () => void }).stopTimeout?.()
    const dest = unit.dest
    if (dest && 'isUsedBy' in dest && dest.isUsedBy === unit) dest.isUsedBy = null
    unit.path = []
    unit.action = null
    unit.dest = null
    unit.realDest = null
    unit.previousDest = null
    unit.pendingOrder = null
    unit.shelterState = null
    const currentCell = unit.currentCell || map.grid[unit.i]?.[unit.j]
    if (currentCell?.has === unit || currentCell?.has?.label === unit.label) {
      currentCell.has = null
      currentCell.solid = false
    }
    map.removeFromInstanceBucket?.(unit)
    map.removeChild?.(unit)
    unit.destroy?.({ children: true, texture: false, textureSource: false })
  }

  player.units = player.units.filter(unit => !unit.label || !labels.has(unit.label))
  player.selectedUnits = player.selectedUnits?.filter(unit => !unit.label || !labels.has(unit.label)) ?? []
  if (player.selectedUnit?.label && labels.has(player.selectedUnit.label)) player.selectedUnit = null
  context.menu?.setActionTarget?.()
  return removedUnits
}

export function removeRuntimeInteriorOccupants(
  game: BuildingInteriorTravelGame,
  occupants: BuildingInteriorOccupantState[]
): void {
  removeRuntimeUnitsByLabels(game._gameContext(), stateLabels(occupants))
}

function returnTaskDestinationReference(
  dest: UnitResourceDeliveryReturnTask['dest'] | null | undefined
): SaveReference | null | undefined {
  if (!dest) return dest
  return [dest.i ?? 0, dest.j ?? 0, 'label' in dest ? dest.label : undefined]
}

export function applyInteriorExitReturnTasks(
  occupants: BuildingInteriorOccupantState[],
  units: UnitEntity[]
): BuildingInteriorOccupantState[] {
  const tasksByLabel = new Map(
    units
      .map(unit => [unit.label, unit.interiorExitState?.returnTask] as const)
      .filter(
        (entry): entry is [string, UnitResourceDeliveryReturnTask] =>
          typeof entry[0] === 'string' && entry[0].length > 0 && Boolean(entry[1]?.dest)
      )
  )
  if (!tasksByLabel.size) return occupants

  return occupants.map(occupant => {
    const task = occupant.label ? tasksByLabel.get(occupant.label) : null
    if (!task) return occupant
    const dest = returnTaskDestinationReference(task.dest)
    return definedProperties({
      ...occupant,
      action: task.action ?? null,
      autonomousJob: task.autonomousJob ?? occupant.autonomousJob ?? null,
      dest,
      previousDest: dest,
      previousWork: task.work ?? occupant.previousWork ?? null,
      work: task.work ?? occupant.work ?? null,
    })
  })
}

export function clearInteriorExitState(unit: UnitEntity, scheduler = unit.context?.scheduler): void {
  const taskId = unit.interiorExitState?.taskId
  if (taskId != null) scheduler?.remove(taskId)
  unit.interiorExitState = null
}

export function resumeInteriorExitReturnTask(unit: UnitEntity, scheduler = unit.context?.scheduler): void {
  const returnTask = unit.interiorExitState?.returnTask ?? null
  clearInteriorExitState(unit, scheduler)
  if (!returnTask) return
  startUnitWakeTransitionFromTask(unit, returnTask)
}

export function shouldUnitRemainAtRest(
  context: GameContextLike,
  unit: UnitEntity,
  returnTask = unit.interiorExitState?.returnTask
): boolean {
  if (returnTask?.action === ACTION_TYPES.attack) return false
  return hasDailyRestSchedule(unit) ? !shouldVillagerWork(unit) : isSleepTime(context)
}

export function canRouteInteriorOccupantToExit(game: BuildingInteriorTravelGame, unit: UnitEntity): boolean {
  if (game._isRestarting || game._map().mapType !== 'interior') return false
  const session = game._buildingInteriorSession
  const campaign = game._campaignSave
  if (!session && !campaign) return false
  if (!session) {
    const currentWorld = campaign?.worlds[campaign.currentWorldId]
    if (!currentWorld?.parentWorldId) return false
  }
  if (unit.isDead || unit.isDestroyed || unit.followingHero) return false
  if (unit.controlMode === 'hero' || unit.type === 'Hero') return false
  return true
}
