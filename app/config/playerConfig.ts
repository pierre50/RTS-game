import { EAST_FIRST_EIGHT_DIRECTION_ORDER } from '../lib/extra'
import { getCivilizationDefinition } from './civilizations'
import type { BuildingConfig, ProjectileConfig, TechnologyConfig, UnitConfig } from '../types/config'
import type { PlayerConfigLike } from '../types/player'

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

const MELEE_SOUNDS = {
  hit: [5190, 5191, 5192, 5193],
  die: [5060, 5061, 5062, 5063, 5064],
}

const HUMAN_HIT_SOUNDS = [5138, 5139, 5140]
const SHIP_DESTROYED_SOUNDS = [5113, 5177, 5181]
const STONE_START_SOUND = null
const FISHING_SOUNDS = [5182, 5183, 5184]

const EXTRA_UNIT_DEFINITIONS: Record<string, UnitConfig> = {
  Trooper: {
    category: 'Archer',
    totalHitPoints: 100,
    sight: 15,
    speed: 2,
    rateOfFire: 9,
    trainingTime: 20,
    icon: '006_50730',
    pierceAttack: 600,
    meleeArmor: 10,
    pierceArmor: 0,
    range: 88,
    projectile: 'Bullet',
    cost: {
      food: 0,
    },
    sheetDirectionCounts: {
      standingSheet: 8,
      walkingSheet: 8,
      actionSheet: 8,
      dyingSheet: 8,
      corpseSheet: 8,
    },
    sheetDirectionOrders: {
      standingSheet: EAST_FIRST_EIGHT_DIRECTION_ORDER,
      walkingSheet: EAST_FIRST_EIGHT_DIRECTION_ORDER,
      actionSheet: EAST_FIRST_EIGHT_DIRECTION_ORDER,
      dyingSheet: EAST_FIRST_EIGHT_DIRECTION_ORDER,
      corpseSheet: EAST_FIRST_EIGHT_DIRECTION_ORDER,
    },
    allAssets: {
      default: {
        standingSheet: 'units/trooper/default/standing',
        walkingSheet: 'units/trooper/default/walking',
        actionSheet: 'units/trooper/default/action',
        dyingSheet: 'units/trooper/default/dying',
        corpseSheet: 'units/trooper/default/corpse',
      },
      attacker: {
        standingSheet: 'units/trooper/default/standing',
        walkingSheet: 'units/trooper/default/walking',
        actionSheet: 'units/trooper/default/action',
        dyingSheet: 'units/trooper/default/dying',
        corpseSheet: 'units/trooper/default/corpse',
      },
    },
    sounds: {
      hit: [5009, 5010],
      die: [5055, 5056, 5057],
    },
  },
  Supercar: {
    category: 'Cavalery',
    totalHitPoints: 500,
    sight: 17,
    speed: 8,
    rateOfFire: 3,
    trainingTime: 20,
    icon: '028_50730',
    pierceAttack: 300,
    meleeArmor: 10,
    pierceArmor: 0,
    range: 15,
    projectile: 'SupercarMissile',
    cost: {
      food: 0,
    },
    sheetDirectionCounts: {
      standingSheet: 9,
      walkingSheet: 9,
      actionSheet: 9,
    },
    allAssets: {
      default: {
        standingSheet: 'units/supercar/body',
        walkingSheet: 'units/supercar/walking',
        actionSheet: 'units/supercar/body',
        dyingSheet: 'units/supercar/dying',
        corpseSheet: 'units/supercar/corpse',
      },
      attacker: {
        standingSheet: 'units/supercar/body',
        walkingSheet: 'units/supercar/walking',
        actionSheet: 'units/supercar/body',
        dyingSheet: 'units/supercar/dying',
        corpseSheet: 'units/supercar/corpse',
      },
    },
    sounds: {
      create: 5240,
      command: 5240,
      move: 5240,
      hit: [5009, 5010],
      die: 5108,
    },
  },
  Legion: {
    category: 'Infantry',
    totalHitPoints: 160,
    sight: 4,
    speed: 1.2,
    rateOfFire: 1.5,
    trainingTime: 27,
    icon: '049_50730',
    meleeAttack: 13,
    meleeArmor: 2,
    pierceArmor: 0,
    cost: {
      food: 35,
      gold: 15,
    },
    conditions: [
      {
        key: 'technologies',
        op: 'includes',
        value: 'Legion',
      },
    ],
    assets: {
      standingSheet: 'units/long-swordsman/standing',
      walkingSheet: 'units/long-swordsman/walking',
      actionSheet: 'units/long-swordsman/action',
      dyingSheet: 'units/long-swordsman/dying',
      corpseSheet: 'units/long-swordsman/corpse',
    },
    sounds: MELEE_SOUNDS,
  },
  Phalanx: {
    category: 'Infantry',
    totalHitPoints: 120,
    sight: 4,
    speed: 0.9,
    rateOfFire: 1.5,
    trainingTime: 36,
    icon: '017_50730',
    meleeAttack: 20,
    meleeArmor: 7,
    pierceArmor: 0,
    cost: {
      food: 60,
      gold: 40,
    },
    conditions: [
      {
        key: 'technologies',
        op: 'notincludes',
        value: 'Centurion',
      },
      {
        key: 'technologies',
        op: 'includes',
        value: 'Phalanx',
      },
    ],
    assets: {
      standingSheet: 'units/phalanx/standing',
      walkingSheet: 'units/phalanx/walking',
      actionSheet: 'units/phalanx/action',
      dyingSheet: 'units/phalanx/dying',
      corpseSheet: 'units/phalanx/corpse',
    },
    sounds: MELEE_SOUNDS,
  },
  Centurion: {
    category: 'Infantry',
    totalHitPoints: 160,
    sight: 4,
    speed: 0.9,
    rateOfFire: 1.5,
    trainingTime: 36,
    icon: '050_50730',
    meleeAttack: 30,
    meleeArmor: 8,
    pierceArmor: 0,
    cost: {
      food: 60,
      gold: 40,
    },
    conditions: [
      {
        key: 'technologies',
        op: 'includes',
        value: 'Centurion',
      },
    ],
    assets: {
      standingSheet: 'units/phalanx/standing',
      walkingSheet: 'units/phalanx/walking',
      actionSheet: 'units/phalanx/action',
      dyingSheet: 'units/phalanx/dying',
      corpseSheet: 'units/phalanx/corpse',
    },
    sounds: MELEE_SOUNDS,
  },
  HorseArcher: {
    category: 'Archer',
    totalHitPoints: 60,
    sight: 8,
    speed: 2.2,
    rateOfFire: 1.5,
    trainingTime: 40,
    icon: '029_50730',
    pierceAttack: 7,
    meleeArmor: 0,
    pierceArmor: 2,
    range: 7,
    projectile: 'Arrow',
    cost: {
      food: 70,
      gold: 50,
    },
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 2,
      },
      {
        key: 'technologies',
        op: 'includes',
        value: 'Wheel',
      },
      {
        key: 'technologies',
        op: 'notincludes',
        value: 'HeavyHorseArcher',
      },
    ],
    assets: {
      standingSheet: 'units/horse-archer/standing',
      walkingSheet: 'units/horse-archer/walking',
      actionSheet: 'units/horse-archer/action',
      dyingSheet: 'units/horse-archer/dying',
      corpseSheet: 'units/horse-archer/corpse',
    },
    sounds: {
      command: [5120, 5121, 5122, 5123],
      move: 5092,
      hit: HUMAN_HIT_SOUNDS,
      die: 5108,
    },
  },
  HeavyHorseArcher: {
    category: 'Archer',
    totalHitPoints: 90,
    sight: 9,
    speed: 2.5,
    rateOfFire: 1.5,
    trainingTime: 40,
    icon: '048_50730',
    pierceAttack: 8,
    meleeArmor: 0,
    pierceArmor: 2,
    range: 7,
    projectile: 'Arrow',
    cost: {
      food: 70,
      gold: 50,
    },
    conditions: [
      {
        key: 'technologies',
        op: 'includes',
        value: 'HeavyHorseArcher',
      },
    ],
    assets: {
      standingSheet: 'units/horse-archer/standing',
      walkingSheet: 'units/horse-archer/walking',
      actionSheet: 'units/horse-archer/action',
      dyingSheet: 'units/horse-archer/dying',
      corpseSheet: 'units/horse-archer/corpse',
    },
    sounds: {
      command: [5120, 5121, 5122, 5123],
      move: 5092,
      hit: HUMAN_HIT_SOUNDS,
      die: 5108,
    },
  },
  Chariot: {
    category: 'Cavalery',
    selectionFactor: 2,
    totalHitPoints: 100,
    sight: 6,
    speed: 2,
    rateOfFire: 1.4,
    trainingTime: 40,
    icon: '010_50730',
    meleeAttack: 7,
    meleeArmor: 0,
    pierceArmor: 0,
    cost: {
      wood: 60,
      food: 40,
    },
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 1,
      },
      {
        key: 'technologies',
        op: 'includes',
        value: 'Wheel',
      },
    ],
    assets: {
      standingSheet: 'units/chariot/standing',
      walkingSheet: 'units/chariot/walking',
      actionSheet: 'units/chariot/action',
      dyingSheet: 'units/supercar/dying',
      corpseSheet: 'units/supercar/corpse',
    },
    sounds: {
      command: [5120, 5121, 5122, 5123],
      move: 5092,
      die: 5108,
      hit: HUMAN_HIT_SOUNDS,
    },
  },
  Cavalry: {
    category: 'Cavalery',
    totalHitPoints: 150,
    sight: 7,
    speed: 2,
    rateOfFire: 1.3,
    trainingTime: 40,
    icon: '011_50730',
    meleeAttack: 8,
    meleeArmor: 0,
    pierceArmor: 0,
    cost: {
      food: 80,
      gold: 70,
    },
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 2,
      },
      {
        key: 'technologies',
        op: 'includes',
        value: 'Wheel',
      },
    ],
    assets: {
      standingSheet: 'units/cavalry/standing',
      walkingSheet: 'units/cavalry/walking',
      actionSheet: 'units/cavalry/action',
      dyingSheet: 'units/cavalry/dying',
      corpseSheet: 'units/cavalry/corpse',
    },
    sounds: {
      command: [5120, 5121, 5122, 5123],
      move: 5092,
      die: 5108,
      hit: HUMAN_HIT_SOUNDS,
    },
  },
  Cataphract: {
    category: 'Cavalery',
    totalHitPoints: 180,
    sight: 7,
    speed: 2,
    rateOfFire: 1.3,
    trainingTime: 40,
    icon: '054_50730',
    meleeAttack: 12,
    meleeArmor: 3,
    pierceArmor: 1,
    cost: {
      food: 80,
      gold: 70,
    },
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 3,
      },
      {
        key: 'technologies',
        op: 'includes',
        value: 'Wheel',
      },
    ],
    assets: {
      standingSheet: 'units/cataphract/standing',
      walkingSheet: 'units/cataphract/walking',
      actionSheet: 'units/cataphract/action',
      dyingSheet: 'units/cataphract/dying',
      corpseSheet: 'units/cataphract/corpse',
    },
    sounds: {
      command: [5120, 5121, 5122, 5123],
      move: 5092,
      die: 5108,
      hit: HUMAN_HIT_SOUNDS,
    },
  },
  ElephantArcher: {
    category: 'Archer',
    selectionFactor: 2,
    totalHitPoints: 600,
    sight: 8,
    speed: 0.9,
    rateOfFire: 1.5,
    trainingTime: 50,
    icon: '047_50730',
    pierceAttack: 5,
    meleeArmor: 0,
    pierceArmor: 0,
    range: 7,
    projectile: 'Arrow',
    cost: {
      food: 60,
      gold: 180,
    },
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 2,
      },
      {
        key: 'technologies',
        op: 'includes',
        value: 'Wheel',
      },
    ],
    assets: {
      standingSheet: 'units/elephant-archer/standing',
      walkingSheet: 'units/elephant-archer/walking',
      actionSheet: 'units/elephant-archer/action',
      dyingSheet: 'units/elephant-archer/dying',
      corpseSheet: 'units/elephant-archer/corpse',
    },
    sounds: {
      command: [5071, 5072],
      move: 5216,
      die: 5239,
      hit: 5070,
    },
  },
  WarElephant: {
    category: 'Cavalery',
    selectionFactor: 2,
    totalHitPoints: 600,
    sight: 6,
    speed: 0.9,
    rateOfFire: 1,
    trainingTime: 50,
    icon: '012_50730',
    meleeAttack: 15,
    meleeArmor: 0,
    pierceArmor: 0,
    cost: {
      food: 40,
      gold: 170,
    },
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 3,
      },
      {
        key: 'technologies',
        op: 'includes',
        value: 'Wheel',
      },
      {
        key: 'technologies',
        op: 'notincludes',
        value: 'ArmoredElephant',
      },
    ],
    assets: {
      standingSheet: 'units/war-elephant/standing',
      walkingSheet: 'units/war-elephant/walking',
      actionSheet: 'units/war-elephant/action',
      dyingSheet: 'units/war-elephant/dying',
      corpseSheet: 'units/war-elephant/corpse',
    },
    sounds: {
      command: [5071, 5072],
      move: 5216,
      die: 5239,
      hit: 5070,
    },
  },
  ArmoredElephant: {
    category: 'Cavalery',
    selectionFactor: 2,
    totalHitPoints: 600,
    sight: 6,
    speed: 0.9,
    rateOfFire: 1,
    trainingTime: 50,
    icon: '012_50730',
    meleeAttack: 15,
    meleeArmor: 0,
    pierceArmor: 0,
    cost: {
      food: 40,
      gold: 170,
    },
    conditions: [
      {
        key: 'technologies',
        op: 'includes',
        value: 'ArmoredElephant',
      },
    ],
    assets: {
      standingSheet: 'units/war-elephant/standing',
      walkingSheet: 'units/war-elephant/walking',
      actionSheet: 'units/war-elephant/action',
      dyingSheet: 'units/war-elephant/dying',
      corpseSheet: 'units/war-elephant/corpse',
    },
    sounds: {
      command: [5071, 5072],
      move: 5216,
      die: 5239,
      hit: 5070,
    },
  },
  StoneThrower: {
    category: 'Siege',
    selectionFactor: 2,
    totalHitPoints: 75,
    sight: 8,
    speed: 0.8,
    rateOfFire: 5,
    trainingTime: 60,
    icon: '014_50730',
    pierceAttack: 50,
    meleeArmor: 0,
    pierceArmor: 0,
    range: 10,
    projectile: 'Stone',
    cost: {
      wood: 180,
      stone: 80,
    },
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 2,
      },
    ],
    assets: {
      standingSheet: 'units/stone-thrower/standing',
      walkingSheet: 'units/stone-thrower/walking',
      actionSheet: 'units/stone-thrower/action',
      dyingSheet: 'units/stone-thrower/dying',
      corpseSheet: 'units/stone-thrower/corpse',
    },
    sounds: {
      create: 5041,
      command: 5043,
      move: 5043,
      die: 5016,
      attack: [5038, 5039, 5040],
    },
  },
  Catapult: {
    category: 'Siege',
    selectionFactor: 2,
    totalHitPoints: 75,
    sight: 8,
    speed: 0.8,
    rateOfFire: 5,
    trainingTime: 60,
    icon: '015_50730',
    pierceAttack: 50,
    meleeArmor: 0,
    pierceArmor: 0,
    range: 12,
    projectile: 'Stone',
    cost: {
      wood: 180,
      stone: 80,
    },
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 2,
      },
    ],
    assets: {
      standingSheet: 'units/catapult/standing',
      walkingSheet: 'units/catapult/walking',
      actionSheet: 'units/catapult/action',
      dyingSheet: 'units/catapult/dying',
      corpseSheet: 'units/catapult/corpse',
    },
    sounds: {
      create: 5041,
      command: 5043,
      move: 5043,
      die: 5016,
      attack: [5038, 5039, 5040],
    },
  },
  Ballista: {
    category: 'Archer',
    selectionFactor: 2,
    totalHitPoints: 55,
    sight: 8,
    speed: 0.8,
    rateOfFire: 3,
    trainingTime: 50,
    icon: '009_50730',
    pierceAttack: 40,
    meleeArmor: 0,
    pierceArmor: 0,
    range: 9,
    projectile: 'Arrow',
    cost: {
      wood: 100,
      stone: 80,
    },
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 3,
      },
    ],
    assets: {
      standingSheet: 'units/ballista/standing',
      walkingSheet: 'units/ballista/walking',
      actionSheet: 'units/ballista/action',
      dyingSheet: 'units/ballista/dying',
      corpseSheet: 'units/ballista/corpse',
    },
    sounds: {
      create: 5017,
      command: 5043,
      move: 5043,
      die: 5042,
    },
  },
  FishingShip: {
    category: 'Boat',
    totalHitPoints: 75,
    sight: 7,
    speed: 2.1,
    trainingTime: 20,
    showLoading: true,
    icon: '020_50730',
    meleeArmor: 0,
    pierceArmor: 0,
    cost: {
      wood: 50,
    },
    loadingMax: {
      fish: 12,
    },
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 0,
      },
    ],
    gatheringRate: {
      fisher: 0.5,
    },
    silentWorkSounds: ['fishing'],
    sheetDirectionCounts: {
      dyingSheet: 1,
      corpseSheet: 1,
    },
    assets: {
      standingSheet: 'boats/fishing-ship/body',
      walkingSheet: 'boats/fishing-ship/body',
      actionSheet: 'boats/fishing-ship/body',
      fishingOverlaySheet: 'boats/fishing-ship/fishing-overlay',
      dyingSheet: 'boats/wreck-small',
      corpseSheet: 'boats/wreck-small',
    },
    sounds: {
      create: 5030,
      command: 5027,
      move: 5027,
      die: SHIP_DESTROYED_SOUNDS,
      work: {
        fishing: FISHING_SOUNDS,
      },
    },
  },
  LightTransport: {
    category: 'Boat',
    selectionFactor: 2,
    totalHitPoints: 150,
    sight: 5,
    speed: 1.4,
    trainingTime: 46,
    icon: '021_50730',
    transportCapacity: 5,
    showTransportCapacity: true,
    meleeArmor: 0,
    pierceArmor: 0,
    cost: {
      wood: 150,
    },
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 1,
      },
    ],
    sheetDirectionCounts: {
      dyingSheet: 1,
      corpseSheet: 1,
    },
    assets: {
      standingSheet: 'boats/light-transport/body',
      walkingSheet: 'boats/light-transport/body',
      actionSheet: 'boats/light-transport/body',
      dyingSheet: 'boats/wreck-small',
      corpseSheet: 'boats/wreck-small',
    },
    sailSheet: 'boats/sail-5-direction',
    sailDirectionCount: 5,
    sounds: {
      create: 5208,
      command: 5027,
      move: 5027,
      die: SHIP_DESTROYED_SOUNDS,
    },
  },
  HeavyTransport: {
    category: 'Boat',
    selectionFactor: 2,
    totalHitPoints: 200,
    sight: 5,
    speed: 1.6,
    trainingTime: 46,
    icon: '025_50730',
    transportCapacity: 10,
    showTransportCapacity: true,
    meleeArmor: 0,
    pierceArmor: 0,
    cost: {
      wood: 150,
    },
    conditions: [
      {
        key: 'technologies',
        op: 'includes',
        value: 'HeavyTransport',
      },
    ],
    sheetDirectionCounts: {
      dyingSheet: 1,
      corpseSheet: 1,
    },
    assets: {
      standingSheet: 'boats/heavy-transport/body',
      walkingSheet: 'boats/heavy-transport/body',
      actionSheet: 'boats/heavy-transport/body',
      dyingSheet: 'boats/wreck-small',
      corpseSheet: 'boats/wreck-small',
    },
    sailSheet: 'boats/sail-5-direction',
    sailDirectionCount: 5,
    sounds: {
      create: 5208,
      command: 5027,
      move: 5027,
      die: SHIP_DESTROYED_SOUNDS,
    },
  },
  ScoutShip: {
    category: 'Boat',
    totalHitPoints: 120,
    sight: 9,
    speed: 1.8,
    rateOfFire: 1.4,
    trainingTime: 30,
    icon: '022_50730',
    pierceAttack: 5,
    meleeArmor: 0,
    pierceArmor: 0,
    range: 5,
    projectile: 'Arrow',
    cost: {
      wood: 135,
    },
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 2,
      },
    ],
    sheetDirectionCounts: {
      dyingSheet: 1,
      corpseSheet: 1,
    },
    assets: {
      standingSheet: 'boats/scout-ship/body',
      walkingSheet: 'boats/scout-ship/body',
      actionSheet: 'boats/scout-ship/body',
      dyingSheet: 'boats/wreck-small',
      corpseSheet: 'boats/wreck-small',
    },
    sailSheet: 'boats/sail-5-direction',
    sailDirectionCount: 5,
    sounds: {
      create: 5208,
      command: 5027,
      move: 5027,
      hit: HUMAN_HIT_SOUNDS,
      die: SHIP_DESTROYED_SOUNDS,
    },
  },
  WarGalley: {
    category: 'Boat',
    selectionFactor: 2,
    totalHitPoints: 160,
    sight: 10,
    speed: 1.8,
    rateOfFire: 1.5,
    trainingTime: 30,
    icon: '024_50730',
    pierceAttack: 8,
    meleeArmor: 0,
    pierceArmor: 0,
    range: 6,
    projectile: 'Arrow',
    cost: {
      wood: 135,
    },
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 2,
      },
    ],
    sheetDirectionCounts: {
      dyingSheet: 1,
      corpseSheet: 1,
    },
    assets: {
      standingSheet: 'boats/war-galley/body',
      walkingSheet: 'boats/war-galley/body',
      actionSheet: 'boats/war-galley/body',
      dyingSheet: 'boats/wreck-large',
      corpseSheet: 'boats/wreck-large',
    },
    sailSheet: 'boats/sail-5-direction',
    sailDirectionCount: 5,
    sounds: {
      create: 5208,
      command: 5027,
      move: 5027,
      hit: HUMAN_HIT_SOUNDS,
      die: SHIP_DESTROYED_SOUNDS,
    },
  },
  Trireme: {
    category: 'Boat',
    selectionFactor: 2,
    totalHitPoints: 200,
    sight: 11,
    speed: 1.8,
    rateOfFire: 2,
    trainingTime: 30,
    icon: '026_50730',
    pierceAttack: 12,
    meleeArmor: 0,
    pierceArmor: 0,
    range: 7,
    projectile: 'Arrow',
    cost: {
      wood: 135,
    },
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 3,
      },
    ],
    sheetDirectionCounts: {
      standingSheet: 9,
      walkingSheet: 9,
      actionSheet: 9,
      dyingSheet: 1,
      corpseSheet: 1,
    },
    assets: {
      standingSheet: 'boats/trireme/body',
      walkingSheet: 'boats/trireme/body',
      actionSheet: 'boats/trireme/body',
      dyingSheet: 'boats/wreck-large',
      corpseSheet: 'boats/wreck-large',
    },
    sailSheet: 'boats/sail-9-direction',
    sailDirectionCount: 9,
    sounds: {
      create: 5208,
      command: 5027,
      move: 5027,
      hit: HUMAN_HIT_SOUNDS,
      die: SHIP_DESTROYED_SOUNDS,
    },
  },
  CatapultTrireme: {
    category: 'Boat',
    selectionFactor: 2,
    totalHitPoints: 120,
    sight: 11,
    speed: 1.6,
    rateOfFire: 5,
    trainingTime: 40,
    icon: '030_50730',
    pierceAttack: 35,
    meleeArmor: 0,
    pierceArmor: 0,
    range: 10,
    projectile: 'Stone',
    cost: {
      wood: 135,
    },
    conditions: [
      {
        key: 'technologies',
        op: 'includes',
        value: 'CatapultTrireme',
      },
    ],
    sheetDirectionCounts: {
      standingSheet: 9,
      walkingSheet: 9,
      actionSheet: 9,
      dyingSheet: 1,
      corpseSheet: 1,
    },
    assets: {
      standingSheet: 'boats/trireme/body',
      walkingSheet: 'boats/trireme/body',
      actionSheet: 'boats/trireme/body',
      dyingSheet: 'boats/wreck-large',
      corpseSheet: 'boats/wreck-large',
    },
    sailSheet: 'boats/sail-9-direction',
    sailDirectionCount: 9,
    sounds: {
      create: 5208,
      command: 5027,
      move: 5027,
      attack: 5040,
      hit: HUMAN_HIT_SOUNDS,
      die: SHIP_DESTROYED_SOUNDS,
    },
  },
  Juggernaut: {
    category: 'Boat',
    selectionFactor: 2,
    totalHitPoints: 200,
    sight: 12,
    speed: 1.6,
    rateOfFire: 5,
    trainingTime: 40,
    icon: '052_50730',
    pierceAttack: 50,
    meleeArmor: 0,
    pierceArmor: 0,
    range: 12,
    projectile: 'Bolt',
    cost: {
      wood: 135,
    },
    conditions: [
      {
        key: 'technologies',
        op: 'includes',
        value: 'Juggernaut',
      },
    ],
    sheetDirectionCounts: {
      standingSheet: 9,
      walkingSheet: 9,
      actionSheet: 9,
      dyingSheet: 1,
      corpseSheet: 1,
    },
    assets: {
      standingSheet: 'boats/juggernaut/body',
      walkingSheet: 'boats/juggernaut/body',
      actionSheet: 'boats/juggernaut/body',
      dyingSheet: 'boats/wreck-large',
      corpseSheet: 'boats/wreck-large',
    },
    sailSheet: 'boats/sail-9-direction',
    sailDirectionCount: 9,
    sounds: {
      create: 5208,
      command: 5027,
      move: 5027,
      attack: 5040,
      hit: HUMAN_HIT_SOUNDS,
      die: SHIP_DESTROYED_SOUNDS,
    },
  },
}

