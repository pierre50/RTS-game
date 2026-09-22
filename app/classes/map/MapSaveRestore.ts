import { restoreLegacyStaticKnowledge, restoreTargetKnowledge } from '../../lib/units/playerTargetKnowledge'
import { getEntitySpaceGrid } from '../../lib/mapSpaces'
import type { GameContextLike } from '../../types/context'
import { restoreCaveOccupants as restoreSavedCaveOccupants } from './generation/CaveSaveRestore'
import { expandLegacyFoodAmount, syncPlayerResourceFieldsFromChests } from '../../lib/resources/playerResourceTotals'
import type { AnimalEntity, BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import type { SaveEntityState, SaveReference } from '../../types/save'
import type { MapGenerationMap } from './MapGenerationTypes'
import { getDest, getDestEntity, isRuntimeDestination } from './MapSaveReferences'
import { ensureRuntimeBuildingInteriorSpace } from '../../../engine/services/BuildingInteriorSpaceSystemRuntime'
import type { SavedPlayer } from './MapSaveRestoreTypes'
export { restoreAIState } from './MapSaveAI'

export type { SavedPlayer } from './MapSaveRestoreTypes'
type RestoringMobileEntity = (UnitEntity | AnimalEntity) & {
  autonomousJob?: UnitEntity['autonomousJob']
  exploringForAutonomy?: boolean
  action?: string | null
  blockedGatherApproach?: { target: SaveReference | RuntimeEntity; action: string } | null
  buildQueue?: Array<string | BuildingEntity>
  commonSendTo?: UnitEntity['commonSendTo']
  getAction?: (name: string) => void
  path?: RuntimeCell[]
  previousDest?: RuntimeEntity | RuntimeCell | null
  sendTo?: UnitEntity['sendTo']
  setDest?: UnitEntity['setDest']
  setPath?: UnitEntity['setPath']
  stop?: UnitEntity['stop']
  work?: string | null
}

export function processUnit(unit: RestoringMobileEntity, context: MapGenerationMap, saved?: SaveEntityState): void {
  const restoringUnit = unit as RestoringMobileEntity
  const grid = getEntitySpaceGrid(unit, context) ?? context.grid
  const orders = saved?.caveOrders ?? unit
  const savedPath = Array.isArray(orders.path) ? orders.path : []
  const savedAction = orders.action
  const savedBuildQueue = Array.isArray(restoringUnit.buildQueue) ? restoringUnit.buildQueue : []
  let restoredDelivery = false
  if (orders.previousDest) {
    unit.previousDest = getDest(orders.previousDest, context, grid)
  }
  if (saved?.resourceDelivery && !unit.isDead && unit.family === 'unit') {
    const building = getDestEntity(saved.resourceDelivery.building, context)
    const task = saved.resourceDelivery.returnTask
    ;(unit as UnitEntity).resourceDeliveryState = {
      building:
        building?.family === 'building' && !building.isDead && !building.isDestroyed
          ? (building as BuildingEntity)
          : null,
      phase: 'toBuilding',
      returnTask: task ? { ...task, dest: getDest(task.dest, context, grid) } : null,
    }
    unit.dest = null
    unit.path = []
    unit.action = null
    restoredDelivery = true
  }
  if (!restoredDelivery && orders.dest && !unit.isDead) {
    const dest = getDest(orders.dest, context, grid)
    if (dest) {
      unit.dest = null
      unit.path = []
      unit.setDest?.(dest)
      unit.action = savedAction
      if (savedAction === 'train' && !context.context.dayNight) return
      const restoredPath = savedPath.map(cell => grid[cell.i]?.[cell.j]).filter(Boolean)
      if (restoredPath.length) {
        unit.setPath?.(restoredPath)
      } else if (savedAction && unit.getAction) {
        unit.getAction(savedAction)
      } else if (unit.exploringForAutonomy && unit.autonomousJob && unit.sendToEvt) {
        unit.sendToEvt(dest, null, { forceRepath: true, preserveAutonomy: true })
      } else {
        const destEntity = isRuntimeDestination(dest) ? dest : null
        unit.commonSendTo && destEntity
          ? unit.commonSendTo(destEntity, unit.work ?? '', savedAction ?? null, true, true, true)
          : unit.sendTo?.(dest, savedAction ?? undefined)
      }
    } else {
      unit.stop?.()
    }
  }
  if (savedBuildQueue.length) {
    unit.buildQueue = savedBuildQueue
      .map(item => (typeof item === 'string' ? getDestEntity(item, context) : item))
      .filter((entity): entity is BuildingEntity => Boolean(entity))
  }
  if (restoringUnit.blockedGatherApproach) {
    const saved = restoringUnit.blockedGatherApproach
    const target = getDestEntity(saved.target, context)
    unit.blockedGatherApproach = target ? { target, action: saved.action } : null
  }
}

function migrateLegacyFoodInventory(entity: BuildingEntity | UnitEntity): void {
  const resources = entity.inventory?.resources
  if (!resources || !resources.food) return
  entity.inventory!.resources = expandLegacyFoodAmount(resources)
}

export function restorePlayerEntitiesFromSave(
  player: PlayerLike,
  savedPlayer: SavedPlayer,
  deferInteriors = false
): void {
  restoreTargetKnowledge(player, savedPlayer.targetKnowledge)
  if (!savedPlayer.targetKnowledge) restoreLegacyStaticKnowledge(player, player.context?.map?.resources ?? [])
  const { buildings, units, corpses } = savedPlayer
  player.buildings = (buildings || []).map(building =>
    player.createBuilding({ ...building, skipBuiltEffects: true, deferTrainingResume: true })
  )
  player.units = (units || [])
    .map(unit => player.createUnit?.({ ...unit, suppressCreateSound: true }, { preserveType: true }))
    .filter((unit): unit is NonNullable<typeof unit> => Boolean(unit))
  player.corpses = (corpses || [])
    .map(unit => player.createUnit?.({ ...unit, suppressCreateSound: true }, { preserveType: true }))
    .filter((unit): unit is NonNullable<typeof unit> => Boolean(unit))

  for (const building of [...player.buildings]) {
    if (!deferInteriors && building.interiorBuildings) {
      if (!building.context) throw new Error('Cannot restore building interior without runtime context')
      ensureRuntimeBuildingInteriorSpace(building.context, building)
    }
  }

  // Old saves stored food as one pooled amount per bag; spread it across berry/meat/wheat so it stays visible/spendable.
  for (const entity of [...player.buildings, ...player.units, ...player.corpses]) migrateLegacyFoodInventory(entity)
  syncPlayerResourceFieldsFromChests(player)
}

export function restoreBuildingAssignments(
  player: PlayerLike,
  savedBuildings: SaveEntityState[],
  context: MapGenerationMap
): void {
  for (let index = 0; index < player.buildings.length; index++) {
    const building = player.buildings[index]
    const savedBuilding = savedBuildings[index]
    if (!building || !savedBuilding?.isUsedBy) continue
    const user = getDestEntity(savedBuilding.isUsedBy, context)
    if (user && !user.isDead && !user.isDestroyed) {
      building.isUsedBy = user
    }
  }
}

export function restoreSelection(player: PlayerLike, savedPlayer: SavedPlayer, context: MapGenerationMap): void {
  if (!savedPlayer?.isPlayed) return
  const controls = context.context.controls
  const heroUnit = controls && 'heroUnit' in controls ? controls.heroUnit : null
  player.selectedUnits = []
  player.selectedUnit = null
  player.selectedBuilding = null
  player.selectedOther = null
  context.context.menu?.setActionTarget?.(heroUnit ?? null)
}

export function restorePlayerViews(player: PlayerLike, map: MapGenerationMap): void {
  player.views.restoreViewers(name => getDestEntity(name, map))
  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      if (!map.grid[i]?.[j]) continue
      if (player.views.isViewed(i, j)) {
        player.views.onViewed?.(i, j)
      }
    }
  }
}

export function restoreCaveOccupants(context: GameContextLike, players: SavedPlayer[]): void {
  restoreSavedCaveOccupants(context, players, ensureRuntimeBuildingInteriorSpace)
}

export function restorePlayerInteriors(player: PlayerLike): void {
  for (const building of [...player.buildings]) {
    if (building.interiorBuildings && building.context) ensureRuntimeBuildingInteriorSpace(building.context, building)
  }
  syncPlayerResourceFieldsFromChests(player)
}
