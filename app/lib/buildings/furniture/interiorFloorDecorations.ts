import { getInteriorLayoutLevel } from '../interiorLayoutLevel'
import {
  INTERIOR_LAYOUT_POSITIONS,
  isFullInteriorLayout,
  type InteriorRug,
} from '../../../config/interiorLayoutPositions'
export type InteriorFloorDecoration = InteriorRug

// Ground-level hides and rugs from the reference montage; offsets are in isometric pixels.
const FLOOR_DECORATIONS: Record<string, readonly InteriorFloorDecoration[]> = {
  TownCenter: [
    { frame: 17, offsetX: -96, offsetY: -32 },
    { frame: 41, offsetX: 0, offsetY: -48 },
    { frame: 17, offsetX: 96, offsetY: -32 },
    { frame: 41, offsetX: -32, offsetY: 40 },
    { frame: 17, offsetX: 0, offsetY: 80 },
  ],
  Barracks: [{ frame: 18, offsetX: 2, offsetY: -15.5 }],
  Temple: [
    { frame: 17, offsetX: -29, offsetY: -34 },
    { frame: 41, offsetX: 66, offsetY: -18.5 },
    { frame: 41, offsetX: -3, offsetY: 15.5 },
  ],
  WatchTower: [{ frame: 17, offsetX: -1, offsetY: 17 }],
}

export function getInteriorFloorDecorations(type: string, level = 0): readonly InteriorFloorDecoration[] {
  const layout = INTERIOR_LAYOUT_POSITIONS[type]?.[getInteriorLayoutLevel({ type, buildingLevel: level })]
  return layout && isFullInteriorLayout(layout) && layout.rugs !== undefined
    ? layout.rugs
    : (FLOOR_DECORATIONS[type] ?? [])
}
