import { getCivilizationDefinition } from './civilizations'
import { UNIT_TYPES } from '../constants'
import { SOUND_CUES } from '../constants/sounds'
import { applyEquipmentStatsToUnitConfig } from '../lib/equipmentStats'
import type { BuildingConfig, ProjectileConfig, TechnologyConfig, UnitConfig } from '../types/config'
import type { PlayerConfigLike } from '../types/player'

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

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
}

const EXTRA_PROJECTILES: Record<string, ProjectileConfig> = {
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
