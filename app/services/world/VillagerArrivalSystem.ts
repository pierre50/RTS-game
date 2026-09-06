import {
  BUILDING_TYPES,
  DAILY_CONSUMPTION_PER_VILLAGER,
  PLAYER_TYPES,
  UNIT_TYPES,
  VILLAGER_ARRIVAL_CONFIG,
} from '../../constants'
import { getPlayerResourceTotals } from '../../lib/resources/playerResourceTotals'
import type { DailyWorldEvent, DailyWorldEventHandler } from '../DailyWorldEventTypes'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, UnitCreationExtra } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

type VillagerArrivalInput = {
  foodAvailable: number
  population: number
  populationMax: number
}

function calculateVillagerArrivals({ foodAvailable, population, populationMax }: VillagerArrivalInput): number {
  const freeHousing = Math.max(0, Math.min(populationMax, Number.POSITIVE_INFINITY) - population)
  if (population <= 0 || freeHousing <= 0) return 0

  const dailyFood = DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0
  if (dailyFood <= 0) return 0

  const foodReserveNeeded = dailyFood * population * VILLAGER_ARRIVAL_CONFIG.currentPopulationReserveDays
  const foodPerNewVillager = dailyFood * VILLAGER_ARRIVAL_CONFIG.newVillagerReserveDays
  const foodSupportedGrowth = Math.floor((foodAvailable - foodReserveNeeded) / foodPerNewVillager)
  if (foodSupportedGrowth <= 0) return 0

  const growthDemand = Math.max(1, Math.floor(population * VILLAGER_ARRIVAL_CONFIG.growthRate))
  return Math.max(
    0,
    Math.min(growthDemand, freeHousing, foodSupportedGrowth, VILLAGER_ARRIVAL_CONFIG.maxArrivalsPerDay)
  )
}

export class VillagerArrivalSystem implements DailyWorldEventHandler {
  context: GameContextLike

  constructor(context: GameContextLike) {
    this.context = context
  }

  handleDailyWorldEvent(event: DailyWorldEvent): void {
    for (const player of this.context.players ?? []) {
      if (!this.canGrow(player)) continue
      const targetArrivals = calculateVillagerArrivals({
        foodAvailable: getPlayerResourceTotals(player).food,
        population: player.population,
        populationMax: player.populationMax,
      })
      if (targetArrivals > 0) this.placeArrivals(event, player, targetArrivals)
    }
  }

  private canGrow(player: PlayerLike): boolean {
    return player.type === PLAYER_TYPES.human || player.type === PLAYER_TYPES.ai
  }

  private getArrivalBuildings(player: PlayerLike): BuildingEntity[] {
    return (player.buildings ?? []).filter(
      building =>
        building.type === BUILDING_TYPES.townCenter &&
        building.isBuilt &&
        !building.isDead &&
        !building.isDestroyed &&
        typeof building.placeUnit === 'function'
    )
  }

  private placeArrivals(event: DailyWorldEvent, player: PlayerLike, targetArrivals: number): void {
    const buildings = this.getArrivalBuildings(player)
    if (!buildings.length) return

    let arrived = 0
    for (let index = 0; index < targetArrivals; index++) {
      if (this.tryPlaceArrival(buildings, index)) {
        arrived++
      }
    }

    if (arrived <= 0) return
    event.report?.add({ count: arrived, player, type: 'villager-arrival' })
    if (player.isPlayed) this.context.menu?.updateTopbar?.()
  }

  private tryPlaceArrival(buildings: BuildingEntity[], offset: number): boolean {
    for (let attempts = 0; attempts < buildings.length; attempts++) {
      const building = buildings[(offset + attempts) % buildings.length]
      if (building.placeUnit?.(UNIT_TYPES.villager, this.getArrivalExtra(), { consumePopulationSlot: true }))
        return true
    }
    return false
  }

  private getArrivalExtra(): UnitCreationExtra {
    const gender: 'male' | 'female' = this.context.map.random() < 0.5 ? 'male' : 'female'
    return { gender, appearanceVariants: { gender } }
  }

  destroy(): void {}
}
