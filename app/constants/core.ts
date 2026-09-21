export { CELL_WIDTH, CELL_HEIGHT } from './gridGeometry'
export { CELL_DEPTH } from './relief'

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
// Shared alpha fade-out duration for decaying map props (unit/animal corpses, spent ground
// projectiles) — see app/lib/entityFade.ts. One constant so every fade reads at the same pace.
export const FADE_DURATION_MS = 120
// Seconds a projectile that missed and stuck in the ground sticks around before it starts
// fading away (purely decorative — see Projectile.landOnGround).
export const ARROW_GROUND_TIME = 3
export const POPULATION_MAX = 200

// Active le passage d'âge joueur + IA. Les bâtiments utilisent le meilleur asset d'âge disponible
// et retombent sur l'âge précédent quand l'âge suivant n'a pas encore d'art dédié.
export const AGE_UP_ENABLED = true
