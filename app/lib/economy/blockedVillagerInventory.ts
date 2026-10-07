import type { UnitEntity } from '../../types/entities'
import { findResourceDeliveryTarget, getUnitResourceCarryRemaining } from '../resources/resourceDelivery'
import { isHeroControlled } from '../units/unitControl'
import { belongsToSettlement, collectiveAnchor } from './collectiveConstruction'
import { constructionAssignment, assignConstructionWork } from './constructionAssignments'
import { hasConstructionWork, materialAmount, remainingConstructionMaterials } from './constructionMaterials'
import { planCollectiveTasks } from './collectiveTasks'

const DISPOSABLE = ['wood', 'stone', 'gold', 'copper', 'tin', 'iron'] as const

/** Preview a useful replacement order before touching the real bag. */
export function planBlockedVillagerRecovery(
  unit: UnitEntity,
  members: UnitEntity[],
  acceptsJob: (unit: UnitEntity, job: string) => boolean
) {
  const owner = unit.owner
  const bag = unit.inventory?.resources
  if (!owner || !bag || unit.type !== 'Villager' || isHeroControlled(unit) || unit.followingHero) return
  if (getUnitResourceCarryRemaining(unit) > 0 || findResourceDeliveryTarget(unit)) return
  const anchor = collectiveAnchor(owner, unit)
  const sites = owner.buildings.filter(site => hasConstructionWork(site) && belongsToSettlement(owner, anchor, site))
  // A useful load must reach its construction site instead of being thrown away.
  if (
    sites.some(site =>
      Object.keys(remainingConstructionMaterials(site)).some(key => materialAmount(bag, key as keyof typeof bag) > 0)
    )
  )
    return
  const resource = DISPOSABLE.find(key => (bag[key] ?? 0) >= 1)
  if (!resource) return
  const preview = { ...unit, inventory: { ...unit.inventory, resources: { ...bag, [resource]: bag[resource]! - 1 } } }
  const task = planCollectiveTasks(
    owner,
    [preview],
    members.map(member => (member === unit ? preview : member)),
    (_preview, job) => acceptsJob(unit, job)
  ).get(preview)
  // Only free a slot for a different resource, never for idle movement or building.
  if (!task || (task.job === 'construction' && !task.pickup) || task.job === resource) return
  const previousAssignment = constructionAssignment(unit)
  return {
    task,
    apply() {
      bag[resource] = (bag[resource] ?? 0) - 1
      assignConstructionWork(unit, constructionAssignment(preview))
    },
    rollback() {
      bag[resource] = (bag[resource] ?? 0) + 1
      assignConstructionWork(unit, previousAssignment)
    },
  }
}
