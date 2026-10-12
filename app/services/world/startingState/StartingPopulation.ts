import { prepareHouseBedPlans } from '../../../lib/housing/householdBeds'
import { getPopulationCapacityFromBuildings } from '../../../lib/buildings/buildingOccupancy'
import { resolveUnitIdentity } from '../../../lib/units/unitIdentity'
import { getRandomUnitName } from '../../../config/name'
import { createSeededRandom } from '../../../lib/random'
import { startingVillagerInventory } from '../../../lib/economy/startingProvisions'
import { isLiving } from '../offline/OfflineWorldSpatial'
import { addStartingBuilding, type StartingVillage } from './StartingVillageContext'
import type { SaveEntityState } from '../../../types/save'

export function startingPopulation({ buildings, profile }: StartingVillage, units: SaveEntityState[]): number {
  const queued = buildings.flatMap(b => b.trainingQueue ?? []).length
  const additions = Object.entries(profile.units).reduce(
    (total, [type, count]) => total + Math.max(0, count - units.filter(u => u.type === type && isLiving(u)).length),
    0
  )
  return units.filter(isLiving).length + queued + additions
}

export function addStartingHouses(village: StartingVillage): void {
  const residents = (village.player.units ?? []).filter(isLiving)
  // Houses must not compete with the temporary spawn positions of their own residents.
  for (const unit of residents) village.spatial.release(unit)
  prepareHouseBedPlans(village.player)
  while (getPopulationCapacityFromBuildings(village.buildings, village.player) < residents.length) {
    addStartingBuilding(village, 'House')
    prepareHouseBedPlans(village.player)
  }
}

export function placeStartingResidents(village: StartingVillage): void {
  const residents = (village.player.units ?? []).filter(isLiving)
  for (const unit of residents) {
    const point = village.spatial.findNear(unit, 24)
    if (!point) throw new Error(`No safe home arrival for ${unit.label}`)
    village.spatial.move(unit, point)
  }
}

export function addStartingUnits(village: StartingVillage, units: SaveEntityState[]): void {
  const { player, index, center, spatial } = village
  for (const [type, count] of Object.entries(village.profile.units)) {
    const existing = units.filter(u => u.type === type && isLiving(u)).length
    const config = village.rules.unitConfig(index, type)
    if (count && !(Number(config.totalHitPoints) > 0)) throw new Error(`Unknown starting unit ${type}`)
    for (let n = existing; n < count; n++) {
      const point = spatial.findNear(center, 20)
      if (!point) throw new Error(`No space for required ${type} in ${player.civ}`)
      const unit: SaveEntityState = {
        ...point,
        type,
        label: `start:${player.label ?? index}:unit:${units.length}`,
        hitPoints: Number(config.totalHitPoints),
        totalHitPoints: Number(config.totalHitPoints),
        inactif: true,
        ...(type === 'Villager' ? startingVillagerState(n, units) : {}),
      }
      units.push(unit)
      spatial.reserve(unit)
    }
  }
  for (const unit of units) {
    unit.gender = resolveUnitIdentity({ ...unit, owner: player }).gender
    unit.name ??= getRandomUnitName(player.civ, unit.gender, createSeededRandom(`name:${unit.label}`))
  }
}

function startingVillagerState(n: number, residents: SaveEntityState[]): Partial<SaveEntityState> {
  return {
    inventory: startingVillagerInventory(residents),
    gender: n % 2 ? ('female' as const) : ('male' as const),
    autonomousJob: null,
  }
}
