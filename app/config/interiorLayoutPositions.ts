import positions from './interiorLayoutPositions.json'

export type InteriorFurniturePosition = { offsetI: number; offsetJ: number }
export type InteriorFurnitureItem = InteriorFurniturePosition & { type: string; mirrored: boolean }
export type InteriorRug = {
  frame: number
  offsetX: number
  offsetY: number
  mirrored?: boolean
  allowBorderPlacement?: boolean
}
export type InteriorFurnitureLayout = {
  roomSize?: number
  items: Record<string, InteriorFurnitureItem>
  rugs?: InteriorRug[]
}
export type InteriorLayoutPositions = Record<
  string,
  Record<string, Record<string, InteriorFurniturePosition> | InteriorFurnitureLayout>
>

export function isFullInteriorLayout(
  layout: InteriorLayoutPositions[string][string]
): layout is InteriorFurnitureLayout {
  return Object.hasOwn(layout, 'items')
}

/** Authored offsets from the room center, in the non-mirrored orientation. */
export const INTERIOR_LAYOUT_POSITIONS: InteriorLayoutPositions = positions