const UNIT_OVERRIDES: Record<string, Partial<UnitConfig>> = {
  FishingBoat: {
    conditions: [
      {
        key: 'technologies',
        op: 'notincludes',
        value: 'FishingShip',
      },
    ],
  },
  FishingShip: {
    conditions: [
      {
        key: 'technologies',
        op: 'includes',
        value: 'FishingShip',
      },
    ],
  },
  LightTransport: {
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 1,
      },
      {
        key: 'technologies',
        op: 'notincludes',
        value: 'HeavyTransport',
      },
    ],
  },
  HeavyTransport: {
    conditions: [
      {
        key: 'technologies',
        op: 'includes',
        value: 'HeavyTransport',
      },
    ],
  },
  ScoutShip: {
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 2,
      },
      {
        key: 'technologies',
        op: 'notincludes',
        value: 'WarGalley',
      },
    ],
  },
  WarGalley: {
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 2,
      },
      {
        key: 'technologies',
        op: 'notincludes',
        value: 'Trireme',
      },
      {
        key: 'technologies',
        op: 'includes',
        value: 'WarGalley',
      },
    ],
  },
  Trireme: {
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 3,
      },
      {
        key: 'technologies',
        op: 'includes',
        value: 'Trireme',
      },
    ],
  },
  CatapultTrireme: {
    conditions: [
      {
        key: 'technologies',
        op: 'notincludes',
        value: 'Juggernaut',
      },
      {
        key: 'technologies',
        op: 'includes',
        value: 'CatapultTrireme',
      },
    ],
  },
  Juggernaut: {
    conditions: [
      {
        key: 'technologies',
        op: 'includes',
        value: 'Juggernaut',
      },
    ],
  },
  LongSwordsman: {
    conditions: [
      {
        key: 'technologies',
        op: 'notincludes',
        value: 'Legion',
      },
      {
        key: 'technologies',
        op: 'includes',
        value: 'LongSword',
      },
    ],
  },
  Hoplite: {
    conditions: [
      {
        key: 'technologies',
        op: 'notincludes',
        value: 'Phalanx',
      },
    ],
  },
}

