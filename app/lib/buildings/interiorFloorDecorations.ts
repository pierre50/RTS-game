export type InteriorFloorDecoration = {
  frame: number
  offsetX: number
  offsetY: number
}

// Ground-level hides and rugs from the reference montage; offsets are in isometric pixels.
const FLOOR_DECORATIONS: Record<string, readonly InteriorFloorDecoration[]> = {
  TownCenter: [
    { frame: 17, offsetX: 3, offsetY: -83 },
    { frame: 41, offsetX: 94, offsetY: -67.5 },
    { frame: 17, offsetX: -123, offsetY: -48 },
    { frame: 17, offsetX: -91, offsetY: -4 },
    { frame: 17, offsetX: 62, offsetY: 16 },
    { frame: 41, offsetX: 32, offsetY: 63.5 },
  ],
  House: [
    { frame: 17, offsetX: 64, offsetY: -47 },
    { frame: 17, offsetX: -35, offsetY: -36 },
    { frame: 17, offsetX: 69, offsetY: 14 },
    { frame: 41, offsetX: -33, offsetY: 32.5 },
  ],
  Barracks: [{ frame: 18, offsetX: 2, offsetY: -15.5 }],
  Temple: [
    { frame: 17, offsetX: -29, offsetY: -34 },
    { frame: 41, offsetX: 66, offsetY: -18.5 },
    { frame: 41, offsetX: -3, offsetY: 15.5 },
  ],
  WatchTower: [{ frame: 17, offsetX: -1, offsetY: 17 }],
}

export function getInteriorFloorDecorations(type: string): readonly InteriorFloorDecoration[] {
  return FLOOR_DECORATIONS[type] ?? []
}
