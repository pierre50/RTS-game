import { constructionAssignment } from './constructionAssignments'
import { VILLAGE_ACTIVITY_RADIUS } from '../../config/villageActivity'
import { DAILY_CONSUMPTION_PER_VILLAGER } from '../../constants'
import type { ResourceAmount } from '../../types/common'
import { getBaseTerritory } from '../territory/baseTerritory'
import {
  materialAmount,
  missingConstructionMaterialsForNextPoint,
  remainingConstructionMaterials,
  type MaterialSite,
} from './constructionMaterials'
import { type DepotReservePolicy } from './depotReserves'

export type Point = { i: number; j: number; spaceId?: string | null }

export type CollectiveMember = Point & {
  followingHero?: boolean
  controlMode?: string
  type: string
  label?: string
  isDead?: boolean
  isDestroyed?: boolean
  villageHome?: Point
  inventory?: { resources?: ResourceAmount; equipment?: string[]; activeWeapons?: { melee?: string | null } }
  autonomousJob?: string | null
  inactif?: boolean
  action?: string | null
  collectiveTask?: string | null
}

export type CollectiveSite = Point &
  MaterialSite & {
    type: string
    label?: string
    isDead?: boolean
    isDestroyed?: boolean
    inventory?: { resources?: ResourceAmount }
    reservePolicy?: DepotReservePolicy
  }

export type Owner = {
  units?: CollectiveMember[]
  population?: number
  age?: number
  label?: string
  populationMax?: number
  buildings?: CollectiveSite[]
}

export function collectiveAnchor(owner: Owner, unit: CollectiveMember): CollectiveSite | Point {
  const point = unit.followingHero || unit.controlMode === 'hero' ? unit : (unit.villageHome ?? unit)
  const territory = getBaseTerritory(point, [owner])
  if (territory) return territory.center
  return (
    (owner.buildings ?? [])
      .filter(
        site =>
          !site.isBuilt &&
          !site.isDead &&
          !site.isDestroyed &&
          (site.spaceId ?? 'outside') === (point.spaceId ?? 'outside') &&
          Math.hypot(site.i - point.i, site.j - point.j) <= VILLAGE_ACTIVITY_RADIUS
      )
      .sort((a, b) => Math.hypot(a.i - point.i, a.j - point.j) - Math.hypot(b.i - point.i, b.j - point.j))[0] ?? point
  )
}

export function belongsToSettlement(owner: Owner, anchor: Point, point: Point): boolean {
  const home = getBaseTerritory(anchor, [owner])
  const target = getBaseTerritory(point, [owner])
  if (home || target) return home?.center === target?.center
  return (
    (point.spaceId ?? 'outside') === (anchor.spaceId ?? 'outside') &&
    Math.hypot(anchor.i - point.i, anchor.j - point.j) <= VILLAGE_ACTIVITY_RADIUS
  )
}

/** The same local project is used for planning, delivery and offline routing. */
export function activeConstructionSite(owner: Owner, unit: CollectiveMember): CollectiveSite | undefined {
  const delivery = unit as CollectiveMember & {
    resourceDeliveryState?: { building?: CollectiveSite | null } | null
    resourceDelivery?: { building?: string | [number, number, string?] | null }
  }
  const reference = delivery.resourceDelivery?.building
  const depot =
    delivery.resourceDeliveryState?.building ??
    owner.buildings?.find(site => site.label === (typeof reference === 'string' ? reference : reference?.[2]))
  const anchor = collectiveAnchor(owner, {
    ...unit,
    villageHome: unit.villageHome ?? (unit.spaceId && unit.spaceId !== 'outside' ? (depot ?? undefined) : undefined),
  })
  const assigned = constructionAssignment(unit)?.site
  if (assigned && owner.buildings?.includes(assigned) && belongsToSettlement(owner, anchor, assigned)) return assigned
  return owner.buildings?.find(
    site => !site.isBuilt && !site.isDead && !site.isDestroyed && belongsToSettlement(owner, anchor, site)
  )
}

export function readyConstructionSite(owner: Owner, unit: CollectiveMember): CollectiveSite | undefined {
  const site = activeConstructionSite(owner, unit)
  const bag = unit.inventory?.resources ?? {}
  if (!site || materialAmount(bag, 'food') < (DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0)) return
  if (Object.keys(missingConstructionMaterialsForNextPoint(site, bag)).length) return
  if (
    !Object.keys(remainingConstructionMaterials(site)).some(key => materialAmount(bag, key as keyof ResourceAmount) > 0)
  )
    return
  return site
}

/** Keep a balanced construction load; only excess or unrelated cargo may be deposited. */
export function constructionCargoReserve(owner: Owner, unit: CollectiveMember, resource: keyof ResourceAmount): number {
  const site = activeConstructionSite(owner, unit)
  if (!site) return 0
  const anchor = collectiveAnchor(owner, unit)
  return (owner.buildings ?? []).reduce(
    (total, project) =>
      !project.isBuilt && !project.isDead && !project.isDestroyed && belongsToSettlement(owner, anchor, project)
        ? total + (remainingConstructionMaterials(project)[resource] ?? 0)
        : total,
    0
  )
}
