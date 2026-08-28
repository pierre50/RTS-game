import { Assets } from 'pixi.js'
import type { CommandResult } from '../DevCommandRegistry'
import type { DevCell, DevConsoleContext, DevPlayer } from '../types'
import { findKey, getAmount, getSpawnCell, normalize } from './shared'
import { Resource } from '../../classes/Resource'
import { Player } from '../../classes/players/Player'
import { BUILDING_TYPES, PLAYER_TYPES, RESOURCE_TYPES, UNIT_TYPES } from '../../constants'
import { getBuildingFootprintCells } from '../../lib'
import type { PlayerLike } from '../../types/player'

function canSpawnUnitOnCell(cell: DevCell): boolean {
  if (!cell || cell.solid || cell.has) return false
  return cell.category !== 'Water' && !cell.waterBorder
}

const BANDIT_OWNER_NAME = 'Bandits'
const BANDIT_UNIT_TYPES = new Set<string>([UNIT_TYPES.banditChief, UNIT_TYPES.banditSword, UNIT_TYPES.banditArcher])
const DECO_BUILDING_ALIASES: Record<string, string> = {
  firecamp: BUILDING_TYPES.fireCamp,
  campfire: BUILDING_TYPES.fireCamp,
  totemplain: BUILDING_TYPES.campTotemPlain,
  totemhorns: BUILDING_TYPES.campTotemHorns,
  totemskull: BUILDING_TYPES.campTotemSkull,
  fencepost: BUILDING_TYPES.campFencePost,
  bonesmall: BUILDING_TYPES.campBoneSmall,
  rockpile: BUILDING_TYPES.campRockPile,
  skull: BUILDING_TYPES.campSkull,
  animalbones: BUILDING_TYPES.campAnimalBones,
  meatrack: BUILDING_TYPES.campMeatRack,
  dryingrack: BUILDING_TYPES.campDryingRack,
  bucket: BUILDING_TYPES.campBucket,
  crate: BUILDING_TYPES.campCrate,
  jarsmall: BUILDING_TYPES.campJarSmall,
  jarlarge: BUILDING_TYPES.campJarLarge,
}
export const DECO_BUILDING_COMPLETIONS = Object.keys(DECO_BUILDING_ALIASES)
const BANDIT_UNIT_ALIASES: Record<string, string> = {
  bandit1: UNIT_TYPES.banditChief,
  chefbandit: UNIT_TYPES.banditChief,
  banditchief: UNIT_TYPES.banditChief,
  bandit2: UNIT_TYPES.banditSword,
  banditsword: UNIT_TYPES.banditSword,
  bandit3: UNIT_TYPES.banditArcher,
  banditarcher: UNIT_TYPES.banditArcher,
}

type BanditPlayer = DevPlayer & { devConsoleBanditOwner?: true }
type BanditAwarePlayer = DevPlayer & {
  devConsoleBanditHostilityPatched?: true
  devConsoleOriginalIsEnemy?: PlayerLike['isEnemy']
}

function isBanditUnitType(type: string): boolean {
  return BANDIT_UNIT_TYPES.has(type)
}

function resolveUnitType(owner: DevPlayer, typeName: string): string | undefined {
  const directType = findKey(owner.config.units, typeName)
  if (directType) return directType
  const compact = normalize(typeName).replace(/[\s_-]+/g, '')
  return BANDIT_UNIT_ALIASES[compact]
}

function resolveBuildingType(owner: DevPlayer, typeName: string): string | undefined {
  const directType = findKey(owner.config.buildings, typeName)
  if (directType) return directType
  const compact = normalize(typeName).replace(/[\s_-]+/g, '')
  const alias = DECO_BUILDING_ALIASES[compact]
  return alias && owner.config.buildings[alias] ? alias : undefined
}

function isDevBanditOwner(player: DevPlayer): player is BanditPlayer {
  return Boolean((player as BanditPlayer).devConsoleBanditOwner)
}

function syncBanditHostility(context: DevConsoleContext, owner: BanditPlayer): void {
  owner.isEnemy = (player?: PlayerLike | null) => Boolean(player && player.label !== owner.label)
  owner.enemyPlayers = () => context.players.filter(player => owner.isEnemy?.(player))

  for (const player of context.players) {
    if (player.label === owner.label) continue
    const banditAwarePlayer = player as BanditAwarePlayer
    if (banditAwarePlayer.devConsoleBanditHostilityPatched) continue

    const originalIsEnemy = player.isEnemy?.bind(player)
    banditAwarePlayer.devConsoleOriginalIsEnemy = originalIsEnemy
    player.isEnemy = (other?: PlayerLike | null) => {
      if (other && isDevBanditOwner(other as DevPlayer)) return true
      return originalIsEnemy?.(other) ?? Boolean(other && other.label !== player.label)
    }
    player.enemyPlayers = () => context.players.filter(other => other.label !== player.label && player.isEnemy?.(other))
    banditAwarePlayer.devConsoleBanditHostilityPatched = true
  }
}

