import { expandLegacyFoodAmount, syncPlayerResourceFieldsFromChests } from '../../lib/resources/playerResourceTotals'
import type { AnimalEntity, BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import type { SaveEntityState, SaveReference } from '../../types/save'
import type { MapGenerationMap } from './MapGenerationTypes'
import { getDest, getDestEntity, isRuntimeDestination } from './MapSaveReferences'
import type { SavedPlayer } from './MapSaveRestoreTypes'
export { restoreAIState } from './MapSaveAI'

export type { SavedPlayer } from './MapSaveRestoreTypes'
type RestoringMobileEntity = (UnitEntity | AnimalEntity) & {
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

export function processUnit(unit: RestoringMobileEntity, context: MapGenerationMap): void {
  const restoringUnit = unit as RestoringMobileEntity
  const savedPath: RuntimeCell[] = Array.isArray(unit.path) ? unit.path : []
  const savedAction = unit.action
  const savedBuildQueue = Array.isArray(restoringUnit.buildQueue) ? restoringUnit.buildQueue : []
  if (unit.previousDest) {
    unit.previousDest = getDest(unit.previousDest, context)
  }
  if (unit.dest && !unit.isDead) {
    const dest = getDest(unit.dest, context)
    if (dest) {
      unit.dest = null
      unit.path = []
      unit.setDest?.(dest)
      unit.action = savedAction
      const restoredPath = savedPath.map((cell: RuntimeCell) => context.grid[cell.i]?.[cell.j]).filter(Boolean)
      if (restoredPath.length) {
        unit.setPath?.(restoredPath)
      } else if (savedAction && unit.getAction) {
        unit.getAction(savedAction)
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

export function restorePlayerEntitiesFromSave(player: PlayerLike, savedPlayer: SavedPlayer): void {
  const { buildings, units, corpses } = savedPlayer
  player.buildings = (buildings || []).map(building => player.createBuilding({ ...building, skipBuiltEffects: true }))
  player.units = (units || [])
    .map(unit => player.createUnit?.({ ...unit, suppressCreateSound: true }, { preserveType: true }))
    .filter((unit): unit is NonNullable<typeof unit> => Boolean(unit))
  player.corpses = (corpses || [])
    .map(unit => player.createUnit?.({ ...unit, suppressCreateSound: true }, { preserveType: true }))
    .filter((unit): unit is NonNullable<typeof unit> => Boolean(unit))

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

export function restorePlayerViewsAndFog(player: PlayerLike, map: MapGenerationMap): void {
  player.views.restoreViewers(name => getDestEntity(name, map))
  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      if (!map.grid[i]?.[j]) continue
      if (player.views.isViewed(i, j)) {
        player.views.onViewed?.(i, j)
      }
      if (player.isPlayed && player.views.isViewed(i, j)) {
        if (!player.views.isVisible(i, j)) {
          map.grid[i][j].setFog(true)
        } else {
          map.grid[i][j].removeFog()
        }
      }
    }
  }
}
