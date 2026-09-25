import type { PackedCellStore } from './PackedCellStore'

export const packedCellStores = new WeakMap<object, PackedCellStore>()

export function getPackedCellStore(grid: object): PackedCellStore | undefined {
  return packedCellStores.get(grid)
}
