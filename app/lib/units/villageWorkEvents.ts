/** Coalesced notifications; multiple changes before the next scheduler tick count as one wake-up. */
const pending = new WeakSet<object>()
export function notifyVillageWorkChanged(owner: object | null | undefined): void {
  if (owner) pending.add(owner)
}
export function consumeVillageWorkChange(owner: object): boolean {
  const changed = pending.has(owner)
  pending.delete(owner)
  return changed
}
