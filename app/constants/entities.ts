export const RESOURCE_TYPES = {
  tree: 'Tree',
  berrybush: 'Berrybush',
  wheat: 'Wheat',
  medicinalHerb: 'MedicinalHerb',
  toxicHerb: 'ToxicHerb',
  fiberPlant: 'FiberPlant',
  stone: 'Stone',
  gold: 'Gold',
  copper: 'Copper',
  iron: 'Iron',
}

export const WILDGRASS_RESOURCE_TYPES = new Set<string>([
  RESOURCE_TYPES.medicinalHerb,
  RESOURCE_TYPES.toxicHerb,
  RESOURCE_TYPES.fiberPlant,
])

export const FORAGE_RESOURCE_TYPES = new Set<string>([RESOURCE_TYPES.berrybush, ...WILDGRASS_RESOURCE_TYPES])

export const PASSABLE_RESOURCE_TYPES = new Set<string>(WILDGRASS_RESOURCE_TYPES)

export const RESOURCE_NAMES = ['wood', 'food', 'stone', 'gold', 'copper', 'iron'] as const

// Real, storable resource kinds. 'food' from RESOURCE_NAMES is a virtual aggregate (berry + meat + wheat)
// used only for costs/display — it is never physically stored in an inventory.resources bag.
export const FOOD_RESOURCE_NAMES = ['berry', 'meat', 'wheat'] as const

export const RESOURCE_STORAGE_NAMES = [
  'wood',
  'berry',
  'meat',
  'wheat',
  'herb',
  'toxicHerb',
  'fiber',
  'feather',
  'leather',
  'sinew',
  'stone',
  'gold',
  'copper',
  'iron',
] as const

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
  smallWall: 'SmallWall',
  trap: 'Trap',
  chest: 'Chest',
  fireCamp: 'FireCamp',
  campTotemPlain: 'CampTotemPlain',
  campTotemHorns: 'CampTotemHorns',
  campTotemSkull: 'CampTotemSkull',
  campFencePost: 'CampFencePost',
  campBoneSmall: 'CampBoneSmall',
  campRockPile: 'CampRockPile',
  campSkull: 'CampSkull',
  campAnimalBones: 'CampAnimalBones',
  campMeatRack: 'CampMeatRack',
  campDryingRack: 'CampDryingRack',
  campBucket: 'CampBucket',
  campCrate: 'CampCrate',
  campJarSmall: 'CampJarSmall',
  campJarLarge: 'CampJarLarge',
}

export const CAMP_DECORATION_BUILDING_TYPES = [
  BUILDING_TYPES.campTotemPlain,
  BUILDING_TYPES.campTotemHorns,
  BUILDING_TYPES.campTotemSkull,
  BUILDING_TYPES.campFencePost,
  BUILDING_TYPES.campBoneSmall,
  BUILDING_TYPES.campRockPile,
  BUILDING_TYPES.campSkull,
  BUILDING_TYPES.campAnimalBones,
  BUILDING_TYPES.campMeatRack,
  BUILDING_TYPES.campDryingRack,
  BUILDING_TYPES.campBucket,
  BUILDING_TYPES.campCrate,
  BUILDING_TYPES.campJarSmall,
  BUILDING_TYPES.campJarLarge,
] as const

export const UNIT_TYPES = {
  hero: 'Hero',
  villager: 'Villager',
  chief: 'Chief',
  priest: 'Priest',
  infantry: 'Fantassin',
  bowman: 'Bowman',
  banditChief: 'BanditChief',
  banditSword: 'BanditSword',
  banditArcher: 'BanditArcher',
  scout: 'Scout',
}

export const MOUNTED_HORSE_SPEED_BONUS = 0.45

export const PLAYER_TYPES = {
  human: 'Human',
  ai: 'AI',
  bandits: 'Bandits',
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
  hunter: 'hunter',
  horseCapture: 'horseCapture',
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
  takemeat: 'takemeat',
  hunt: 'hunt',
  captureHorse: 'captureHorse',
  attack: 'attack',
  flee: 'flee',
  train: 'train',
  build: 'build',
  farm: 'farm',
  forageberry: 'forageberry',
  minegold: 'minegold',
  minestone: 'minestone',
  minecopper: 'minecopper',
  mineiron: 'mineiron',
  chopwood: 'chopwood',
  delivery: 'delivery',
  heal: 'heal',
  convert: 'convert',
}

export const LOADING_TYPES = {
  meat: 'meat',
  wheat: 'wheat',
  berry: 'berry',
  herb: 'herb',
  toxicHerb: 'toxicHerb',
  fiber: 'fiber',
  stone: 'stone',
  gold: 'gold',
  copper: 'copper',
  iron: 'iron',
  wood: 'wood',
}

