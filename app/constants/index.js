export const CELL_WIDTH = 64
export const CELL_HEIGHT = 32
export const CELL_DEPTH = 16

export const ACCELERATOR = 1.5
export const STEP_TIME = 20

export const IS_MOBILE = window.innerWidth <= 800 && window.innerHeight <= 600
export const LONG_CLICK_DURATION = 200

export const RESOURCE_TYPES = {
  tree: 'Tree',
  berrybush: 'Berrybush',
  stone: 'Stone',
  gold: 'Gold',
  salmon: 'Salmon',
}

export const BUILDING_TYPES = {
  house: 'House',
  dock: 'Dock',
  townCenter: 'TownCenter',
  farm: 'Farm',
  storagePit: 'StoragePit',
  granary: 'Granary',
  barracks: 'Barracks',
  market: 'Market',
}

export const UNIT_TYPES = {
  villager: 'Villager',
  priest: 'Priest',
  clubman: 'Clubman',
}

export const MENU_INFO_IDS = {
  loading: 'loading',
  hitPoints: 'hit-points',
  population: 'population',
  populationText: 'population-text',
  quantity: 'quantity',
  quantityText: 'quantity-text',
  loadingText: 'loading-text',
  type: 'type',
  civ: 'civ',
  icon: 'icon',
}

export const LABEL_TYPES = {
  sprite: 'sprite',
  color: 'color',
  deco: 'deco',
  fire: 'fire',
  selection: 'selection',
  buildingFog: 'building',
  mouseBuilding: 'mouseBuilding',
  floor: 'floor',
  set: 'set',
}

export const SHEET_TYPES = {
  walking: 'walkingSheet',
  action: 'actionSheet',
  standing: 'standingSheet',
  corpse: 'corpseSheet',
  dying: 'dyingSheet',
  harvest: 'harvestSheet',
}

export const PLAYER_TYPES = {
  human: 'Human',
  ai: 'AI',
  gaia: 'Gaia',
}

export const FAMILY_TYPES = {
  animal: 'animal',
  building: 'building',
  cell: 'cell',
  projectile: 'projectile',
  resource: 'resource',
  unit: 'unit',
  player: 'player',
}

export const WORK_TYPES = {
  fisher: 'fisher',
  hunter: 'hunter',
  farmer: 'farmer',
  forager: 'forager',
  woodcutter: 'woodcutter',
  stoneminer: 'stoneminer',
  goldminer: 'goldminer',
  builder: 'builder',
  attacker: 'attacker',
  healer: 'healer',
}

export const ACTION_TYPES = {
  delivery: 'delivery',
  takemeat: 'takemeat',
  hunt: 'hunt',
  attack: 'attack',
  fishing: 'fishing',
  build: 'build',
  farm: 'farm',
  forageberry: 'forageberry',
  minegold: 'minegold',
  minestone: 'minestone',
  chopwood: 'chopwood',
  heal: 'heal',
}

export const LOADING_TYPES = {
  meat: 'meat',
  wheat: 'wheat',
  berry: 'berry',
  fish: 'fish',
  stone: 'stone',
  gold: 'gold',
  wood: 'wood',
}

export const WORK_FOOD_TYPES = [WORK_TYPES.fisher, WORK_TYPES.hunter, WORK_TYPES.farmer, WORK_TYPES.forager]
export const LOADING_FOOD_TYPES = [LOADING_TYPES.meat, LOADING_TYPES.wheat, LOADING_TYPES.berry, LOADING_TYPES.fish]

export const COLOR_WHITE = 0xffffff
export const COLOR_BLACK = 0x000000
export const COLOR_GREY = 0x808080
export const COLOR_RED = 0xff0000
export const COLOR_ORANGE = 0xffa500
export const COLOR_YELLOW = 0xffff00
export const COLOR_GREEN = 0x008000
export const COLOR_BLUE = 0x0000ff
export const COLOR_INDIGO = 0x4b0082
export const COLOR_VIOLET = 0xee82ee
export const COLOR_BONE = 0xe2dac2
export const COLOR_SHIP_GREY = 0x3c3b3d
export const COLOR_FOG = 0x999999
export const COLOR_FLASHY_GREEN = 0x00ff00
export const COLOR_ARROW = 0xe8e3df

export const TYPE_ACTION = {
  Stone: ACTION_TYPES.minestone,
  Gold: ACTION_TYPES.minegold,
  Berrybush: ACTION_TYPES.forageberry,
  Tree: ACTION_TYPES.chopwood,
  Fish: ACTION_TYPES.fishing,
}

export const CORPSE_TIME = 120
export const RUBBLE_TIME = 120
export const MAX_SELECT_UNITS = 10
export const POPULATION_MAX = 200
