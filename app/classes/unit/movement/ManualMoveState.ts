import { UNIT_TYPES } from '../../../constants'
import { clearVillagerAutonomy } from '../../../lib'
import type { UnitEntity } from '../../../types/entities'

export function clearManualMoveWorkState(unit: UnitEntity, preserveAutonomy: boolean): void {
  if (preserveAutonomy) return
  unit.exploringForAutonomy = false
  unit.previousDest = null
  unit.previousWork = null
  unit.gatherProgressState = null
  unit.resourceDeliveryState = null
  if (unit.type === UNIT_TYPES.villager) unit.work = null
  clearVillagerAutonomy?.(unit)
  if (unit.owner?.isPlayed) unit.context?.menu?.updateTopbar?.()
}
