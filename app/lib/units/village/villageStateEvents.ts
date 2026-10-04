import { notifyVillageWorkChanged } from './villageWorkEvents'

const revisions = new WeakMap<object, number>()
/** Roster, orders, buildings and availability. Resource increments use the separate work channel. */
export function notifyVillageStateChanged(owner: object | null | undefined): void {
  if (!owner) return
  revisions.set(owner, (revisions.get(owner) ?? 0) + 1)
  notifyVillageWorkChanged(owner)
}
export function villageStateRevision(owner: object): number {
  return revisions.get(owner) ?? 0
}