const BUILDING_OVERRIDES: Record<string, Partial<BuildingConfig>> = {
  ArcheryRange: {
    units: [
      'Bowman',
      'ImprovedBowman',
      'CompositeBowman',
      'ChariotArcher',
      'HorseArcher',
      'HeavyHorseArcher',
      'ElephantArcher',
    ],
  },
  Stable: {
    units: ['Scout', 'Chariot', 'Cavalry', 'Cataphract', 'WarElephant', 'ArmoredElephant'],
  },
  SiegeWorkshop: {
    units: ['StoneThrower', 'Catapult', 'Ballista'],
  },
  Dock: {
    units: [
      'FishingBoat',
      'FishingShip',
      'LightTransport',
      'HeavyTransport',
      'ScoutShip',
      'WarGalley',
      'Trireme',
      'CatapultTrireme',
      'Juggernaut',
    ],
    technologies: ['WarGalley', 'Trireme', 'CatapultTrireme', 'Juggernaut', 'FishingShip', 'HeavyTransport'],
  },
}

const EXTRA_PROJECTILES: Record<string, ProjectileConfig> = {
  Stone: {
    size: 8,
    speed: 5,
    assets: 'projectiles/stone',
    isAnimated: true,
    animationSpeed: 0.35,
    trajectory: {
      kind: 'arc',
      minArcHeight: 26,
      arcHeightFactor: 0.35,
      maxArcHeight: 90,
    },
    sounds: {
      launch: STONE_START_SOUND,
      impact: 5070,
    },
  },
  FireStone: {
    size: 10,
    speed: 10,
    assets: 'projectiles/fire-stone',
    isAnimated: true,
    animationSpeed: 0.35,
    trajectory: {
      kind: 'arc',
      minArcHeight: 26,
      arcHeightFactor: 0.35,
      maxArcHeight: 90,
    },
    sounds: {
      launch: STONE_START_SOUND,
      impact: 5070,
    },
  },
  Arrow: {
    size: 3,
    speed: 14,
    assets: 'projectiles/arrow',
    isAnimated: true,
    rotateSprite: true,
    staticFrame: 18,
    spriteBaseAngle: 0,
    sounds: {
      launch: [5009, 5010, 5011, 5012],
    },
  },
  FireArrow: {
    size: 3,
    speed: 14,
    assets: 'projectiles/fire-arrow',
    isAnimated: true,
    rotateSprite: true,
    staticFrame: 1,
    spriteBaseAngle: 0,
    sounds: {
      launch: [5009, 5010, 5011, 5012],
    },
  },
  Bolt: {
    size: 12,
    speed: 12,
    assets: 'projectiles/bolt',
    isAnimated: true,
    directionalFrames: 8,
    directionalFrameOrder: ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'],
    sounds: {
      launch: [5018, 5019, 5020, 5021, 5052],
      impact: 5028,
    },
  },
  FireBolt: {
    size: 12,
    speed: 12,
    assets: 'projectiles/fire-bolt',
    isAnimated: true,
    directionalAnimationFrames: 3,
    animationSpeed: 0.35,
    sounds: {
      launch: [5018, 5019, 5020, 5021, 5052],
      impact: 5028,
    },
  },
  Bullet: {
    size: 9,
    speed: 3,
    assets: 'projectiles/bullet',
    isAnimated: true,
    rotateSprite: true,
    spawnOffsetY: -10,
    impactEffect: {
      assets: 'projectiles/impact/explosion',
      animationSpeed: 0.22,
      scale: 0.65,
    },
    sounds: {
      launch: [5009, 5010],
      impact: 5028,
    },
  },
  SupercarMissile: {
    size: 18,
    speed: 2,
    assets: 'projectiles/supercar-missile',
    isAnimated: true,
    rotateSprite: true,
    staticFrame: 9,
    spriteBaseAngle: 0,
    spawnOffsetY: -10,
    impactEffect: {
      assets: 'projectiles/impact/explosion',
      animationSpeed: 0.22,
      scale: 1,
    },
    sounds: {
      launch: [5009, 5010],
      impact: 5028,
    },
  },
  Spear: {
    size: 10,
    speed: 8,
    assets: 'projectiles/spear',
    isAnimated: true,
    directionalFrames: 32,
    fullCircleStartDegree: 191.25,
    sounds: {
      launch: 5125,
    },
  },
}

