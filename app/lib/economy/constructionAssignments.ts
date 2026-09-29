import type { CollectiveMember, CollectiveSite } from './collectiveConstruction'
import type { ResourceAmount } from '../../types/common'

type Assignment = { site: CollectiveSite; resource?: keyof ResourceAmount; target?: number }
const assignments = new WeakMap<CollectiveMember, Assignment>()

/** Transient claims are rebuilt by the shared live/offline planner after loading. */
export function constructionAssignment(unit: CollectiveMember): Assignment | undefined {
  const assignment = assignments.get(unit)
  return assignment && !assignment.site.isBuilt && !assignment.site.isDead && !assignment.site.isDestroyed
    ? assignment
    : undefined
}

export function assignConstructionWork(unit: CollectiveMember, assignment?: Assignment): void {
  if (assignment) assignments.set(unit, assignment)
  else assignments.delete(unit)
}
