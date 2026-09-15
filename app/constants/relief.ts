// Height of one terrain level in screen pixels. Logical entity positions stay
// on the flat grid; this lift is applied to sprites, shadows and equipment.
export const CELL_DEPTH = 16

// Ground movement: projected walking speed on steep faces, in either direction.
export const RELIEF_SLOPE_WALK_SPEED = 0.85
export const RELIEF_MOVEMENT_SAMPLE_DISTANCE = 0.25
