import type { SaveGridPoint } from '../../types/save'

type Point = SaveGridPoint
export type VillageDistrictPlan = {
  square: Point
  farms: Point
  homes: Point[]
  defence: Point
  towers: Point[]
}

/** Rotate the village around the terrain's best farming side, instead of imposing
 * a compass direction on every civilisation or shoreline. */
export function planVillageDistricts(center: Point, usable: (point: Point) => boolean): VillageDistrictPlan {
  const directions = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ] as const
  const candidates = directions
    .map(([di, dj]) => {
      const point = { i: center.i + di * 12, j: center.j + dj * 12 }
      let available = 0
      for (let i = point.i - 5; i <= point.i + 5; i++)
        for (let j = point.j - 5; j <= point.j + 5; j++) if (usable({ i, j })) available++
      return { di, dj, available }
    })
    .sort((a, b) => b.available - a.available)
  const { di, dj } = candidates[0]
  const point = (forward: number, sideways: number): Point => ({
    i: center.i + di * forward - dj * sideways,
    j: center.j + dj * forward + di * sideways,
  })
  return {
    square: point(0, 6),
    farms: point(12, 0),
    homes: [point(-7, 7), point(-7, -7)],
    defence: point(0, -12),
    towers: [point(3, -19), point(-15, 6)],
  }
}
