export const RESOURCE_TYPES = {
  tree: 'Tree',
  berrybush: 'Berrybush',
  stone: 'Stone',
  gold: 'Gold',
}

export const BUILDING_TYPES = {
  house: 'House',
  townCenter: 'TownCenter',
  farm: 'Farm',
  storagePit: 'StoragePit',
  granary: 'Granary',
  barracks: 'Barracks',
  market: 'Market',
  temple: 'Temple',
  archeryRange: 'ArcheryRange',
  stable: 'Stable',
  watchTower: 'WatchTower',
  sentryTower: 'SentryTower',
  smallWall: 'SmallWall',
}

export const UNIT_TYPES = {
  hero: 'Hero',
  villager: 'Villager',
  chief: 'Chief',
  priest: 'Priest',
  clubman: 'Clubman',
  axeman: 'Axeman',
  shortSwordsman: 'ShortSwordsman',
  broadSwordsman: 'BroadSwordsman',
  longSwordsman: 'LongSwordsman',
  bowman: 'Bowman',
  improvedBowman: 'ImprovedBowman',
  compositeBowman: 'CompositeBowman',
  scout: 'Scout',
}

export const MOUNTED_HORSE_SPEED_BONUS = 0.4

export const PLAYER_TYPES = {
  human: 'Human',
  ai: 'AI',
  gaia: 'Gaia',
}

export const FAMILY_TYPES = {
  animal: 'animal',
  building: 'building',
  cell: 'cell',
  floatingItem: 'floatingItem',
  projectile: 'projectile',
  resource: 'resource',
  unit: 'unit',
  player: 'player',
}

export const WORK_TYPES = {
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
  train: 'train',
  build: 'build',
  farm: 'farm',
  forageberry: 'forageberry',
  minegold: 'minegold',
  minestone: 'minestone',
  chopwood: 'chopwood',
  heal: 'heal',
  convert: 'convert',
}

export const LOADING_TYPES = {
  meat: 'meat',
  wheat: 'wheat',
  berry: 'berry',
  stone: 'stone',
  gold: 'gold',
  wood: 'wood',
}

export const WORK_FOOD_TYPES = [WORK_TYPES.hunter, WORK_TYPES.farmer, WORK_TYPES.forager]
export const LOADING_FOOD_TYPES = [LOADING_TYPES.meat, LOADING_TYPES.wheat, LOADING_TYPES.berry]

export const TYPE_ACTION = {
  Stone: ACTION_TYPES.minestone,
  Gold: ACTION_TYPES.minegold,
  Berrybush: ACTION_TYPES.forageberry,
  Tree: ACTION_TYPES.chopwood,
}
