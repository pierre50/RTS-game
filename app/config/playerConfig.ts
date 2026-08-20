import { getCivilizationDefinition } from './civilizations'
import { UNIT_TYPES } from '../constants'
import { SOUND_CUES } from '../constants/sounds'
import { applyEquipmentStatsToUnitConfig } from '../lib/equipmentStats'
import type { BuildingConfig, ProjectileConfig, TechnologyConfig, UnitConfig } from '../types/config'
import type { PlayerConfigLike } from '../types/player'

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

const STONE_START_SOUND = null

function arrowProjectileConfig(assets: string, overrides: Partial<ProjectileConfig> = {}): ProjectileConfig {
  return {
    size: 3,
    speed: 20,
    assets,
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
      launch: SOUND_CUES.projectile.arrowLaunch,
    },
    ...overrides,
  }
}

const LPC_ARROW_PROJECTILE_CONFIG: Partial<ProjectileConfig> = {
  directionalSpawnOffsets: {
    south: { x: -2, y: -3 },
    southwest: { x: -2, y: -3 },
    west: { x: -10, y: 8 },
    northwest: { x: 7, y: -4 },
    north: { x: 7, y: -4 },
    northeast: { x: 7, y: -4 },
    east: { x: 10, y: -10 },
    southeast: { x: -2, y: -3 },
  },
}

const EXTRA_UNIT_DEFINITIONS: Record<string, UnitConfig> = {
  [UNIT_TYPES.banditChief]: {
    category: 'Bandit',
    selectionFactor: 0.75,
    totalHitPoints: 36,
    sight: 7,
    speed: 0.95,
    attackRecoveryMs: 950,
    trainingTime: 0,
    equipment: [
      'axe_ceramic',
      'armor_leather',
      'cape_solid',
      'helmet_barbarian_ceramic',
      'upward_horns_ceramic',
      'round_shield_ceramic_slash',
    ],
    combatBehaviorPreset: 'meleeAggressive',
    cost: {},
  },
  [UNIT_TYPES.banditSword]: {
    category: 'Bandit',
    selectionFactor: 0.65,
    totalHitPoints: 20,
    sight: 7,
    speed: 1,
    attackRecoveryMs: 800,
    trainingTime: 0,
    equipment: ['sword_ceramic', 'helmet_barbarian_nasal_ceramic', 'round_shield_ceramic_slash'],
    combatBehaviorPreset: 'meleeAggressive',
    sounds: {
      hit: SOUND_CUES.unit.swordAttack,
    },
    cost: {},
  },
  [UNIT_TYPES.banditArcher]: {
    category: 'Bandit',
    selectionFactor: 0.6,
    totalHitPoints: 16,
    sight: 8,
    speed: 1,
    attackRecoveryMs: 1000,
    trainingTime: 0,
    equipment: ['quiver', 'bow', 'arrow_ceramic', 'sack_cloth_hood_leather'],
    projectile: 'Arrow',
    combatBehaviorPreset: 'rangedKite',
    cost: {},
  },
  StoneThrower: {
    category: 'Siege',
    selectionFactor: 2,
    totalHitPoints: 75,
    sight: 8,
    speed: 0.8,
    trainingTime: 60,
    equipment: ['stone_thrower_stone'],
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
    trainingTime: 60,
    equipment: ['catapult_stone'],
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
    trainingTime: 50,
    equipment: ['ballista_bolt'],
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

const UNIT_OVERRIDES: Record<string, Partial<UnitConfig>> = {}

const UNIT_COMBAT_BALANCE_OVERRIDES: Record<string, Partial<Pick<UnitConfig, 'meleeArmor' | 'pierceArmor'>>> = {
  [UNIT_TYPES.banditChief]: {
    meleeArmor: 1,
    pierceArmor: 1,
  },
  [UNIT_TYPES.banditSword]: {
    meleeArmor: 1,
    pierceArmor: 0,
  },
  [UNIT_TYPES.banditArcher]: {
    meleeArmor: 0,
    pierceArmor: 0,
  },
}

const BUILDING_OVERRIDES: Record<string, Partial<BuildingConfig>> = {
  ArcheryRange: {
    units: ['Bowman'],
  },
  Stable: {
    units: ['Fantassin', 'Bowman'],
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
  Arrow: arrowProjectileConfig('projectiles/arrow_ceramic', LPC_ARROW_PROJECTILE_CONFIG),
  ArrowCeramic: arrowProjectileConfig('projectiles/arrow_ceramic', LPC_ARROW_PROJECTILE_CONFIG),
  ArrowCopper: arrowProjectileConfig('projectiles/arrow_copper', LPC_ARROW_PROJECTILE_CONFIG),
  ArrowBronze: arrowProjectileConfig('projectiles/arrow_bronze', LPC_ARROW_PROJECTILE_CONFIG),
  ArrowIron: arrowProjectileConfig('projectiles/arrow_iron', LPC_ARROW_PROJECTILE_CONFIG),
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
    Object.assign(unit, UNIT_COMBAT_BALANCE_OVERRIDES[unitName])
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
