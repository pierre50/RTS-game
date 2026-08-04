import { Assets } from 'pixi.js'
import type { CommandResult } from '../DevCommandRegistry'
import type { DevCell, DevConsoleContext, DevPlayer } from '../types'
import { findKey, getAmount, getSpawnCell } from './shared'
import { FloatingItem } from '../../classes/FloatingItem'
import { RESOURCE_TYPES } from '../../constants'

function canSpawnUnitOnCell(cell: DevCell): boolean {
  if (!cell || cell.solid || cell.has) return false
  return cell.category !== 'Water' && !cell.waterBorder
}

type ResolveOwnerResult =
  | { owner: DevPlayer; ownerIndex: number; error: null }
  | { owner: null; ownerIndex: null; error: string }

function resolveOwner(context: DevConsoleContext, playerIndex: string | number | null): ResolveOwnerResult {
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
  context: DevConsoleContext,
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

  let spawned = 0
  for (let i = 0; i < getAmount(count); i++) {
    const cell = getSpawnCell(context, { cellCondition: canSpawnUnitOnCell })
    if (!cell) break
    owner.createUnit?.({ i: cell.i, j: cell.j, type })
    owner.population = (owner.population ?? 0) + 1
    spawned++
  }
  if (!spawned) {
    return { ok: false, message: 'No free land cell near cursor' }
  }
  menu.updateTopbar()
  menu.updatePlayerMiniMapEvt?.(owner)
  return { ok: true, message: formatSpawnMessage(type, spawned, ownerIndex, playerIndex != null) }
}

export function spawnAnimal(context: DevConsoleContext, typeName: string, count: string | number = 1): CommandResult {
  const { menu, map } = context
  const animals = (Assets.cache.get('config') as { animals?: Record<string, unknown> } | undefined)?.animals ?? {}
  const type = findKey(animals, typeName)
  if (!type) return { ok: false, message: `Unknown animal: ${typeName}` }
  if (!map.gaia?.createAnimal) return { ok: false, message: 'No Gaia player on this map' }

  let spawned = 0
  for (let i = 0; i < getAmount(count); i++) {
    const cell = getSpawnCell(context, { cellCondition: canSpawnUnitOnCell })
    if (!cell) break
    map.gaia.createAnimal({ i: cell.i, j: cell.j, type })
    spawned++
  }
  if (!spawned) return { ok: false, message: 'No free land cell near cursor' }
  menu.updateTopbar()
  return { ok: true, message: formatSpawnMessage(type, spawned, 0, false) }
}

export function spawnBuilding(
  context: DevConsoleContext,
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
  const config = { ...owner.config.buildings[type], type }

  const cell = getSpawnCell(context, { buildingConfig: config })
  if (!cell) return { ok: false, message: 'No buildable cell near cursor' }

  const building = owner.createBuilding({ i: cell.i, j: cell.j, type, isBuilt: true })
  owner.hasBuilt ??= []
  if (!owner.hasBuilt.includes(type)) owner.hasBuilt.push(type)
  ;(building as { updateTexture?: () => void }).updateTexture?.()
  menu.updateTopbar()
  menu.updatePlayerMiniMapEvt?.(owner)
  return { ok: true, message: formatSpawnMessage(type, 1, ownerIndex, playerIndex != null) }
}

export function spawnFloatingItem(
  context: DevConsoleContext,
  resourceName: string = RESOURCE_TYPES.gold,
  amount: string | number = 1
): CommandResult {
  const resourceKey = findKey(RESOURCE_TYPES, resourceName) as keyof typeof RESOURCE_TYPES | undefined
  const resourceType = resourceKey ? RESOURCE_TYPES[resourceKey] : resourceName
  if (resourceType !== RESOURCE_TYPES.gold) {
    return { ok: false, message: 'Only Gold floating items are available for now' }
  }

  const cell = getSpawnCell(context)
  if (!cell) return { ok: false, message: 'No cell near cursor' }

  new FloatingItem(
    {
      i: cell.i,
      j: cell.j,
      resourceType,
      amount: getAmount(amount),
    },
    context as unknown as ConstructorParameters<typeof FloatingItem>[1]
  )

  return { ok: true, message: `Spawned floating ${resourceType} item` }
}
