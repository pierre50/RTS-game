import type { CommandResult } from '../DevCommandRegistry'
import { findKey, getAmount, getSpawnCell } from './shared'

type AnyRecord = Record<string, any>

function canSpawnUnitOnCell(cell: AnyRecord, unitConfig: AnyRecord): boolean {
  if (!cell || cell.solid || cell.has) return false
  return unitConfig.category === 'Boat' ? cell.category === 'Water' : cell.category !== 'Water' && !cell.waterBorder
}

type ResolveOwnerResult = { owner: AnyRecord; ownerIndex: number; error: null } | { owner: null; ownerIndex: null; error: string }

function resolveOwner(context: AnyRecord, playerIndex: string | number | null): ResolveOwnerResult {
  if (playerIndex == null) {
    return { owner: context.player, ownerIndex: context.players.indexOf(context.player), error: null }
  }

  const ownerIndex = Number(playerIndex)
  if (!Number.isInteger(ownerIndex) || ownerIndex < 0) {
    return { owner: null, ownerIndex: null, error: 'Player index must be a non-negative integer' }
  }

  const owner = context.players?.[ownerIndex]
  if (!owner) return { owner: null, ownerIndex: null, error: `Unknown player index: ${playerIndex}` }

  return { owner, ownerIndex, error: null }
}

function formatSpawnMessage(entityType: string, spawned: number, ownerIndex: number, includeOwner: boolean): string {
  const entityLabel = spawned > 1 ? `${spawned} ${entityType}` : entityType
  return includeOwner ? `Spawned ${entityLabel} for player ${ownerIndex}` : `Spawned ${entityLabel}`
}

export function spawnUnits(
  context: AnyRecord,
  typeName: string,
  count: string | number = 1,
  playerIndex: string | number | null = null
): CommandResult {
  const { menu } = context
  const resolved = resolveOwner(context, playerIndex)
  if (resolved.error !== null) return { ok: false, message: resolved.error }
  const { owner, ownerIndex } = resolved

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

export function spawnBuilding(
  context: AnyRecord,
  typeName: string,
  playerIndex: string | number | null = null
): CommandResult {
  const { menu } = context
  const resolved = resolveOwner(context, playerIndex)
  if (resolved.error !== null) return { ok: false, message: resolved.error }
  const { owner, ownerIndex } = resolved

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
