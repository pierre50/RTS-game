import { FAMILY_TYPES, SHEET_TYPES } from '../../constants'
import { isBanditOwner } from '../combat/bandits'
import { getBuildingShelterCapacity } from '../buildings/buildingOccupancy'
import { updateInstanceVisibility } from '../grid/visibility'
import { syncEntityHealthDisplay } from './entityHealthDisplay'
import { isPlayerEliminated } from '../playerState'
import type { MenuLike } from '../../types/context'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

type OwnerListKey = 'units' | 'buildings'
export type ConvertibleEntity = (UnitEntity | BuildingEntity) & Partial<UnitEntity & BuildingEntity>

type TransferOwnerOptions = {
  allowBanditOwner?: boolean
  menu?: MenuLike | null
  player?: PlayerLike | null
  showConversionFeedback?: (target: RuntimeEntity, color?: string | null) => void
  showFeedback?: boolean
}
type PlayerWithContext = PlayerLike & { context?: GameContextLike }

function ownerList(owner: PlayerLike | null | undefined, key: OwnerListKey): RuntimeEntity[] | undefined {
  if (!owner) return undefined
  return key === 'units' ? owner.units : owner.buildings
}

function removeFromOwnerList(
  owner: PlayerLike | null | undefined,
  key: 'units' | 'buildings',
  instance: RuntimeEntity
): void {
  const list = ownerList(owner, key)
  if (!Array.isArray(list)) return
  const index = list.indexOf(instance)
  if (index >= 0) list.splice(index, 1)
}

function addToOwnerList(owner: PlayerLike | null | undefined, key: 'units' | 'buildings', instance: RuntimeEntity): void {
  const list = ownerList(owner, key)
  if (!Array.isArray(list) || list.includes(instance)) return
  list.push(instance)
}

function isLivingUnit(unit: UnitEntity | null | undefined): boolean {
  return Boolean(unit && !unit.isDead && !unit.isDestroyed && (unit.hitPoints ?? 0) > 0)
}

function isLivingBuilding(building: BuildingEntity | null | undefined): boolean {
  return Boolean(building && !building.isDead && !building.isDestroyed && (building.hitPoints ?? 0) > 0)
}

function entityDistanceSq(a: Pick<RuntimeEntity, 'i' | 'j'>, b: Pick<RuntimeEntity, 'i' | 'j'>): number {
  return (a.i - b.i) ** 2 + (a.j - b.j) ** 2
}

function playerAnchorEntities(player: PlayerLike): Array<Pick<RuntimeEntity, 'i' | 'j'>> {
  const anchors = [
    ...(player.units ?? []).filter(isLivingUnit),
    ...(player.buildings ?? []).filter(isLivingBuilding),
  ]
  return anchors.length ? anchors : [{ i: player.i ?? 0, j: player.j ?? 0 }]
}

function nearestPlayerForBuilding(building: BuildingEntity, players: PlayerLike[]): PlayerLike | null {
  let nearest: PlayerLike | null = null
  let nearestDistance = Infinity
  for (const player of players) {
    for (const anchor of playerAnchorEntities(player)) {
      const distance = entityDistanceSq(building, anchor)
      if (distance >= nearestDistance) continue
      nearest = player
      nearestDistance = distance
    }
  }
  return nearest
}

function canRefreshTransferMinimap(instance: ConvertibleEntity, player?: PlayerLike | null): boolean {
  const activeSpaceId = instance.context?.map?.activeSpaceId || 'outside'
  if ((instance.spaceId || 'outside') !== activeSpaceId) return false
  if (instance.context?.map?.revealEverything) return true
  return Boolean(player && instance.owner?.label === player.label)
}

export function isConvertibleEntity(target: RuntimeEntity): target is ConvertibleEntity {
  return target.family === FAMILY_TYPES.unit || target.family === FAMILY_TYPES.building
}

export function clearConvertedEntityRuntimeState(target: ConvertibleEntity): void {
  target.stopInterval?.()
  if (target.energyWaitTaskId != null) {
    target.context?.scheduler?.remove(target.energyWaitTaskId)
    target.energyWaitTaskId = null
  }
  if (target.sprite) {
    target.sprite.onLoop = undefined
    target.sprite.onFrameChange = undefined
    target.sprite.onComplete = undefined
  }
  target.path = []
  target.action = null
  target.dest = null
  target.realDest = null
  target.previousDest = null
  target.previousWork = null
  target.waitingForEnergyAction = null
  target.waitingForEnergyTarget = null
  target.combatMode = null
  target.lastCombatRecoveryMoveAt = null
  target.actionLocked = false
  target.pendingOrder = null
  target.blockedGatherApproach = null
  target.inactif = true
}

