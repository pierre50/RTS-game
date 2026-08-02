import { getCivilizationDefinition } from './civilizations'
import { applyEquipmentStatsToUnitConfig } from '../lib/equipmentStats'
import type { BuildingConfig, ProjectileConfig, TechnologyConfig, UnitConfig } from '../types/config'
import type { PlayerConfigLike } from '../types/player'

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

const MELEE_SOUNDS = {
  hit: ['sword-attack', 'swing-sword-attack', 'tinkle-sword-attack', 'sword-attack-2'],
  die: ['human-unit-killed-6', 'human-unit-killed-7', 'human-unit-killed-8', 'human-unit-killed-9', 'human-unit-killed-10'],
}

const STONE_START_SOUND = null

const EXTRA_UNIT_DEFINITIONS: Record<string, UnitConfig> = {
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
      standingSheet: 'lpc-baked/longswordman/greek_01/walking',
      walkingSheet: 'lpc-baked/longswordman/greek_01/walking',
      actionSheet: 'lpc-baked/longswordman/greek_01/action',
      dyingSheet: 'lpc-baked/longswordman/greek_01/dying',
      corpseSheet: 'lpc-baked/longswordman/greek_01/corpse',
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
      standingSheet: 'lpc-baked/phalanx/greek_01/walking',
      walkingSheet: 'lpc-baked/phalanx/greek_01/walking',
      actionSheet: 'lpc-baked/phalanx/greek_01/action',
      dyingSheet: 'lpc-baked/phalanx/greek_01/dying',
      corpseSheet: 'lpc-baked/phalanx/greek_01/corpse',
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
      standingSheet: 'lpc-baked/phalanx/greek_01/walking',
      walkingSheet: 'lpc-baked/phalanx/greek_01/walking',
      actionSheet: 'lpc-baked/phalanx/greek_01/action',
      dyingSheet: 'lpc-baked/phalanx/greek_01/dying',
      corpseSheet: 'lpc-baked/phalanx/greek_01/corpse',
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
}

const UNIT_OVERRIDES: Record<string, Partial<UnitConfig>> = {
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

  for (const [unitName, unit] of Object.entries(config.units)) {
    applyEquipmentStatsToUnitConfig(unitName, unit)
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
