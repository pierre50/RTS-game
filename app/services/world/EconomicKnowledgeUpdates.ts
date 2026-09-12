const revisions = new WeakMap<object, number>()
const checks = new WeakMap<object, { map: object; revision: number; explored: number; time: number }>()

export function invalidateEconomicKnowledge(map: object): void {
  revisions.set(map, (revisions.get(map) ?? 0) + 1)
}

/** Events and new exploration trigger immediate refresh; moving wildlife has a fallback. */
export function shouldRefreshEconomicKnowledge(owner: object, map: object, now: number, explored: number): boolean {
  const revision = revisions.get(map) ?? 0
  const previous = checks.get(owner)
  if (
    previous?.map === map &&
    previous.revision === revision &&
    previous.explored === explored &&
    now >= previous.time &&
    now - previous.time < 15000
  )
    return false
  checks.set(owner, { map, revision, explored, time: now })
  return true
}
