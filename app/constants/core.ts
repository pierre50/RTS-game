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
export const ARROW_GROUND_TIME = 30
export const MAX_SELECT_UNITS = 10
export const POPULATION_MAX = 200

// Kill-switch temporaire : passage à l'âge suivant désactivé (joueur + IA)
export const AGE_UP_ENABLED = false
export const AGE_TECHNOLOGIES = new Set(['ToolAge', 'BronzeAge', 'IronAge'])

// Tant que AGE_UP_ENABLED est false, l'IA reste bloquée à l'âge 0 : les conditions "age >= N"
// atteignables (N <= 1) sont considérées comme remplies pour elle (WatchTower/SmallWall, qui ont un
// asset dans buildings/shared/ et restent affichables à l'âge 0). On s'arrête à 1 et pas plus haut :
// Academy/GovernmentCenter (age >= 2) n'ont pas d'asset dans shared/, uniquement des sprites
// civ-spécifiques à partir du bucket d'âge 2 des JSON de civilisation — les débloquer les ferait
// apparaître avec un rendu qui ne correspond pas à un civ/âge 0. Les valeurs sentinelles
// (ex: "age > 99", bâtiments non implémentés) restent bloquées quoi qu'il arrive.
export const AGE_GATE_MAX_UNLOCKABLE_VALUE = 1
