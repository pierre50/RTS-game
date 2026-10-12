import type { SaveGridPoint } from '../../../types/save'

/** Plan whole patches before planting: a locally attractive patch can strand the remaining fields. */
export function selectStartingFieldSites(
  candidates: SaveGridPoint[],
  size: number,
  count: number
): SaveGridPoint[] | null {
  if (count === 0) return []
  if (candidates.length < count) return null
  // Even perfect packing cannot fit more area than the union of available cells.
  const cells = new Set<string>()
  for (const point of candidates)
    for (let di = 0; di < size; di++) for (let dj = 0; dj < size; dj++) cells.add(`${point.i + di},${point.j + dj}`)
  if (cells.size < count * size * size) return null
  for (let index = 0; index <= candidates.length - count; index++) {
    const point = candidates[index]
    const remaining = candidates
      .slice(index + 1)
      .filter(other => Math.abs(point.i - other.i) >= size || Math.abs(point.j - other.j) >= size)
    const tail = selectStartingFieldSites(remaining, size, count - 1)
    if (tail) return [point, ...tail]
  }
  return null
}
