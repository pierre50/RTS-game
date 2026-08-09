export const MOUNTED_RIDER_LEGS_SHEET = 'units/rider-legs'
export const MOUNTED_RIDER_Y_OFFSET = -25
export const MOUNTED_RIDER_VERTICAL_VIEW_X_OFFSET = 1
export const MOUNTED_RIDER_CUT_Y = 51
export const MOUNTED_RIDER_LEGS_ATTACH_Y = 47

export type MountedRiderBaseDirection = 'north' | 'west' | 'south'

export const MOUNTED_RIDER_LEG_TOP_BY_DIRECTION: Record<MountedRiderBaseDirection, number> = {
  north: 24,
  west: 19,
  south: 24,
}

export const MOUNTED_RIDER_LEG_ALIGNMENT_BY_DIRECTION: Record<
  MountedRiderBaseDirection,
  { riderCx: number; legsCx: number; extraX: number }
> = {
  north: { riderCx: 30, legsCx: 24, extraX: 1 },
  west: { riderCx: 33, legsCx: 18, extraX: -4 },
  south: { riderCx: 30, legsCx: 26, extraX: 1 },
}

export const MOUNTED_HORSE_BOB: Record<MountedRiderBaseDirection, number[]> = {
  north: [0, 1, 2, 1, 0, -1],
  west: [0, -1, 0, 1, 2, 0],
  south: [0, 1, 2, 1, 0, -1],
}

export function mountedRiderBaseDirection(direction: string): MountedRiderBaseDirection {
  if (direction.includes('north')) return 'north'
  if (direction.includes('south')) return 'south'
  return 'west'
}

export function mountedRiderXOffset(direction: string): number {
  return direction.includes('north') || direction.includes('south') ? MOUNTED_RIDER_VERTICAL_VIEW_X_OFFSET : 0
}

export function mountedRiderLegOffset(direction: string, scale = 1): { x: number; y: number } {
  const baseDirection = mountedRiderBaseDirection(direction)
  const alignment = MOUNTED_RIDER_LEG_ALIGNMENT_BY_DIRECTION[baseDirection]
  const opaqueTop = MOUNTED_RIDER_LEG_TOP_BY_DIRECTION[baseDirection] ?? 0
  return {
    x: (alignment.riderCx - alignment.legsCx + alignment.extraX) * scale,
    y: (MOUNTED_RIDER_LEGS_ATTACH_Y + 1 - opaqueTop) * scale,
  }
}
