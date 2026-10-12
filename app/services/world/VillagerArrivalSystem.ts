import { planVillagerArrivals } from '../../lib/population/villagerArrivals'
import { getVacantHomes, getFreeHouseBedLabels, reconcileHouseholds } from '../../lib/housing/households'
import { refreshPopulationCapacity } from '../../lib/buildings/buildingOccupancy'
import { isStaticSettlement } from '../../config/settlementProfiles'
import { PLAYER_TYPES, UNIT_TYPES } from '../../constants'
import type { DailyWorldEvent, DailyWorldEventHandler } from '../dailyEvents/DailyWorldEventTypes'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity, UnitCreationExtra } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

export { calculateVillagerArrivals } from '../../lib/population/villagerArrivals'

export class VillagerArrivalSystem implements DailyWorldEventHandler {
  context: GameContextLike

  constructor(context: GameContextLike) {
    this.context = context
  }

  handleDailyWorldEvent(event: DailyWorldEvent): void {
    for (const player of this.context.players ?? []) {
      if (!this.canGrow(player)) continue
      reconcileHouseholds(player)
      refreshPopulationCapacity(player)
      for (const plan of planVillagerArrivals(player)) {
        if (plan.count > 0) this.placeArrivals(event, player, plan.count, plan.centers as BuildingEntity[])
      }
    }
  }

  private canGrow(player: PlayerLike): boolean {
    if (isStaticSettlement(player)) return false
    return player.type === PLAYER_TYPES.human || player.type === PLAYER_TYPES.ai
  }

  private placeArrivals(
    event: DailyWorldEvent,
    player: PlayerLike,
    targetArrivals: number,
    centers: BuildingEntity[]
  ): void {
    const buildings = centers.filter(building => typeof building.placeUnit === 'function')
    if (!buildings.length) return

    const claimedBeds = new Set<string>()
    let arrived = 0
    for (let index = 0; index < targetArrivals; index++) {
      if (this.tryPlaceArrival(player, buildings, index, claimedBeds)) {
        reconcileHouseholds(player)
        arrived++
      }
    }

    if (arrived <= 0) return
    event.report?.add({ count: arrived, player, type: 'villager-arrival' })
    if (player.isPlayed) this.context.menu?.updateTopbar?.()
  }

  private tryPlaceArrival(
    player: PlayerLike,
    buildings: BuildingEntity[],
    offset: number,
    claimedBeds: Set<string>
  ): boolean {
    for (let attempts = 0; attempts < buildings.length; attempts++) {
      const building = buildings[(offset + attempts) % buildings.length]
      const home = getVacantHomes(player, building).find(house =>
        getFreeHouseBedLabels(player, house).some(bed => !claimedBeds.has(bed))
      )
      if (!home) continue
      const bed = getFreeHouseBedLabels(player, home).find(bed => !claimedBeds.has(bed))!
      const extra: UnitCreationExtra = {
        ...this.getArrivalExtra(),
        villageHome: { id: `${player.label}:${building.label}`, i: building.i, j: building.j, spaceId: 'outside' },
        homeHouseLabel: home.label,
        homeBedLabel: bed,
      }
      if (building.placeUnit?.(UNIT_TYPES.villager, extra, { consumePopulationSlot: true })) {
        claimedBeds.add(bed)
        return true
      }
    }
    return false
  }

  private getArrivalExtra(): UnitCreationExtra {
    const gender: 'male' | 'female' = this.context.map.random() < 0.5 ? 'male' : 'female'
    return { gender, appearanceVariants: { gender } }
  }

  destroy(): void {}
}
