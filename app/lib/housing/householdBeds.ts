import { getHouseInteriorLevel } from './houseLevels'
import { HOUSE_LEVELS } from '../../config/housing'
import { BUILDING_TYPES } from '../../constants/entities'
import { interiorSaveSpaceId } from '../../serialization/InteriorBuildingSave'
import { getBuildingInteriorDecorationLayout } from '../buildings/furniture/interiorDecorations'
import type { HouseholdOwner, HouseholdBuilding } from './households'

const living = (entity: { isDead?: boolean; isDestroyed?: boolean }) => !entity.isDead && !entity.isDestroyed
const ownerKey = (owner: HouseholdOwner) => owner.label || owner.factionId || owner.name || 'owner'
const householdSpaceId = (owner: HouseholdOwner, house: HouseholdBuilding) =>
  interiorSaveSpaceId(ownerKey(owner), { ...house, i: house.i ?? 0, j: house.j ?? 0 })

/** These are the exact IDs used by the interior preset, not a second furniture layout. */
export function prepareHouseBedPlans(owner: HouseholdOwner): void {
  for (const house of owner.buildings ?? []) {
    if (house.type !== BUILDING_TYPES.house || !living(house)) continue
    const spaceId = householdSpaceId(owner, house)
    const level = getHouseInteriorLevel(house)
    const previous = Number.isInteger(house.houseInteriorLevel)
      ? Math.max(0, Math.min(house.houseInteriorLevel!, HOUSE_LEVELS.length - 1))
      : undefined
    const existing =
      house.interiorBuildings !== undefined ||
      owner.context?.map?.spaces?.has(spaceId) ||
      owner.buildings?.some(b => b.spaceId === spaceId)
    const growth = previous != null && level > previous
    if (!growth && (existing || house.plannedBedLabels !== undefined)) {
      house.houseInteriorLevel = level
      continue
    }
    if (owner.type !== 'Human' && !owner.isPlayed) house.interiorUnfurnished ??= false
    house.interiorPortalId ??= spaceId.slice('interior:'.length)
    const previousBeds = growth ? HOUSE_LEVELS[previous]!.beds : 0
    const added = getBuildingInteriorDecorationLayout(house)
      .filter(item => item.type === BUILDING_TYPES.campBedroll)
      .slice(previousBeds)
      .map(item => `${spaceId}:default:${item.key}`)
    house.plannedBedLabels = [...new Set([...(house.plannedBedLabels ?? []), ...added])]
    house.houseInteriorLevel = level
  }
}

export function getHouseBedLabels(owner: HouseholdOwner, house: HouseholdBuilding): string[] {
  const spaceId = householdSpaceId(owner, house)
  const beds = [...(house.interiorBuildings ?? []), ...(owner.buildings ?? []).filter(b => b.spaceId === spaceId)]
  return [
    ...new Set([
      ...(house.plannedBedLabels ?? []),
      ...beds
        .filter(
          b =>
            b.type === BUILDING_TYPES.campBedroll &&
            b.isBuilt &&
            living(b) &&
            (!b.interiorOwner || b.interiorOwner === ownerKey(owner))
        )
        .flatMap(b => (b.label ? [b.label] : [])),
    ]),
  ].sort()
}
