import { moveEntityToMapSpace } from '../../../lib/mapSpaces'
import type { ensureRuntimeBuildingInteriorSpace } from '../../../services/BuildingInteriorSpaceSystem'
import type { GameContextLike } from '../../../types/context'
import type { SaveEntityState } from '../../../types/save'

/** World coordinates remain in the save for compatibility; restore cave coordinates after all owners exist. */
export function restoreCaveOccupants(
  context: GameContextLike,
  players: Array<{ units?: SaveEntityState[]; corpses?: SaveEntityState[] }>,
  ensureInterior: typeof ensureRuntimeBuildingInteriorSpace
): void {
  const caves = context.players.flatMap(player => player.buildings).filter(building => building.cave)
  context.players.forEach((player, index) => {
    const saved = players[index]
    if (!saved) return
    for (const record of [...(saved.units ?? []), ...(saved.corpses ?? [])]) {
      const position = record.cavePosition
      if (!position) continue
      const unit = [...player.units, ...player.corpses].find(unit => unit.label === record.label)
      const building = caves.find(building => building.cave?.id === position.caveId)
      if (!unit || !building) throw new Error('Cannot restore cave occupant: missing unit or cave')
      const space = ensureInterior(context, building)
      const cell = space?.grid[position.i]?.[position.j]
      if (!space || !cell || cell.terrainHidden || cell.border || cell.category === 'Water') {
        throw new Error('Cannot restore cave occupant: invalid position')
      }
      const previousCell = unit.currentCell
      previousCell?.corpses?.delete(unit)
      unit.path = []
      unit.dest = null
      unit.action = null
      moveEntityToMapSpace(context.map, unit, space, cell)
      if (unit.isDead || unit.isDestroyed) {
        if (cell.has === unit) {
          cell.has = null
          cell.solid = false
        }
        cell.corpses?.add(unit)
      }
    }
  })
}
