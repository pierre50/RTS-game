export const CELL_WIDTH = 64
export const CELL_HEIGHT = 32
export const CELL_DEPTH = 16

// Sole visual elevation offset per relief step. Entity x/y are always flat (relief never affects
// pathing/collision/zIndex) — this is the only place relief becomes visible, applied to sprite/
// shadow/equipment layers only. Matches the terrain border art (checking terrain/*/texture.png:
// the lighter/darker riser band between the flat top and the ground in front of it is a full
// CELL_DEPTH-tall cliff face, not a gradual ramp), so the lift reads as "climbing that cliff"
// instead of a faint nudge.
export const RELIEF_SPRITE_LIFT_PER_STEP = CELL_DEPTH
export const RELIEF_CLIMB_SPEED_MULTIPLIER = 0.8
// Per-update easing toward the target lift (and the hero's slope slowdown). Path movement
// feeds a continuous target (blended along the walk), so easing there only filters jitter.
// The hero's target moves in half-steps as they cross cells — this rate is tuned slow enough
// (time constant ≈ one tile of travel) that those half-steps merge into one continuous slope
// instead of reading as two distinct bumps.
export const RELIEF_LIFT_SMOOTHING = 0.03

export const STEP_TIME = 20
export const BUCKET_SIZE = 8
// Keeps resources, ambient animals, and decorative ground sets from spawning too close
// to shoreline border cells. Set to 0 to only block the water-border cell itself.
export const WATER_BORDER_PLACEMENT_CLEARANCE = 2

export const IS_MOBILE =
  window.matchMedia('(pointer: coarse)').matches || (window.innerWidth <= 800 && window.innerHeight <= 600)
export const LONG_CLICK_DURATION = IS_MOBILE ? 280 : 200
export const TOUCH_DRAG_THRESHOLD = 12
export const MINIMAP_DRAG_THRESHOLD = 8

export const CORPSE_TIME = 120
export const RUBBLE_TIME = 120
// Shared alpha fade-out duration for decaying map props (unit/animal corpses, spent ground
// projectiles) — see app/lib/entityFade.ts. One constant so every fade reads at the same pace.
export const FADE_DURATION_MS = 2000
// Seconds a projectile that missed and stuck in the ground sticks around before it starts
// fading away (purely decorative — see Projectile.landOnGround).
export const ARROW_GROUND_TIME = 3
export const POPULATION_MAX = 200

// Active le passage d'âge joueur + IA. Les bâtiments utilisent le meilleur asset d'âge disponible
// et retombent sur l'âge précédent quand l'âge suivant n'a pas encore d'art dédié.
export const AGE_UP_ENABLED = true
export const AGE_TECHNOLOGIES = new Set(['ToolAge', 'BronzeAge', 'IronAge'])

// Fallback conservé pour les tests/configs qui désactivent AGE_UP_ENABLED : les conditions
// atteignables (N <= 1) restent considérées comme remplies, les sentinelles restent bloquantes.
export const AGE_GATE_MAX_UNLOCKABLE_VALUE = 1
