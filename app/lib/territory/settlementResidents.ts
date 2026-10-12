import { getBaseTerritory } from './baseTerritory'

type Position = { i: number; j: number; spaceId?: string | null }
type Resident = Position & {
  type: string
  controlMode?: string
  homeHouseLabel?: string
  villageHome?: Position & { id?: string }
  collectiveHome?: Position
  isDead?: boolean
  isDestroyed?: boolean
  banditCampAnchor?: unknown
  campPatrolAnchor?: unknown
  roadJourney?: unknown
}
type Building = Position & {
  townCenterId?: string
  type: string
  label?: string
  isBuilt?: boolean
  isDead?: boolean
  isDestroyed?: boolean
  interiorPortalId?: string
  interiorBuildings?: Building[]
}

/** Migrate unassigned residents once. Travelling never changes their home town.
 * Keep a lost town's identity: losing its center must not grant another town's stock. */
export function reconcileSettlementResidents(owner: {
  label?: string
  units?: Resident[]
  buildings?: Building[]
}): void {
  // Resolve exteriors first so detached interior records inherit their building's town.
  const buildings = [
    ...new Set((owner.buildings ?? []).flatMap(building => [building, ...(building.interiorBuildings ?? [])])),
  ]
  for (const building of buildings.sort(
    (a, b) =>
      Number(Boolean(a.spaceId && a.spaceId !== 'outside')) - Number(Boolean(b.spaceId && b.spaceId !== 'outside'))
  )) {
    if (building.isDead || building.isDestroyed) continue
    if (building.type === 'TownCenter') {
      if (building.isBuilt !== false && building.label) building.townCenterId = `${owner.label}:${building.label}`
      continue
    }
    if (building.townCenterId) continue
    const center = getBaseTerritory(building, [owner])?.center
    if (center?.label) building.townCenterId = `${owner.label}:${center.label}`
  }
  for (const unit of owner.units ?? []) {
    if (
      unit.villageHome ||
      unit.isDead ||
      unit.isDestroyed ||
      unit.type === 'Hero' ||
      unit.controlMode === 'hero' ||
      unit.banditCampAnchor ||
      unit.campPatrolAnchor ||
      unit.roadJourney
    )
      continue
    const house = unit.homeHouseLabel
      ? owner.buildings?.find(
          building => building.label === unit.homeHouseLabel && !building.isDead && !building.isDestroyed
        )
      : undefined
    const territory = getBaseTerritory(house ?? unit.collectiveHome ?? unit, [owner])
    const center = territory?.center
    if (!center?.label) continue
    unit.villageHome = { id: `${owner.label}:${center.label}`, i: center.i, j: center.j, spaceId: 'outside' }
  }
}
