import { findKey, getAmount, getSpawnCell } from './shared'

function canSpawnUnitOnCell(cell, unitConfig) {
  if (!cell || cell.solid || cell.has) return false
  return unitConfig.category === 'Boat' ? cell.category === 'Water' : cell.category !== 'Water' && !cell.waterBorder
}

export function spawnUnits(context, typeName, count = 1) {
  const { player, menu } = context
  const type = findKey(player.config.units, typeName)
  if (!type) return { ok: false, message: `Unknown unit: ${typeName}` }
  const config = player.config.units[type]

  let spawned = 0
  for (let i = 0; i < getAmount(count); i++) {
    const cell = getSpawnCell(context, { cellCondition: cell => canSpawnUnitOnCell(cell, config) })
    if (!cell) break
    player.createUnit({ i: cell.i, j: cell.j, type })
    player.population++
    spawned++
  }
  if (!spawned) {
    const message = config.category === 'Boat' ? 'No free water cell near cursor' : 'No free land cell near cursor'
    return { ok: false, message }
  }
  menu.updateTopbar()
  menu.updatePlayerMiniMapEvt(player)
  return { ok: true, message: `Spawned ${spawned} ${type}` }
}

export function spawnBuilding(context, typeName) {
  const { player, menu } = context
  const type = findKey(player.config.buildings, typeName)
  if (!type) return { ok: false, message: `Unknown building: ${typeName}` }
  const config = player.config.buildings[type]

  const cell = getSpawnCell(context, { buildingConfig: config })
  if (!cell) return { ok: false, message: 'No buildable cell near cursor' }

  const building = player.createBuilding({ i: cell.i, j: cell.j, type, isBuilt: true })
  if (!player.hasBuilt.includes(type)) player.hasBuilt.push(type)
  building.updateTexture()
  menu.updateTopbar()
  menu.updatePlayerMiniMapEvt(player)
  return { ok: true, message: `Spawned ${type}` }
}
