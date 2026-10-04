import { BUILDING_TYPES } from '../../constants/entities'
import { interiorSaveSpaceId } from '../../serialization/InteriorBuildingSave'
import { getBuildingInteriorDecorationLayout } from '../buildings/interiorDecorations'
import { usesInteriorPreset } from '../buildings/interiorFurnitureCatalog'
import type { HouseholdOwner, HouseholdBuilding } from './households'

const living = (entity: { isDead?: boolean; isDestroyed?: boolean }) => !entity.isDead && !entity.isDestroyed
const ownerKey = (owner: HouseholdOwner) => owner.label || owner.factionId || owner.name || 'owner'
const householdSpaceId = (owner: HouseholdOwner, house: HouseholdBuilding) =>
  interiorSaveSpaceId(ownerKey(owner), { ...house, i: house.i ?? 0, j: house.j ?? 0 })

/** These are the exact IDs used by the interior preset, not a second furniture layout. */
export function prepareHouseBedPlans(owner: HouseholdOwner): void {
  for (const house of owner.buildings ?? []) {
    if (
      house.type !== BUILDING_TYPES.house ||
      !living(house) ||
      house.interiorBuildings !== undefined ||
      house.plannedBedLabels !== undefined ||
      !usesInteriorPreset({ ...house, owner })
    )
      continue
    const spaceId = householdSpaceId(owner, house)
    if (owner.context?.map?.spaces?.has(spaceId)) continue
    if (owner.buildings?.some(building => building.spaceId === spaceId)) continue
    house.interiorPortalId ??= spaceId.slice('interior:'.length)
    house.plannedBedLabels = getBuildingInteriorDecorationLayout(house)
      .filter(item => item.type === BUILDING_TYPES.campBedroll)
      .map(item => `${spaceId}:default:${item.key}`)
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
