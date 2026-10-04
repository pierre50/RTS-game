import { getPackedCellStore } from '../../classes/cell/PackedCellRegistry'
import { getGaiaAnimals } from '../../lib'
import type { RuntimeEntity } from '../../types/entities'
import type { RuntimeMap } from '../../types/map'
import type { PlayerLike } from '../../types/player'

function addPausableInstance(instances: Set<RuntimeEntity>, instance: RuntimeEntity | null | undefined): void {
  if (!instance || instance.isDestroyed) return
  if (!instance.pause && !instance.resume) return
  instances.add(instance)
}

export function collectPausableInstances(map: RuntimeMap, players: PlayerLike[]): Set<RuntimeEntity> {
  const instances = new Set<RuntimeEntity>()
  for (const animal of getGaiaAnimals(map.gaia)) addPausableInstance(instances, animal)
  for (const player of players) {
    for (const unit of player.units ?? []) addPausableInstance(instances, unit)
    for (const animal of player.animals ?? []) addPausableInstance(instances, animal)
    for (const building of player.buildings ?? []) addPausableInstance(instances, building)
    for (const corpse of player.corpses ?? []) addPausableInstance(instances, corpse)
  }
  const packed = getPackedCellStore(map.grid)
  const rows = packed ? [packed.changedCells(map.grid)] : (map.grid ?? [])
  for (const row of rows) {
    for (const cell of row ?? []) {
      for (const corpse of cell?.corpses ?? []) addPausableInstance(instances, corpse)
    }
  }
  return instances
}
