import type { GridPosition } from '../../types/grid'

export function sameGridCell(
  a: Pick<GridPosition, 'i' | 'j'> | null | undefined,
  b: Pick<GridPosition, 'i' | 'j'> | null | undefined
): boolean {
  return Boolean(a && b && a.i === b.i && a.j === b.j)
}
