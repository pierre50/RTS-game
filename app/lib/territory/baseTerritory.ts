import { BASE_TERRITORY_RADIUS } from '../../config/territory'

type Point = { i: number; j: number; spaceId?: string | null }
type TerritoryBuilding = Point & {
  type: string
  owner?: { label?: string } | null
  label?: string
  interiorPortalId?: string
  isBuilt?: boolean
  isDead?: boolean
  isDestroyed?: boolean
  interiorBuildings?: TerritoryBuilding[]
}
export type TerritoryOwner = { label?: string; buildings?: TerritoryBuilding[] }
export type BaseTerritory<T extends TerritoryOwner = TerritoryOwner> = { owner: T; center: TerritoryBuilding }

/** Interior coordinates belong to their exterior building; caves have no village position. */
function territoryPosition(point: Point, owners: readonly TerritoryOwner[]): Point | null {
  if (!point.spaceId || point.spaceId === 'outside') return point
  for (const owner of owners) {
    const parent = owner.buildings?.find(
      building =>
        !building.isDead &&
        !building.isDestroyed &&
        (point.spaceId === `interior:${building.interiorPortalId || `${owner.label}:${building.label}`}` ||
          building.interiorBuildings?.some(child => child.spaceId === point.spaceId))
    )
    if (parent && (!parent.spaceId || parent.spaceId === 'outside')) return parent
  }
  return null
}

export function getBaseTerritory<T extends TerritoryOwner>(
  point: Point,
  owners: readonly T[]
): BaseTerritory<T> | null {
  const position = territoryPosition(point, owners)
  if (!position) return null
  let nearest: BaseTerritory<T> | null = null
  let best = BASE_TERRITORY_RADIUS ** 2
  for (const owner of owners) {
    for (const center of owner.buildings ?? []) {
      if (
        center.type !== 'TownCenter' ||
        (center.owner && center.owner !== owner && center.owner.label !== owner.label) ||
        center.isBuilt === false ||
        center.isDead ||
        center.isDestroyed ||
        (center.spaceId && center.spaceId !== 'outside')
      )
        continue
      const distance = (position.i - center.i) ** 2 + (position.j - center.j) ** 2
      if (distance <= best && (!nearest || distance < best)) {
        nearest = { owner, center }
        best = distance
      }
    }
  }
  return nearest
}