const EXTRA_TECH_DEFINITIONS: Record<string, TechnologyConfig> = {
  WarGalley: {
    icon: '024_50729',
    key: 'technologies',
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 2,
      },
    ],
    researchTime: 38,
    cost: {
      wood: 75,
      food: 150,
    },
    action: {
      type: 'upgradeUnit',
      source: 'ScoutShip',
      target: 'WarGalley',
    },
  },
  Trireme: {
    icon: '026_50729',
    key: 'technologies',
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 3,
      },
      {
        key: 'technologies',
        op: 'includes',
        value: 'WarGalley',
      },
    ],
    researchTime: 40,
    cost: {
      wood: 100,
      food: 250,
    },
    action: {
      type: 'upgradeUnit',
      source: 'WarGalley',
      target: 'Trireme',
    },
  },
  FishingShip: {
    icon: '020_50729',
    key: 'technologies',
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 2,
      },
    ],
    researchTime: 15,
    cost: {
      wood: 100,
      food: 50,
    },
    action: {
      type: 'upgradeUnit',
      source: 'FishingBoat',
      target: 'FishingShip',
    },
  },
  HeavyTransport: {
    icon: '025_50729',
    key: 'technologies',
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 3,
      },
    ],
    researchTime: 38,
    cost: {
      wood: 125,
      food: 150,
    },
    action: {
      type: 'upgradeUnit',
      source: 'LightTransport',
      target: 'HeavyTransport',
    },
  },
  CatapultTrireme: {
    icon: '027_50729',
    key: 'technologies',
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 3,
      },
      {
        key: 'technologies',
        op: 'includes',
        value: 'Trireme',
      },
    ],
    researchTime: 50,
    cost: {
      wood: 100,
      food: 300,
    },
  },
  Juggernaut: {
    icon: '083_50729',
    key: 'technologies',
    conditions: [
      {
        key: 'age',
        op: '>=',
        value: 3,
      },
      {
        key: 'technologies',
        op: 'includes',
        value: 'CatapultTrireme',
      },
    ],
    researchTime: 150,
    cost: {
      wood: 900,
      food: 2000,
    },
    action: {
      type: 'upgradeUnit',
      source: 'CatapultTrireme',
      target: 'Juggernaut',
    },
  },
}