export function transferEntityOwner(
  target: ConvertibleEntity,
  newOwner: PlayerLike,
  options: TransferOwnerOptions = {}
): boolean {
  const menu = options.menu ?? target.context?.menu ?? null
  const player = options.player ?? target.context?.player ?? null
  const oldOwner = target.owner
  if (!oldOwner || !newOwner || oldOwner.label === newOwner.label) return false
  if (!options.allowBanditOwner && isBanditOwner(newOwner)) return false

  if (target.selected) {
    target.select?.()
    if (player?.selectedOther === target) player.selectedOther = null
  }

  clearConvertedEntityRuntimeState(target)
  target.assetCiv = target.assetCiv || oldOwner.civ
  target.assetAge = target.assetAge ?? oldOwner.age
  target.owner = newOwner

  if (target.family === FAMILY_TYPES.unit) {
    removeFromOwnerList(oldOwner, 'units', target)
    addToOwnerList(newOwner, 'units', target)
    oldOwner.population = Math.max(0, oldOwner.population - 1)
    newOwner.population += 1
    target.setTextures?.(SHEET_TYPES.standing)
  } else if (target.family === FAMILY_TYPES.building) {
    target.assetType = target.assetType || target.type
    removeFromOwnerList(oldOwner, 'buildings', target)
    addToOwnerList(newOwner, 'buildings', target)
    const populationCapacity = getBuildingShelterCapacity(target) || target.increasePopulation || 0
    if (populationCapacity && target.populationCapacityApplied) {
      oldOwner.populationMax = Math.max(0, oldOwner.populationMax - populationCapacity)
      newOwner.populationMax += populationCapacity
    }
    target.clearRallyPoint?.()
    target.queue = []
    target.technology = null
    target.loading = null
    target.finalTexture?.()
    if (target.interface) {
      const units = newOwner.isPlayed && menu ? (target.units || []).map(key => menu.getActionUnitButton?.(key, target)) : []
      target.interface.menu = newOwner.isPlayed
        ? [...units, ...(units.length && menu ? [menu.getActionRallyPointButton?.()] : [])].filter(
            (item): item is NonNullable<typeof item> => Boolean(item)
          )
        : []
    }
    if (target.isBuilt && !newOwner.hasBuilt?.includes(target.type)) {
      newOwner.hasBuilt?.push(target.type)
    }
  } else {
    return false
  }

  updateInstanceVisibility(target)
  if (options.showFeedback !== false) options.showConversionFeedback?.(target, newOwner.color ?? newOwner.colorHex)
  if (target.selected || target.shouldKeepHealthBarVisible?.()) {
    syncEntityHealthDisplay(target, { menu, player: newOwner })
  } else {
    target.removeHealthBar?.()
  }
  canRefreshTransferMinimap(target, player) &&
    menu?.isMiniMapActive?.() !== false &&
    menu?.updatePlayerMiniMapEvt?.(oldOwner)
  canRefreshTransferMinimap(target, player) &&
    menu?.isMiniMapActive?.() !== false &&
    menu?.updatePlayerMiniMapEvt?.(newOwner)
  if (newOwner.isPlayed) menu?.updateTopbar()
  return true
}

export function transferDefeatedPlayerBuildings(defeatedPlayer: PlayerLike): number {
  const context = (defeatedPlayer as PlayerWithContext).context
  const players = (context?.players ?? []).filter(
    (player: PlayerLike) => player !== defeatedPlayer && !isPlayerEliminated(player)
  )
  if (!players.length) return 0

  let transferred = 0
  for (const building of [...(defeatedPlayer.buildings ?? [])]) {
    if (!isLivingBuilding(building)) continue
    const newOwner = players.length === 1 ? players[0] : nearestPlayerForBuilding(building, players)
    if (!newOwner) continue
    if (
      transferEntityOwner(building as ConvertibleEntity, newOwner, {
        allowBanditOwner: true,
        menu: context?.menu,
        player: context?.player,
      })
    ) {
      transferred += 1
    }
  }
  return transferred
}
