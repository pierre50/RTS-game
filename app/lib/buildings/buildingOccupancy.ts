import { interiorSaveSpaceId } from '../../serialization/InteriorBuildingSave'
import { BUILDING_TYPES } from '../../constants/entities'

type CapacityOwner = { label?: string; factionId?: string | null; name?: string }
type CapacityBuilding = {
  type: string
  i?: number
  j?: number
  label?: string
  spaceId?: string | null
  interiorPortalId?: string
  interiorOwner?: string
  isBuilt?: boolean
  isDead?: boolean
  isDestroyed?: boolean
  buildingUpgrade?: unknown
  interiorBuildings?: CapacityBuilding[]
  plannedBedLabels?: string[]
  owner?: CapacityOwner | null
}

const ownerKey = (owner: CapacityOwner) => owner.label || owner.factionId || owner.name || 'owner'
const usable = (building: CapacityBuilding) =>
  Boolean(building.isBuilt && !building.isDead && !building.isDestroyed && !building.buildingUpgrade)
const interiorId = (building: CapacityBuilding, owner: CapacityOwner) =>
  interiorSaveSpaceId(ownerKey(building.owner ?? owner), { ...building, i: building.i ?? 0, j: building.j ?? 0 })

/** A bed is one durable population place, whether occupied or currently empty. */
function getBuildingPopulationCapacity(building: { type: string }): number {
  return building.type === BUILDING_TYPES.campBedroll ? 1 : 0
}

/** Reads both unloaded saved interiors and instantiated furniture, without creating either. */
export function getPopulationCapacityFromBuildings(
  buildings: readonly CapacityBuilding[],
  owner: CapacityOwner = {}
): number {
  const parents = new Map(buildings.map(building => [interiorId(building, owner), building]))
  const seen = new Set<CapacityBuilding>()
  const labels = new Set<string>()
  const count = (building: CapacityBuilding): number => {
    if (!usable(building) || seen.has(building)) return 0
    if (building.interiorOwner && building.interiorOwner !== ownerKey(owner)) return 0
    if (building.label && labels.has(building.label)) return 0
    seen.add(building)
    if (building.label) labels.add(building.label)
    const planned = (building.plannedBedLabels ?? []).filter(label => {
      if (labels.has(label)) return false
      labels.add(label)
      return true
    }).length
    return (
      planned +
      getBuildingPopulationCapacity(building) +
      (building.interiorBuildings ?? []).reduce((sum, child) => sum + count(child), 0)
    )
  }
  return buildings.reduce((total, building) => {
    if (building.spaceId && building.spaceId !== 'outside') {
      const parent = parents.get(building.spaceId)
      if (!parent || !usable(parent)) return total
    }
    return total + count(building)
  }, 0)
}

export function refreshPopulationCapacity(
  owner: CapacityOwner & { buildings?: readonly CapacityBuilding[]; populationMax?: number },
  pendingBuilding?: CapacityBuilding
): number {
  const buildings = [...(owner.buildings ?? [])]
  // onBuilt may run inside the constructor, before registration in the owner's list.
  if (pendingBuilding && !buildings.includes(pendingBuilding)) buildings.push(pendingBuilding)
  owner.populationMax = getPopulationCapacityFromBuildings(buildings, owner)
  return owner.populationMax
}

/** Physical beds in this room, including beds temporarily unavailable during renovation. */
export function getBuildingBedCount(
  building: CapacityBuilding,
  owner: CapacityOwner & { buildings?: readonly CapacityBuilding[] }
): number {
  const spaceId = interiorId(building, owner)
  return getPopulationCapacityFromBuildings(
    [
      ...(building.plannedBedLabels ?? []).map(label => ({ type: BUILDING_TYPES.campBedroll, label, isBuilt: true })),
      ...(building.interiorBuildings ?? []),
      ...(owner.buildings ?? [])
        .filter(child => child.spaceId === spaceId)
        .map(child => ({ ...child, spaceId: undefined })),
    ],
    owner
  )
}
