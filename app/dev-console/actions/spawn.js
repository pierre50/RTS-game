import { findKey, getAmount, getSpawnCell } from './shared'

function canSpawnUnitOnCell(cell, unitConfig) {
  if (!cell || cell.solid || cell.has) return false
  return unitConfig.category === 'Boat' ? cell.category === 'Water' : cell.category !== 'Water' && !cell.waterBorder
}

function resolveOwner(context, playerIndex) {
  if (playerIndex == null) return { owner: context.player, ownerIndex: context.players.indexOf(context.player) }

  const ownerIndex = Number(playerIndex)
  if (!Number.isInteger(ownerIndex) || ownerIndex < 0) {
    return { error: 'Player index must be a non-negative integer' }
  }

  const owner = context.players?.[ownerIndex]
  if (!owner) return { error: `Unknown player index: ${playerIndex}` }

  return { owner, ownerIndex }
}

function formatSpawnMessage(entityType, spawned, ownerIndex, includeOwner) {
  const entityLabel = spawned > 1 ? `${spawned} ${entityType}` : entityType
  return includeOwner ? `Spawned ${entityLabel} for player ${ownerIndex}` : `Spawned ${entityLabel}`
}

export function spawnUnits(context, typeName, count = 1, playerIndex = null) {
  const { player, menu } = context
  const { owner, ownerIndex, error } = resolveOwner(context, playerIndex)
  if (error) return { ok: false, message: error }

  const type = findKey(owner.config.units, typeName)
  if (!type) {
    const suffix = playerIndex == null ? '' : ` for player ${ownerIndex}`
    return { ok: false, message: `Unknown unit${suffix}: ${typeName}` }
  }
  const config = owner.config.units[type]

  let spawned = 0
  for (let i = 0; i < getAmount(count); i++) {
    const cell = getSpawnCell(context, { cellCondition: cell => canSpawnUnitOnCell(cell, config) })
    if (!cell) break
    owner.createUnit({ i: cell.i, j: cell.j, type })
    owner.population++
    spawned++
  }
  if (!spawned) {
    const message = config.category === 'Boat' ? 'No free water cell near cursor' : 'No free land cell near cursor'
    return { ok: false, message }
  }
  menu.updateTopbar()
  menu.updatePlayerMiniMapEvt(owner)
  return { ok: true, message: formatSpawnMessage(type, spawned, ownerIndex, playerIndex != null) }
}

export function spawnBuilding(context, typeName, playerIndex = null) {
  const { player, menu } = context
  const { owner, ownerIndex, error } = resolveOwner(context, playerIndex)
  if (error) return { ok: false, message: error }

  const type = findKey(owner.config.buildings, typeName)
  if (!type) {
    const suffix = playerIndex == null ? '' : ` for player ${ownerIndex}`
    return { ok: false, message: `Unknown building${suffix}: ${typeName}` }
  }
  const config = owner.config.buildings[type]

  const cell = getSpawnCell(context, { buildingConfig: config })
  if (!cell) return { ok: false, message: 'No buildable cell near cursor' }

  const building = owner.createBuilding({ i: cell.i, j: cell.j, type, isBuilt: true })
  if (!owner.hasBuilt.includes(type)) owner.hasBuilt.push(type)
  building.updateTexture()
  menu.updateTopbar()
  menu.updatePlayerMiniMapEvt(owner)
  return { ok: true, message: formatSpawnMessage(type, 1, ownerIndex, playerIndex != null) }
}
