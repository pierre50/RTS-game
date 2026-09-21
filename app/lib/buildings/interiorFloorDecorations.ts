export type InteriorFloorDecoration = {
  allowBorderPlacement?: boolean
  frame: number
  offsetX: number
  offsetY: number
}

// Ground-level hides and rugs from the reference montage; offsets are in isometric pixels.
const FLOOR_DECORATIONS: Record<string, readonly InteriorFloorDecoration[]> = {
  TownCenter: [
    { frame: 17, offsetX: -96, offsetY: -32 },
    { frame: 41, offsetX: 0, offsetY: -48 },
    { frame: 17, offsetX: 96, offsetY: -32 },
    { frame: 41, offsetX: -32, offsetY: 40 },
    { frame: 17, offsetX: 0, offsetY: 80 },
  ],
  House: [
    { frame: 41, offsetX: 64, offsetY: 16 },
    { frame: 41, offsetX: 160, offsetY: 32, allowBorderPlacement: true },
    { frame: 17, offsetX: 0, offsetY: 48 },
    { frame: 17, offsetX: 96, offsetY: 68, allowBorderPlacement: true },
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
