import { isValidCondition } from '../../lib'
import { findKey, getAmount, getSpawnCell } from './shared'

export function spawnUnits(context, typeName, count = 1) {
  const { player, menu } = context
  const type = findKey(player.config.units, typeName)
  if (!type) return { ok: false, message: `Unknown unit: ${typeName}` }

  let spawned = 0
  for (let i = 0; i < getAmount(count); i++) {
    const cell = getSpawnCell(context)
    if (!cell) break
    player.createUnit({ i: cell.i, j: cell.j, type })
    player.population++
    spawned++
  }
  if (!spawned) return { ok: false, message: 'No free cell near cursor' }
  menu.updateTopbar()
  menu.updatePlayerMiniMapEvt(player)
  return { ok: true, message: `Spawned ${spawned} ${type}` }
}

export function spawnBuilding(context, typeName) {
  const { player, menu } = context
  const type = findKey(player.config.buildings, typeName)
  if (!type) return { ok: false, message: `Unknown building: ${typeName}` }
  const config = player.config.buildings[type]

  if (config.conditions?.some(condition => !isValidCondition(condition, player))) {
    return { ok: false, message: `Cannot spawn ${type} with current age/tech requirements` }
  }

  const cell = getSpawnCell(context, config)
  if (!cell) return { ok: false, message: 'No buildable cell near cursor' }

  const building = player.createBuilding({ i: cell.i, j: cell.j, type, isBuilt: true })
  if (!player.hasBuilt.includes(type)) player.hasBuilt.push(type)
  building.updateTexture()
  menu.updateTopbar()
  menu.updatePlayerMiniMapEvt(player)
  return { ok: true, message: `Spawned ${type}` }
}
