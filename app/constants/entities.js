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
  governmentCenter: 'GovernmentCenter',
  archeryRange: 'ArcheryRange',
  stable: 'Stable',
  academy: 'Academy',
  watchTower: 'WatchTower',
  sentryTower: 'SentryTower',
}

export const UNIT_TYPES = {
  villager: 'Villager',
  priest: 'Priest',
  clubman: 'Clubman',
  axeman: 'Axeman',
  shortSwordsman: 'ShortSwordsman',
  broadSwordsman: 'BroadSwordsman',
  longSwordsman: 'LongSwordsman',
  hoplite: 'Hoplite',
  bowman: 'Bowman',
  improvedBowman: 'ImprovedBowman',
  compositeBowman: 'CompositeBowman',
  chariotArcher: 'ChariotArcher',
  scout: 'Scout',
  fishingBoat: 'FishingBoat',
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

export const TYPE_ACTION = {
  Stone: ACTION_TYPES.minestone,
  Gold: ACTION_TYPES.minegold,
  Berrybush: ACTION_TYPES.forageberry,
  Tree: ACTION_TYPES.chopwood,
  Fish: ACTION_TYPES.fishing,
}
