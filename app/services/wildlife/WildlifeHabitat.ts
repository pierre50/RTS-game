import { FAMILY_TYPES } from '../../constants'
import type { GameContextLike } from '../../types/context'
import type { RuntimeCell } from '../../types/map'
import type { SaveEntityState } from '../../types/save'

const WILDLIFE_HOME_RADIUS = 8
export const WILDLIFE_CALM_MS = 10000
const BUILDING_CLEARANCE = 6
const RELOCATION_RADIUS = 24
export type WildlifeHome = NonNullable<SaveEntityState['wildlife']>

export function outsideWildlifeHome(point: { i: number; j: number }, home: WildlifeHome): boolean {
  return Math.hypot(point.i - home.homeI, point.j - home.homeJ) > WILDLIFE_HOME_RADIUS
}

/** Permanent habitat suitability deliberately ignores passing units and animals. */
export function habitatCells(
  context: GameContextLike,
  home: { homeI: number; homeJ: number },
  radius = WILDLIFE_HOME_RADIUS
): RuntimeCell[] {
  const grid = context.map.grid
  const buildings: { i: number; j: number }[] = []
  const scan = radius + BUILDING_CLEARANCE
  for (let i = home.homeI - scan; i <= home.homeI + scan; i++)
    for (let j = home.homeJ - scan; j <= home.homeJ + scan; j++) {
      const entity = grid[i]?.[j]?.has
      if (entity?.family === FAMILY_TYPES.building && !entity.isDead && !entity.isDestroyed) buildings.push({ i, j })
    }
  const cells: RuntimeCell[] = []
  for (let i = home.homeI - radius; i <= home.homeI + radius; i++)
    for (let j = home.homeJ - radius; j <= home.homeJ + radius; j++) {
      if (Math.hypot(i - home.homeI, j - home.homeJ) > radius) continue
      const cell = grid[i]?.[j]
      if (!cell || cell.category === 'Water' || cell.border || cell.inclined) continue
      if (cell.solid && cell.has?.family !== FAMILY_TYPES.unit && cell.has?.family !== FAMILY_TYPES.animal) continue
      if (buildings.some(b => Math.max(Math.abs(b.i - i), Math.abs(b.j - j)) <= BUILDING_CLEARANCE)) continue
      cells.push(cell)
    }
  return cells
}

/** Keep partially usable homes. A fully occupied home must remain blocked across a day boundary. */
export function maintainWildlifeHome(context: GameContextLike, home: WildlifeHome, day: number): void {
  if (home.checkedDay === day) return
  home.checkedDay = day
  if (habitatCells(context, home).length) {
    delete home.blockedSinceDay
    return
  }
  home.blockedSinceDay ??= day
  if (day <= home.blockedSinceDay) return
  const origin = { homeI: home.originI ?? home.homeI, homeJ: home.originJ ?? home.homeJ }
  const candidates = habitatCells(context, origin, RELOCATION_RADIUS)
  candidates.sort(
    (a, b) => Math.hypot(a.i - home.homeI, a.j - home.homeJ) - Math.hypot(b.i - home.homeI, b.j - home.homeJ)
  )
  const next = candidates[0]
  if (!next) return
  home.originI = origin.homeI
  home.originJ = origin.homeJ
  home.homeI = next.i
  home.homeJ = next.j
  delete home.blockedSinceDay
}