export const TYPE_ACTION = {
  Stone: ACTION_TYPES.minestone,
  Gold: ACTION_TYPES.minegold,
  Copper: ACTION_TYPES.minecopper,
  Iron: ACTION_TYPES.mineiron,
  Berrybush: ACTION_TYPES.forageberry,
  MedicinalHerb: ACTION_TYPES.forageberry,
  ToxicHerb: ACTION_TYPES.forageberry,
  FiberPlant: ACTION_TYPES.forageberry,
  Wheat: ACTION_TYPES.farm,
  Tree: ACTION_TYPES.chopwood,
}

export const RESOURCE_STOCKPILE_TYPES = {
  [RESOURCE_TYPES.tree]: 'wood',
  [RESOURCE_TYPES.berrybush]: 'berry',
  [RESOURCE_TYPES.wheat]: 'wheat',
  [RESOURCE_TYPES.medicinalHerb]: 'herb',
  [RESOURCE_TYPES.toxicHerb]: 'toxicHerb',
  [RESOURCE_TYPES.fiberPlant]: 'fiber',
  [RESOURCE_TYPES.stone]: 'stone',
  [RESOURCE_TYPES.gold]: 'gold',
  [RESOURCE_TYPES.copper]: 'copper',
  [RESOURCE_TYPES.iron]: 'iron',
} as const

export const RESOURCE_GATHER_SWINGS = {
  [LOADING_TYPES.berry]: 2,
  [LOADING_TYPES.herb]: 2,
  [LOADING_TYPES.toxicHerb]: 2,
  [LOADING_TYPES.fiber]: 2,
  [LOADING_TYPES.wheat]: 2,
  [LOADING_TYPES.wood]: 2,
  [LOADING_TYPES.meat]: 3,
  [LOADING_TYPES.stone]: 3,
  [LOADING_TYPES.gold]: 4,
  [LOADING_TYPES.copper]: 3,
  [LOADING_TYPES.iron]: 4,
} as const

export const RESOURCE_ICON_IDS = {
  wood: { commodity: '000_50732', attribute: '000_50731' },
  food: { commodity: '002_50732', attribute: '002_50731' },
  // Placeholder: gathered plants reuse the generic food icon until dedicated art exists.
  berry: { commodity: '002_50732', attribute: '002_50731' },
  meat: { commodity: '002_50732', attribute: '002_50731' },
  wheat: { commodity: '002_50732', attribute: '002_50731' },
  herb: { commodity: '002_50732', attribute: '002_50731' },
  toxicHerb: { commodity: '002_50732', attribute: '002_50731' },
  fiber: { commodity: '002_50732', attribute: '002_50731' },
  feather: { commodity: '002_50732', attribute: '002_50731' },
  leather: { commodity: '002_50732', attribute: '002_50731' },
  sinew: { commodity: '002_50732', attribute: '002_50731' },
  stone: { commodity: '001_50732', attribute: '001_50731' },
  gold: { commodity: '003_50732', attribute: '003_50731' },
  copper: { commodity: '003_50732', attribute: '003_50731' },
  iron: { commodity: '001_50732', attribute: '001_50731' },
} as const

export const MINING_RESOURCE_CONFIG = {
  [RESOURCE_TYPES.stone]: {
    action: ACTION_TYPES.minestone,
    loadingType: LOADING_TYPES.stone,
    work: WORK_TYPES.stoneminer,
    sound: 'mineStone',
    dieOnEmpty: true,
  },
  [RESOURCE_TYPES.gold]: {
    action: ACTION_TYPES.minegold,
    loadingType: LOADING_TYPES.gold,
    work: WORK_TYPES.goldminer,
    sound: 'mineGold',
  },
  [RESOURCE_TYPES.copper]: {
    action: ACTION_TYPES.minecopper,
    loadingType: LOADING_TYPES.copper,
    work: WORK_TYPES.goldminer,
    sound: 'mineGold',
  },
  [RESOURCE_TYPES.iron]: {
    action: ACTION_TYPES.mineiron,
    loadingType: LOADING_TYPES.iron,
    work: WORK_TYPES.goldminer,
    sound: 'mineGold',
  },
} as const

export const SPACED_RESOURCE_TYPES = [
  RESOURCE_TYPES.berrybush,
  RESOURCE_TYPES.medicinalHerb,
  RESOURCE_TYPES.toxicHerb,
  RESOURCE_TYPES.fiberPlant,
  RESOURCE_TYPES.wheat,
  RESOURCE_TYPES.gold,
  RESOURCE_TYPES.stone,
  RESOURCE_TYPES.copper,
  RESOURCE_TYPES.iron,
] as const
