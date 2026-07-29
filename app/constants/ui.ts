export const MENU_INFO_IDS = {
  loading: 'info-loading',
  hitPoints: 'hit-points',
  population: 'population',
  populationText: 'population-text',
  quantity: 'quantity',
  quantityText: 'quantity-text',
  loadingText: 'loading-text',
  name: 'name',
  type: 'type',
  civ: 'civ',
  icon: 'icon',
}

export const LABEL_TYPES = {
  sprite: 'sprite',
  sail: 'sail',
  fishingNet: 'fishingNet',
  color: 'color',
  shadow: 'shadow',
  deco: 'deco',
  fire: 'fire',
  selection: 'selection',
  healthBar: 'healthBar',
  powerBar: 'powerBar',
  buildingFog: 'building',
  mouseBuilding: 'mouseBuilding',
  floor: 'floor',
  set: 'set',
  dither: 'dither',
  fogOverlay: 'fogOverlay',
  commRadius: 'commRadius',
  commSelection: 'commSelection',
}

export const COLOR_WHITE = 0xffffff
export const COLOR_RED = 0xff0000
export const COLOR_GREEN = 0x00ff00
export const COLOR_GOLD = 0xffcc33

export const COMM_SELECTION_COLOR = COLOR_WHITE
export const COMM_INDICATOR_FILL_COLOR = COLOR_GOLD
export const COMM_INDICATOR_FILL_ALPHA = 0.08
export const COMM_INDICATOR_STROKE_COLOR = COLOR_GOLD
export const COMM_INDICATOR_STROKE_ALPHA = 0.65
export const COMM_INDICATOR_STROKE_WIDTH = 1

export const TRAINING_PREVIEW_LIGHT_COLOR = 0xffd36b
export const TRAINING_PREVIEW_LIGHT_INTENSITY_MIN = 0.05
export const TRAINING_PREVIEW_LIGHT_INTENSITY_MAX = 0.22
export const TRAINING_PREVIEW_LIGHT_PULSE_MS = 1400

// Mirrors the --status-health-* / --status-progress-* gradient tokens in app/styles/tokens.css,
// so the in-game health bar reads as the same "chiseled stone/metal" style as the menu HP bars.
export const HEALTH_BAR_BORDER_COLOR = 0x1f0c09
export const HEALTH_BAR_TRACK_GRADIENT_TOP = 0x9c2e1b
export const HEALTH_BAR_TRACK_GRADIENT_BOTTOM = 0x701d12
export const HEALTH_BAR_FILL_GRADIENT_TOP = 0x52c44f
export const HEALTH_BAR_FILL_GRADIENT_BOTTOM = 0x24822b

export const COMMAND_POINTER_SHEET_ID = 'pointers/move-target'
