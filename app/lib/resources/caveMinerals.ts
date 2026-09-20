import type { CaveMineralState } from '../../types/cave'

const caveMinerals = new WeakSet<object>()

export function isCaveMineral(target: object | null | undefined): boolean {
  return Boolean(target && caveMinerals.has(target))
}

export function canGatherCaveMineral(source: { type?: string }, target: object): boolean {
  return !isCaveMineral(target) || source.type === 'Hero'
}

// The parent cave owns the saved stock, including exhausted nodes. Binding the
// live quantity keeps partial mining and depletion persistent without respawns.
export function bindCaveMineralState(resource: { quantity?: number }, state: CaveMineralState): void {
  caveMinerals.add(resource)
  Object.defineProperty(resource, 'quantity', {
    configurable: true,
    enumerable: true,
    get: () => state.quantity,
    set: (quantity: number) => {
      state.quantity = Math.max(0, Math.min(state.totalQuantity, Math.floor(quantity)))
    },
  })
}
