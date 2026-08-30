import { RESOURCE_TYPES, SHEET_TYPES } from '../constants'
import { getGaiaAnimals, getInstanceZIndex, isWheatMature, updateInstanceVisibility } from '../lib'
import type { GameContextLike } from '../types/context'
import type { AnimalEntity, ResourceEntity, RuntimeEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { SaveEntityState } from '../types/save'
import { NATURAL_REGROWTH_CONFIG } from '../config/gameplay'
import type { DailyWorldEvent, DailyWorldEventHandler } from './DailyWorldEventTypes'

type AnimalSlot = Partial<AnimalEntity> & {
  horseColor?: string
  i: number
  isDestroyed?: boolean
  j: number
  label?: string
  trapPrey?: boolean
  type: string
}
type GaiaWithRespawnSlots = PlayerLike & {
  animals?: AnimalSlot[]
  createAnimal?: (options: { horseColor?: string; i: number; j: number; type: string }) => AnimalEntity
}
type MapWithNaturalResourceRespawn = GameContextLike['map'] & {
  naturalResourceRespawnSlots?: SaveEntityState[]
  respawnNaturalResource?: (slot: SaveEntityState) => boolean
}

function maxQuantity(entity: RuntimeEntity): number {
  const total = Number((entity as { totalQuantity?: number }).totalQuantity)
  return Number.isFinite(total) && total > 0 ? total : Math.max(0, entity.quantity ?? 0)
}

function regrowQuantity(entity: RuntimeEntity, ratio: number): boolean {
  if (entity.isDestroyed || entity.isDead) return false
  const total = maxQuantity(entity)
  if (total <= 0) return false
  const current = Math.max(0, entity.quantity ?? 0)
  const next = Math.min(total, current + Math.max(1, Math.ceil(total * ratio)))
  if (next === current) return false
  entity.quantity = next
  entity.updateTexture?.()
  return true
}

function reviveAnimal(animal: AnimalEntity): boolean {
  if (!animal.isDead || animal.isDestroyed) return false
  if (animal.trapPrey) return false
  const totalHitPoints = Number(animal.totalHitPoints)
  const totalQuantity = Number(animal.totalQuantity)
  if (!Number.isFinite(totalHitPoints) || totalHitPoints <= 0) return false
  if (!Number.isFinite(totalQuantity) || totalQuantity <= 0) return false

  const map = animal.context?.map
  const cell = map?.grid?.[animal.i]?.[animal.j]
  if (!map || !cell || (cell.has && cell.has !== animal)) return false

  animal.stopInterval?.()
  animal.stopTimeout?.()
  animal.isDead = false
  animal.hitPoints = totalHitPoints
  animal.quantity = totalQuantity
  animal.action = null
  animal.path = []
  animal.dest = null
  animal.realDest = null
  animal.previousDest = null
  animal.inactif = true
  animal.isFleeing = false
  cell.corpses?.delete(animal)
  cell.place(animal)
  cell.solid = true
  animal.currentCell = cell
  animal.zIndex = getInstanceZIndex(animal)
  animal.setTextures?.(SHEET_TYPES.standing)
  animal.setAltitude?.(0)
  map.addToInstanceBucket(animal)
  animal.owner && (animal.owner.population = (animal.owner.population ?? 0) + 1)
  updateInstanceVisibility(animal)
  animal.animalBehavior?.start?.()
  return true
}

function respawnDestroyedAnimal(context: GameContextLike, slot: AnimalSlot, slots: AnimalSlot[]): boolean {
  if (!slot.isDestroyed) return false
  if (slot.trapPrey) return false
  const gaia = context.map.gaia as GaiaWithRespawnSlots | null | undefined
  const cell = context.map.grid?.[slot.i]?.[slot.j]
  if (!gaia?.createAnimal || !cell || cell.has) return false

  const previousIndex = slots.indexOf(slot)
  const animal = gaia.createAnimal({
    horseColor: slot.horseColor,
    i: slot.i,
    j: slot.j,
    type: slot.type,
  })
  if (slot.label) animal.label = slot.label

  const createdIndex = slots.indexOf(animal)
  if (previousIndex >= 0) slots[previousIndex] = animal
  if (createdIndex >= 0 && createdIndex !== previousIndex) slots.splice(createdIndex, 1)
  updateInstanceVisibility(animal)
  return true
}

export class NaturalRegrowthSystem implements DailyWorldEventHandler {
  context: GameContextLike

  constructor(context: GameContextLike) {
    this.context = context
  }

  handleDailyWorldEvent(_event: DailyWorldEvent): void {
    this.applyDailyRegrowth()
  }

  applyDailyRegrowth(): void {
    const { map, menu } = this.context
    let resourcesChanged = false
    const respawnMap = map as MapWithNaturalResourceRespawn
    const respawnSlots = respawnMap.naturalResourceRespawnSlots ?? []

    for (let index = respawnSlots.length - 1; index >= 0; index--) {
      const slot = respawnSlots[index]
      if (respawnMap.respawnNaturalResource?.(slot)) {
        respawnSlots.splice(index, 1)
        resourcesChanged = true
      }
    }

    for (const resource of map.resources as Set<ResourceEntity>) {
      if (resource.type === RESOURCE_TYPES.berrybush) {
        resourcesChanged = regrowQuantity(resource, NATURAL_REGROWTH_CONFIG.berryRegrowRatioPerDay) || resourcesChanged
      } else if (resource.type === RESOURCE_TYPES.wheat) {
        resourcesChanged =
          (isWheatMature(resource)
            ? regrowQuantity(resource, NATURAL_REGROWTH_CONFIG.wheatRegrowRatioPerDay)
            : resource.advanceWheatGrowth?.(NATURAL_REGROWTH_CONFIG.wheatGrowthFramesPerDay)) || resourcesChanged
      }
    }

    const animalSlots = getGaiaAnimals(map.gaia) as AnimalSlot[]
    let animalsChanged = false
    for (const animal of [...animalSlots]) {
      if (animal.isDestroyed) {
        animalsChanged = respawnDestroyedAnimal(this.context, animal, animalSlots) || animalsChanged
      } else {
        animalsChanged = reviveAnimal(animal as AnimalEntity) || animalsChanged
      }
    }

    if (resourcesChanged && menu.isMiniMapActive?.() !== false) menu.updateResourcesMiniMap?.()
    if (animalsChanged) {
      if (menu.isMiniMapActive?.() !== false) {
        menu.updateResourcesMiniMap?.()
        menu.updatePlayerMiniMapEvt?.(this.context.player)
      }
    }
  }
  destroy(): void {}
}
