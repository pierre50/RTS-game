import { EAST_FIRST_EIGHT_DIRECTION_ORDER } from '../lib/extra'
import { getCivilizationDefinition } from './civilizations'
import type { BuildingConfig, ProjectileConfig, TechnologyConfig, UnitConfig } from '../types/config'
import type { PlayerConfigLike } from '../types/player'

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

const MELEE_SOUNDS = {
  hit: ['sword-attack', 'swing-sword-attack', 'tinkle-sword-attack', 'sword-attack-2'],
  die: ['human-unit-killed-6', 'human-unit-killed-7', 'human-unit-killed-8', 'human-unit-killed-9', 'human-unit-killed-10'],
}

const HUMAN_HIT_SOUNDS = ['attack-class-2', 'attack-class-2-2', 'attack-class-2-3']
const SHIP_DESTROYED_SOUNDS = ['ship-sunk', 'ship-sunk-2', 'ship-sunk-3']
const STONE_START_SOUND = null
const FISHING_SOUNDS = ['fish', 'fish-2', 'fish-3']

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
      hit: ['archer-attack', 'archer-attack-2'],
      die: ['human-unit-killed', 'human-unit-killed-2', 'human-unit-killed-3'],
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
      create: 'winsetts-z',
      command: 'winsetts-z',
      move: 'winsetts-z',
      hit: ['archer-attack', 'archer-attack-2'],
      die: 'horse-unit-die',
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
      standingSheet: 'lpc-baked/longswordman/greek_01/default/walking',
      walkingSheet: 'lpc-baked/longswordman/greek_01/default/walking',
      actionSheet: 'lpc-baked/longswordman/greek_01/default/action',
      dyingSheet: 'lpc-baked/longswordman/greek_01/default/dying',
      corpseSheet: 'lpc-baked/longswordman/greek_01/default/corpse',
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
      standingSheet: 'lpc-baked/phalanx/greek_01/default/walking',
      walkingSheet: 'lpc-baked/phalanx/greek_01/default/walking',
      actionSheet: 'lpc-baked/phalanx/greek_01/default/action',
      dyingSheet: 'lpc-baked/phalanx/greek_01/default/dying',
      corpseSheet: 'lpc-baked/phalanx/greek_01/default/corpse',
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
      standingSheet: 'lpc-baked/phalanx/greek_01/default/walking',
      walkingSheet: 'lpc-baked/phalanx/greek_01/default/walking',
      actionSheet: 'lpc-baked/phalanx/greek_01/default/action',
      dyingSheet: 'lpc-baked/phalanx/greek_01/default/dying',
      corpseSheet: 'lpc-baked/phalanx/greek_01/default/corpse',
    },
    sounds: MELEE_SOUNDS,
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
      create: 'catapult-weapon-completed-selected',
      command: 'siege-weapon-moving',
      move: 'siege-weapon-moving',
      die: 'siege-weapon-destroyed',
      attack: ['catapult-stone-shot', 'catapult-stone-shot-2', 'catapult-stone-shot-3'],
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
      create: 'catapult-weapon-completed-selected',
      command: 'siege-weapon-moving',
      move: 'siege-weapon-moving',
      die: 'siege-weapon-destroyed',
      attack: ['catapult-stone-shot', 'catapult-stone-shot-2', 'catapult-stone-shot-3'],
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
      create: 'ballista-weapon-completed-selected',
      command: 'siege-weapon-moving',
      move: 'siege-weapon-moving',
      die: 'catapult-weapon-destroyed',
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
      standingSheet: 'boats/fishing-ship',
      walkingSheet: 'boats/fishing-ship',
      actionSheet: 'boats/fishing-ship',
      fishingOverlaySheet: 'boats/fishing-ship/fishing-overlay',
      dyingSheet: 'boats/wrecks/medium',
      corpseSheet: 'boats/wrecks/medium',
    },
    sounds: {
      create: 'non-military-ship-completed',
      command: 'dock-completed-selected',
      move: 'dock-completed-selected',
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
      standingSheet: 'boats/light-transport',
      walkingSheet: 'boats/light-transport',
      actionSheet: 'boats/light-transport',
      dyingSheet: 'boats/wrecks/medium',
      corpseSheet: 'boats/wrecks/medium',
    },
    sailSheet: 'boats/shared/sail-5-direction',
    sailDirectionCount: 5,
    sounds: {
      create: 'military-ship-completed-selected',
      command: 'dock-completed-selected',
      move: 'dock-completed-selected',
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
      standingSheet: 'boats/heavy-transport',
      walkingSheet: 'boats/heavy-transport',
      actionSheet: 'boats/heavy-transport',
      dyingSheet: 'boats/wrecks/medium',
      corpseSheet: 'boats/wrecks/medium',
    },
    sailSheet: 'boats/shared/sail-5-direction',
    sailDirectionCount: 5,
    sounds: {
      create: 'military-ship-completed-selected',
      command: 'dock-completed-selected',
      move: 'dock-completed-selected',
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
      standingSheet: 'boats/scout-ship',
      walkingSheet: 'boats/scout-ship',
      actionSheet: 'boats/scout-ship',
      dyingSheet: 'boats/wrecks/medium',
      corpseSheet: 'boats/wrecks/medium',
    },
    sailSheet: 'boats/shared/sail-5-direction',
    sailDirectionCount: 5,
    sounds: {
      create: 'military-ship-completed-selected',
      command: 'dock-completed-selected',
      move: 'dock-completed-selected',
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
      standingSheet: 'boats/war-galley',
      walkingSheet: 'boats/war-galley',
      actionSheet: 'boats/war-galley',
      dyingSheet: 'boats/wrecks/large',
      corpseSheet: 'boats/wrecks/large',
    },
    sailSheet: 'boats/shared/sail-5-direction',
    sailDirectionCount: 5,
    sounds: {
      create: 'military-ship-completed-selected',
      command: 'dock-completed-selected',
      move: 'dock-completed-selected',
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
      standingSheet: 'boats/trireme',
      walkingSheet: 'boats/trireme',
      actionSheet: 'boats/trireme',
      dyingSheet: 'boats/wrecks/large',
      corpseSheet: 'boats/wrecks/large',
    },
    sailSheet: 'boats/shared/sail-9-direction',
    sailDirectionCount: 9,
    sounds: {
      create: 'military-ship-completed-selected',
      command: 'dock-completed-selected',
      move: 'dock-completed-selected',
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
      standingSheet: 'boats/trireme',
      walkingSheet: 'boats/trireme',
      actionSheet: 'boats/trireme',
      dyingSheet: 'boats/wrecks/large',
      corpseSheet: 'boats/wrecks/large',
    },
    sailSheet: 'boats/shared/sail-9-direction',
    sailDirectionCount: 9,
    sounds: {
      create: 'military-ship-completed-selected',
      command: 'dock-completed-selected',
      move: 'dock-completed-selected',
      attack: 'catapult-stone-shot-3',
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
      standingSheet: 'boats/juggernaut',
      walkingSheet: 'boats/juggernaut',
      actionSheet: 'boats/juggernaut',
      dyingSheet: 'boats/wrecks/large',
      corpseSheet: 'boats/wrecks/large',
    },
    sailSheet: 'boats/shared/sail-9-direction',
    sailDirectionCount: 9,
    sounds: {
      create: 'military-ship-completed-selected',
      command: 'dock-completed-selected',
      move: 'dock-completed-selected',
      attack: 'catapult-stone-shot-3',
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
    units: ['Bowman', 'ImprovedBowman', 'CompositeBowman'],
  },
  Stable: {
    units: [
      'Clubman',
      'Axeman',
      'ShortSwordsman',
      'BroadSwordsman',
      'LongSwordsman',
      'Hoplite',
      'Phalanx',
      'Centurion',
      'Bowman',
      'ImprovedBowman',
      'CompositeBowman',
    ],
    mountingTime: 20,
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
      impact: 'target-hit-2',
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
      impact: 'target-hit-2',
    },
  },
  Arrow: {
    size: 3,
    speed: 14,
    assets: 'projectiles/arrow',
    isAnimated: true,
    rotateSprite: true,
    spriteBaseAngle: 180,
    spawnOffsetY: 10,
    trajectory: {
      kind: 'arc',
      minArcHeight: 4,
      arcHeightFactor: 0.06,
      maxArcHeight: 16,
    },
    sounds: {
      launch: ['archer-attack', 'archer-attack-2', 'archer-attack-3', 'archer-attack-4'],
    },
  },
  FireArrow: {
    size: 3,
    speed: 14,
    assets: 'projectiles/fire-arrow',
    isAnimated: true,
    rotateSprite: true,
    staticFrame: 1,
    spriteBaseAngle: 180,
    spawnOffsetY: 10,
    trajectory: {
      kind: 'arc',
      minArcHeight: 4,
      arcHeightFactor: 0.06,
      maxArcHeight: 16,
    },
    sounds: {
      launch: ['archer-attack', 'archer-attack-2', 'archer-attack-3', 'archer-attack-4'],
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
      launch: ['ballista-bolt-shot', 'ballista-bolt-shot-2', 'ballista-bolt-shot-3', 'ballista-bolt-shot-4', 'ballista-bolt-shot-5'],
      impact: 'target-hit',
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
      launch: ['ballista-bolt-shot', 'ballista-bolt-shot-2', 'ballista-bolt-shot-3', 'ballista-bolt-shot-4', 'ballista-bolt-shot-5'],
      impact: 'target-hit',
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
      launch: ['archer-attack', 'archer-attack-2'],
      impact: 'target-hit',
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
      launch: ['archer-attack', 'archer-attack-2'],
      impact: 'target-hit',
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
      launch: 'arrow-shot',
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
