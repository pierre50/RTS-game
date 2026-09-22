import { definedProperties } from '../../lib/definedProperties'
import { BUILDING_TYPES } from '../../constants/entities'
import { TRAP_PREY_TYPES } from '../../lib/buildings/trapRules'
import { MARKET_RESTOCK_INTERVAL_DAYS, resetMarketEquipmentStock } from '../../lib/equipment/equipmentMarket'
import type { SaveEntityState, SerializedSave } from '../../types/save'
import { distance, entityKey, isLiving, type OfflineWorldSpatial } from './OfflineWorldSpatial'
import { stopOfflineTask, type OfflineWorkRules, type OfflineWorldReport } from './OfflineWorldWork'

function eventRandom(state: SerializedSave, entity: SaveEntityState, day: number, event: string): () => number {
  let seed = 2166136261
  const world = state.world?.worldRegionId ?? state.config?.worldRegionId ?? state.world?.seed ?? 'world'
  for (const char of `${world}:${entityKey(entity)}:${day}:${event}`)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619)
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0
    return (seed >>> 0) / 4294967296
  }
}

function observed(trap: SaveEntityState, state: SerializedSave, rules: OfflineWorkRules): boolean {
  return state.players.some((player, index) => {
    const sees = (entity: SaveEntityState, sight: unknown) =>
      entity !== trap &&
      isLiving(entity) &&
      !entity.followingHero &&
      entity.controlMode !== 'hero' &&
      entity.type !== 'Hero' &&
      !entity.spaceId &&
      distance(entity, trap) <= Math.max(0, Number(sight) || 0)
    return (
      (player.units ?? []).some(unit => sees(unit, rules.unitConfig(index, unit.type).sight)) ||
      (player.buildings ?? []).some(building => sees(building, rules.buildingConfig(index, building.type).sight))
    )
  })
}

function renewAnimals(
  state: SerializedSave,
  day: number,
  spatial: OfflineWorldSpatial,
  rules: OfflineWorkRules,
  report: OfflineWorldReport
): void {
  for (const animal of state.animals) {
    if (animal.trapPrey) continue
    const config = rules.animalConfig?.(animal.type)
    if (animal.isDead) {
      const health = animal.totalHitPoints ?? Number(config?.totalHitPoints)
      const quantity = animal.totalQuantity ?? Number(config?.totalQuantity)
      if (!(health > 0) || !(quantity > 0) || !spatial.available(animal, animal)) continue
      animal.isDead = false
      animal.isDestroyed = false
      animal.hitPoints = health
      animal.quantity = quantity
      delete animal.inventory
      delete animal.corpseMaterialDecayRemainingMs
      stopOfflineTask(animal)
      animal.isFleeing = false
      animal.currentSheet = 'standing'
      animal.currentFrame = 0
      spatial.reserve(animal)
      report.animalsRevived++
      continue
    }
    if (
      !isLiving(animal) ||
      !config?.ambientMovement ||
      animal.tamingStatus === 'tamed' ||
      animal.action === 'attack' ||
      animal.isFleeing ||
      observed(animal, state, rules)
    )
      continue
    const random = eventRandom(state, animal, day, 'walk')
    const range = Math.max(1, Math.min(8, Math.floor(config.ambientWalkRange ?? 2)))
    for (let attempt = 0; attempt < 24; attempt++) {
      const point = {
        i: animal.i + Math.floor(random() * (range * 2 + 1)) - range,
        j: animal.j + Math.floor(random() * (range * 2 + 1)) - range,
      }
      if (distance(animal, point) === 0 || !spatial.naturalCell(point) || !spatial.reachable(animal, point)) continue
      spatial.move(animal, point)
      stopOfflineTask(animal)
      animal.currentSheet = 'standing'
      animal.currentFrame = 0
      report.animalsMoved++
      break
    }
  }
}

export function applyOfflineDailyEvents(
  state: SerializedSave,
  day: number,
  spatial: OfflineWorldSpatial,
  rules: OfflineWorkRules,
  report: OfflineWorldReport
): void {
  renewAnimals(state, day, spatial, rules, report)
  for (const player of state.players) {
    for (const building of player.buildings ?? []) {
      if (!isLiving(building) || !building.isBuilt) continue
      if (building.type === BUILDING_TYPES.market && day > 0 && day % MARKET_RESTOCK_INTERVAL_DAYS === 0) {
        resetMarketEquipmentStock(building, definedProperties({ age: player.age, civilization: player.civ }))
        report.marketsRestocked++
      }
      if (building.type === BUILDING_TYPES.trap && !building.containedAnimalType && !observed(building, state, rules)) {
        const random = eventRandom(state, building, day, 'trap')
        const prey = TRAP_PREY_TYPES[Math.floor(random() * TRAP_PREY_TYPES.length)]
        if (!prey) continue
        building.containedAnimalType = prey
        report.trapsFilled++
      }
    }
  }
}