function getOrCreateBanditOwner(context: DevConsoleContext): BanditPlayer {
  const existing = context.players.find(isDevBanditOwner)
  if (existing) {
    syncBanditHostility(context, existing)
    return existing
  }

  const owner = new Player(
    {
      name: BANDIT_OWNER_NAME,
      type: PLAYER_TYPES.ai,
      isPlayed: false,
      color: 'red',
      civ: context.player.civ ?? 'Greek',
      gender: 'male',
      team: null,
      diplomacy: null,
      populationMax: Number.POSITIVE_INFINITY,
      autoTechnologyByAge: false,
    },
    context as unknown as ConstructorParameters<typeof Player>[1]
  ) as BanditPlayer

  owner.devConsoleBanditOwner = true
  owner.selectedUnits = []
  owner.selectedUnit = null
  owner.selectedBuilding = null
  owner.selectedOther = null
  owner.hasBuilt = []
  context.players.push(owner)
  syncBanditHostility(context, owner)
  return owner
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

function spawnBanditUnits(context: DevConsoleContext, type: string, count: string | number = 1): CommandResult {
  const { menu } = context
  const owner = getOrCreateBanditOwner(context)

  let spawned = 0
  for (let i = 0; i < getAmount(count); i++) {
    const cell = getSpawnCell(context, { cellCondition: canSpawnUnitOnCell })
    if (!cell) break
    owner.createUnit?.({
      i: cell.i,
      j: cell.j,
      type,
      gender: 'male',
      appearanceVariants: { gender: 'male' },
    })
    owner.population = (owner.population ?? 0) + 1
    spawned++
  }
  if (!spawned) {
    return { ok: false, message: 'No free land cell near cursor' }
  }
  menu.updateTopbar()
  if (menu.isMiniMapActive?.() !== false) menu.updatePlayerMiniMapEvt?.(owner)
  return { ok: true, message: `Spawned ${spawned > 1 ? `${spawned} ${type}` : type} for bandits` }
}

function spawnWheatField(
  context: DevConsoleContext,
  owner: DevPlayer,
  cell: DevCell,
  ownerIndex: number,
  includeOwner: boolean
): CommandResult {
  const { map, menu } = context
  const size = Number(owner.config.buildings[BUILDING_TYPES.farm]?.size ?? 4)
  const cells = getBuildingFootprintCells(cell.i, cell.j, map.grid, size)
  for (const footprintCell of cells) {
    const wheat = map.addChild(
      new Resource(
        { i: footprintCell.i, j: footprintCell.j, type: RESOURCE_TYPES.wheat, startsMature: true },
        context as unknown as ConstructorParameters<typeof Resource>[1]
      )
    )
    map.resources.add(wheat)
  }
  menu.updateTopbar()
  if (menu.isMiniMapActive?.() !== false) menu.updateResourcesMiniMapEvt?.()
  return { ok: true, message: formatSpawnMessage('Wheat Field', 1, ownerIndex, includeOwner) }
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

  const type = resolveUnitType(owner, typeName)
  if (!type) {
    const suffix = playerIndex == null ? '' : ` for player ${ownerIndex}`
    return { ok: false, message: `Unknown unit${suffix}: ${typeName}` }
  }
  if (isBanditUnitType(type)) {
    return spawnBanditUnits(context, type, count)
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
  if (menu.isMiniMapActive?.() !== false) menu.updatePlayerMiniMapEvt?.(owner)
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

  const type = resolveBuildingType(owner, typeName)
  if (!type) {
    const suffix = playerIndex == null ? '' : ` for player ${ownerIndex}`
    return { ok: false, message: `Unknown building${suffix}: ${typeName}` }
  }
  const config = { ...owner.config.buildings[type], type }

  const cell = getSpawnCell(context, { buildingConfig: config })
  if (!cell) return { ok: false, message: 'No buildable cell near cursor' }

  if (type === BUILDING_TYPES.farm) {
    return spawnWheatField(context, owner, cell, ownerIndex, playerIndex != null)
  }

  const building = owner.createBuilding({ i: cell.i, j: cell.j, type, isBuilt: true })
  owner.hasBuilt ??= []
  if (!owner.hasBuilt.includes(type)) owner.hasBuilt.push(type)
  ;(building as { updateTexture?: () => void }).updateTexture?.()
  menu.updateTopbar()
  if (menu.isMiniMapActive?.() !== false) menu.updatePlayerMiniMapEvt?.(owner)
  return { ok: true, message: formatSpawnMessage(type, 1, ownerIndex, playerIndex != null) }
}