function normalizeUnitSounds(unit: UnitConfig): UnitConfig {
  const sounds = { ...(unit.sounds || {}) }

  if (sounds.command == null && sounds.move != null) {
    sounds.command = sounds.move
  }
  if (sounds.move == null && sounds.command != null) {
    sounds.move = sounds.command
  }

  unit.sounds = sounds
  return unit
}

export function createPlayerData(
  baseConfig: PlayerConfigLike,
  baseTechs: Record<string, TechnologyConfig>,
  civ: string
): { config: PlayerConfigLike; techs: Record<string, TechnologyConfig> } {
  const config = deepClone(baseConfig)
  const techs: Record<string, TechnologyConfig> = {
    ...deepClone(baseTechs),
    ...deepClone(EXTRA_TECH_DEFINITIONS),
  }
  const civilization = getCivilizationDefinition(civ)

  config.units = {
    ...config.units,
    ...EXTRA_UNIT_DEFINITIONS,
  }

  for (const [unitName, override] of Object.entries(UNIT_OVERRIDES)) {
    config.units[unitName] = {
      ...config.units[unitName],
      ...override,
    }
  }

  for (const unit of Object.values(config.units)) {
    normalizeUnitSounds(unit)
  }

  for (const [buildingName, override] of Object.entries(BUILDING_OVERRIDES)) {
    config.buildings[buildingName] = {
      ...config.buildings[buildingName],
      ...override,
    }
  }

  config.projectiles = {
    ...config.projectiles,
    ...EXTRA_PROJECTILES,
  }

  for (const unitName of civilization.disabledUnits) {
    delete config.units[unitName]
  }

  for (const techName of civilization.disabledTechnologies) {
    delete techs[techName]
  }

  for (const building of Object.values(config.buildings)) {
    if (Array.isArray(building.units)) {
      building.units = building.units.filter((unitName: string) => config.units[unitName])
    }
    if (Array.isArray(building.technologies)) {
      building.technologies = building.technologies.filter((techName: string) => techs[techName])
    }
  }

  return { config, techs }
}
