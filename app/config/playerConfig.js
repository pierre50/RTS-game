import { getCivilizationDefinition } from './civilizations'

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

const MELEE_SOUNDS = {
  hit: [5190, 5191, 5192, 5193],
  die: [5060, 5061, 5062, 5063, 5064],
}

const HUMAN_HIT_SOUNDS = [5138, 5139, 5140]
const STONE_START_SOUND = null
const BOLT_START_SOUND = 5125

const EXTRA_UNIT_DEFINITIONS = {
  Trooper: {
    category: 'Archer',
    totalHitPoints: 80,
    sight: 9,
    speed: 1.5,
    rateOfFire: 0.5,
    trainingTime: 20,
    icon: '006_50730',
    pierceAttack: 12,
    meleeArmor: 0,
    pierceArmor: 1,
    range: 8,
    projectile: 'Bullet',
    cost: {
      food: 0,
    },
    sheetDirectionCounts: {
      standingSheet: 8,
      walkingSheet: 8,
      actionSheet: 8,
    },
    assets: {
      standingSheet: '607',
      walkingSheet: '603',
      actionSheet: '606',
      dyingSheet: '308',
      corpseSheet: '367',
    },
    sounds: {
      hit: [5009, 5010],
      die: [5055, 5056, 5057],
    },
  },
  Legion: {
    category: 'Infantry',
    totalHitPoints: 160,
    sight: 4,
    speed: 1.2,
    rateOfFire: 1.5,
    trainingTime: 27,
    icon: '027_50730',
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
      standingSheet: '436',
      walkingSheet: '677',
      actionSheet: '219',
      dyingSheet: '333',
      corpseSheet: '394',
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
    icon: '016_50730',
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
      standingSheet: '438',
      walkingSheet: '679',
      actionSheet: '221',
      dyingSheet: '335',
      corpseSheet: '396',
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
    icon: '016_50730',
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
      standingSheet: '438',
      walkingSheet: '679',
      actionSheet: '221',
      dyingSheet: '335',
      corpseSheet: '396',
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
    icon: '028_50730',
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
      standingSheet: '422',
      walkingSheet: '661',
      actionSheet: '209',
      dyingSheet: '318',
      corpseSheet: '377',
    },
  },
  HeavyHorseArcher: {
    category: 'Archer',
    totalHitPoints: 90,
    sight: 9,
    speed: 2.5,
    rateOfFire: 1.5,
    trainingTime: 40,
    icon: '028_50730',
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
      standingSheet: '422',
      walkingSheet: '661',
      actionSheet: '209',
      dyingSheet: '318',
      corpseSheet: '377',
    },
  },
  Chariot: {
    category: 'Cavalery',
    totalHitPoints: 100,
    sight: 6,
    speed: 2,
    rateOfFire: 1.4,
    trainingTime: 40,
    icon: '031_50730',
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
      standingSheet: '426',
      walkingSheet: '665',
      actionSheet: '213',
      dyingSheet: '322',
      corpseSheet: '381',
    },
    sounds: {
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
    icon: '031_50730',
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
      standingSheet: '424',
      walkingSheet: '663',
      actionSheet: '211',
      dyingSheet: '320',
      corpseSheet: '379',
    },
    sounds: {
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
    icon: '031_50730',
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
      standingSheet: '423',
      walkingSheet: '662',
      actionSheet: '210',
      dyingSheet: '319',
      corpseSheet: '378',
    },
    sounds: {
      die: 5108,
      hit: HUMAN_HIT_SOUNDS,
    },
  },
  ElephantArcher: {
    category: 'Archer',
    totalHitPoints: 600,
    sight: 8,
    speed: 0.9,
    rateOfFire: 1.5,
    trainingTime: 50,
    icon: '028_50730',
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
      standingSheet: '427',
      walkingSheet: '666',
      actionSheet: '214',
      dyingSheet: '323',
      corpseSheet: '385',
    },
    sounds: {
      die: 5216,
      hit: 5070,
    },
  },
  WarElephant: {
    category: 'Cavalery',
    totalHitPoints: 600,
    sight: 6,
    speed: 0.9,
    rateOfFire: 1,
    trainingTime: 50,
    icon: '031_50730',
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
      standingSheet: '429',
      walkingSheet: '669',
      actionSheet: '216',
      dyingSheet: '325',
      corpseSheet: '387',
    },
    sounds: {
      die: 5216,
      hit: 5070,
    },
  },
  ArmoredElephant: {
    category: 'Cavalery',
    totalHitPoints: 600,
    sight: 6,
    speed: 0.9,
    rateOfFire: 1,
    trainingTime: 50,
    icon: '031_50730',
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
      standingSheet: '429',
      walkingSheet: '669',
      actionSheet: '216',
      dyingSheet: '325',
      corpseSheet: '387',
    },
    sounds: {
      die: 5216,
      hit: 5070,
    },
  },
  StoneThrower: {
    category: 'Siege',
    totalHitPoints: 75,
    sight: 8,
    speed: 0.8,
    rateOfFire: 5,
    trainingTime: 60,
    icon: '006_50730',
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
      standingSheet: '421',
      walkingSheet: '660',
      actionSheet: '629',
      dyingSheet: '317',
      corpseSheet: '376',
    },
    sounds: {
      move: 5013,
      die: 5016,
      attack: [5038, 5039, 5040],
    },
  },
  Catapult: {
    category: 'Siege',
    totalHitPoints: 75,
    sight: 8,
    speed: 0.8,
    rateOfFire: 5,
    trainingTime: 60,
    icon: '006_50730',
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
      standingSheet: '420',
      walkingSheet: '659',
      actionSheet: '208',
      dyingSheet: '316',
      corpseSheet: '375',
    },
    sounds: {
      move: 5043,
      die: 5016,
      attack: [5038, 5039, 5040],
    },
  },
  Ballista: {
    category: 'Archer',
    totalHitPoints: 55,
    sight: 8,
    speed: 0.8,
    rateOfFire: 3,
    trainingTime: 50,
    icon: '006_50730',
    pierceAttack: 40,
    meleeArmor: 0,
    pierceArmor: 0,
    range: 9,
    projectile: 'Bolt',
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
      standingSheet: '417',
      walkingSheet: '656',
      actionSheet: '207',
      dyingSheet: '313',
      corpseSheet: '372',
    },
    sounds: {
      move: 5013,
      die: 5042,
      attack: [5018, 5019, 5020, 5021],
    },
  },
  FishingShip: {
    category: 'Boat',
    totalHitPoints: 75,
    sight: 7,
    speed: 2.1,
    trainingTime: 20,
    showLoading: true,
    icon: '018_50730',
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
    assets: {
      standingSheet: '474',
      walkingSheet: '474',
      actionSheet: '697',
      dyingSheet: '474',
      corpseSheet: '474',
    },
  },
  ScoutShip: {
    category: 'Boat',
    totalHitPoints: 120,
    sight: 9,
    speed: 1.8,
    rateOfFire: 1.4,
    trainingTime: 30,
    icon: '018_50730',
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
    assets: {
      standingSheet: '692',
      walkingSheet: '692',
      actionSheet: '692',
      dyingSheet: '692',
      corpseSheet: '692',
    },
  },
  WarGalley: {
    category: 'Boat',
    totalHitPoints: 160,
    sight: 10,
    speed: 1.8,
    rateOfFire: 1.5,
    trainingTime: 30,
    icon: '018_50730',
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
    assets: {
      standingSheet: '691',
      walkingSheet: '691',
      actionSheet: '691',
      dyingSheet: '691',
      corpseSheet: '691',
    },
  },
  Trireme: {
    category: 'Boat',
    totalHitPoints: 200,
    sight: 11,
    speed: 1.8,
    rateOfFire: 2,
    trainingTime: 30,
    icon: '018_50730',
    pierceAttack: 12,
    meleeArmor: 0,
    pierceArmor: 0,
    range: 7,
    projectile: 'Bolt',
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
    assets: {
      standingSheet: '693',
      walkingSheet: '693',
      actionSheet: '693',
      dyingSheet: '693',
      corpseSheet: '693',
    },
  },
}

const UNIT_OVERRIDES = {
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

const BUILDING_OVERRIDES = {
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
    units: ['FishingBoat', 'FishingShip', 'ScoutShip', 'WarGalley', 'Trireme'],
  },
}

const EXTRA_PROJECTILES = {
  Stone: {
    size: 8,
    speed: 10,
    assets: '360',
    isAnimated: true,
    animationSpeed: 0.35,
    sounds: {
      start: STONE_START_SOUND,
    },
  },
  Bolt: {
    size: 12,
    speed: 12,
    assets: '242',
    directionalFrames: 8,
    directionalFrameOrder: ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'],
    sounds: {
      start: BOLT_START_SOUND,
    },
  },
  Bullet: {
    size: 2,
    speed: 24,
    sounds: {
      start: [5009, 5010],
    },
  },
}

export function createPlayerData(baseConfig, baseTechs, civ) {
  const config = deepClone(baseConfig)
  const techs = deepClone(baseTechs)
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
      building.units = building.units.filter(unitName => config.units[unitName])
    }
    if (Array.isArray(building.technologies)) {
      building.technologies = building.technologies.filter(techName => techs[techName])
    }
  }

  return { config, techs }
}
