const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

const unitExperienceMock = {
  XP_CATEGORIES: {},
  XP_KILL_BONUS: 15,
  getCombatXpBonus: () => 0,
  grantUnitXp: () => {},
}

const unitWorkAppearanceMock = {
  getUnitWorkActionSheet: (unit, work, action) => {
    if (!work) return undefined
    const key = action === 'takemeat' ? 'harvestSheet' : 'actionSheet'
    return unit.allAssets?.[work]?.[key]
  },
}

function loadModule(relativePath, mocks) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    if (request === '../../lib/unitExperience') return unitExperienceMock
    if (request === '../config/gameDifficultyBalance') {
      const balances = {
        easy: {
          enemyAttackEnergyCostMultiplier: 2,
          playerDamageDealtMultiplier: 2,
          playerDamageReceivedMultiplier: 0.5,
        },
        medium: {
          enemyAttackEnergyCostMultiplier: 1,
          playerDamageDealtMultiplier: 1,
          playerDamageReceivedMultiplier: 1,
        },
        hard: {
          enemyAttackEnergyCostMultiplier: 0.8,
          playerDamageDealtMultiplier: 0.75,
          playerDamageReceivedMultiplier: 1.35,
        },
      }
      return {
        GAME_DIFFICULTY_COMBAT_BALANCE: balances,
        getGameDifficultyCombatBalance: difficulty => balances[difficulty] ?? balances.medium,
      }
    }
    if (request === './equipmentStats')
      return { getEntityWeaponPower: entity => entity?.weaponPower ?? 0, UNARMED_UNIT_WEAPON_POWER: 0.5 }
    if (request === '../../lib/equipmentStats') return { getUnitCombatRange: unit => unit?.combatRange ?? 0 }
    if (request === '../../lib/horseCapture') return { getNearestAvailableStableForUnit: () => null }
    if (request === '../../lib/combatAttackLoop') {
      return {
        runAttackLoopOnFrame: (attacker, callbacks) => {
          const sprite = attacker.sprite
          if (!sprite) return
          sprite.loop = true
          callbacks.prepareAttackSheet()
          mocks['../../lib']?.onSpriteLoopAtFrame?.(sprite, callbacks.releaseFrame, () => {
            const target = attacker.dest?.family ? attacker.dest : null
            if (!attacker.getActionCondition?.(target, attacker.action ?? undefined)) {
              callbacks.onTargetUnavailable(target)
              return
            }
            if (!target) return
            if (!attacker.isUnitAtDest?.(attacker.action, target)) {
              callbacks.onOutOfRange(target)
              return
            }
            callbacks.onReadyToAttack(target)
          })
        },
      }
    }
    if (request === './combatBehavior') {
      return {
        getCombatBehavior: unit => ({
          recoveryMode: 'orbit',
          reengageEnergyRatio: 1,
          recoveryMinDistance: 1.1,
          recoveryMaxDistance: 2.7,
          recoveryStrafeDistance: 1,
          recoveryRepositionMs: 750,
          recoverySearchRadius: 5,
          fleeHealthRatio: unit?.combatBehavior?.fleeHealthRatio ?? 0.3,
          aggression: unit?.combatBehavior?.aggression ?? 0.5,
          bravery: unit?.combatBehavior?.bravery ?? 0.35,
        }),
        getCombatMoraleRoll: unit =>
          typeof unit?.combatMoraleRoll === 'number' ? unit.combatMoraleRoll : unit?.label ? 0.5 : 1,
      }
    }
    if (request === './unitUpgrades') return { canUpgradeUnitAtBuilding: () => false }
    if (request === '../../lib/combatBehavior') {
      return {
        markCombatAttack: unit => {
          unit.combatMode = 'attack'
        },
        shouldSuppressAggroDuringCombatRecovery: unit =>
          unit.combatMode === 'recover' && unit.waitingForEnergyAction === constants.ACTION_TYPES.attack,
      }
    }
    if (request === '../../lib/unitEnergy') return { spendOrWaitForEnergy: () => true }
    if (request === '../../lib/unitWorkAppearance') return unitWorkAppearanceMock
    if (request === '../../lib/slashRecoveryAnimation') return { playReverseSlashRecovery: () => false }
    if (request === '../../lib/resourceCarry') {
      return {
        clearCarriedResources: unit => {
          unit.loading = 0
          unit.loadingType = null
        },
        getCarriedResourceEntries: unit =>
          unit.loadingType && (unit.loading ?? 0) > 0 ? [[unit.loadingType, unit.loading]] : [],
      }
    }
    if (request === './maths') return { getReliefOffset: () => 0 }
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const constants = {
  ACTION_TYPES: {
    attack: 'attack',
    convert: 'convert',
  },
  BUCKET_SIZE: 8,
  BUILDING_TYPES: {},
  FAMILY_TYPES: {
    animal: 'animal',
    building: 'building',
    resource: 'resource',
    unit: 'unit',
  },
  RESOURCE_TYPES: {
    berrybush: 'Berrybush',
  },
  UNIT_TYPES: {
    banditSword: 'BanditSword',
    chief: 'Chief',
    hero: 'Hero',
    priest: 'Priest',
    villager: 'Villager',
  },
  SHEET_TYPES: {
    action: 'actionSheet',
    standing: 'standingSheet',
  },
  WORK_TYPES: {
    attacker: 'attacker',
  },
  WORK_FOOD_TYPES: [],
}

const owner = {
  isEnemy: targetOwner => targetOwner?.label === 'enemy',
}
const target = {
  family: constants.FAMILY_TYPES.unit,
  hitPoints: 20,
  isDead: false,
  owner: { label: 'enemy' },
}

test('units with no weapon config can attack enemies with unarmed power', () => {
  const { getActionCondition } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
    './equipmentStats': { getEntityWeaponPower: entity => entity?.weaponPower ?? 0, UNARMED_UNIT_WEAPON_POWER: 0.5 },
  })

  const villager = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 45,
    isDead: false,
    owner,
    type: 'Villager',
    weaponPower: 0.5,
  }

  assert.equal(getActionCondition(villager, target, 'attack'), true)
})

test('combat weapons cannot attack neutral berry bushes', () => {
  const { getActionCondition } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
    './equipmentStats': { getEntityWeaponPower: entity => entity?.weaponPower ?? 0, UNARMED_UNIT_WEAPON_POWER: 0.5 },
  })

  const swordsman = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 45,
    isDead: false,
    owner,
    type: 'Villager',
    weaponPower: 4,
  }
  const berrybush = {
    family: constants.FAMILY_TYPES.resource,
    hitPoints: 40,
    isDead: false,
    quantity: 100,
    type: constants.RESOURCE_TYPES.berrybush,
  }

  assert.equal(getActionCondition(swordsman, berrybush, 'attack'), false)
})

test('attack orders cannot target neutral berry bushes', () => {
  const { getActionCondition } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
    './equipmentStats': { getEntityWeaponPower: entity => entity?.weaponPower ?? 0, UNARMED_UNIT_WEAPON_POWER: 0.5 },
  })

  const swordsman = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 45,
    isDead: false,
    owner,
    type: 'Fantassin',
    weaponPower: 4,
  }
  const berrybush = {
    family: constants.FAMILY_TYPES.resource,
    hitPoints: 40,
    isDead: false,
    quantity: 100,
    type: constants.RESOURCE_TYPES.berrybush,
  }

  assert.equal(getActionCondition(swordsman, berrybush, 'attack'), false)
})

test('sendToAttack does not issue an attack order against neutral berry bushes', () => {
  const { getActionCondition } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
    './equipmentStats': { getEntityWeaponPower: entity => entity?.weaponPower ?? 0, UNARMED_UNIT_WEAPON_POWER: 0.5 },
  })
  const sendCalls = []
  const { UnitCommands } = loadModule('app/classes/unit/UnitCommands.ts', {
    '../../constants': constants,
    '../../lib': {
      getActionCondition,
      getAutonomyJobForWork: () => null,
      getClosestInstance: () => false,
      getInstanceDegree: () => 0,
      getInstancePath: () => [],
      getWorkWithLoadingType: () => null,
      isWheatMature: () => false,
      setVillagerAutonomy: () => {},
    },
    '../../lib/diplomaticAggression': { applyDiplomaticAggression: () => ({ hostileNow: false }) },
    '../../lib/lang': { t: key => key },
    '../../lib/unitControl': { isHeroControlled: () => false },
    '../../lib/unitWorkAppearance': { applyUnitWorkAssets: () => {} },
  })

  const berrybush = {
    family: constants.FAMILY_TYPES.resource,
    hitPoints: 40,
    i: 3,
    isDead: false,
    j: 4,
    quantity: 100,
    type: constants.RESOURCE_TYPES.berrybush,
  }
  const unit = {
    action: null,
    actionLocked: false,
    buildQueue: [],
    context: {},
    dest: null,
    hitPoints: 45,
    isDead: false,
    isUnitAtDest: () => false,
    owner: { isEnemy: targetOwner => targetOwner?.label === 'enemy', isPlayed: false },
    path: [],
    sendToEvt: (target, action) => sendCalls.push({ action, target }),
    type: 'Fantassin',
    weaponPower: 4,
    work: null,
  }

  assert.equal(new UnitCommands(unit).sendToAttack(berrybush), undefined)
  assert.deepEqual(sendCalls, [])
})

test('villagers can still forage neutral berry bushes', () => {
  const { getActionCondition } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
    './equipmentStats': { getEntityWeaponPower: entity => entity?.weaponPower ?? 0, UNARMED_UNIT_WEAPON_POWER: 0.5 },
  })

  const villager = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 45,
    isDead: false,
    owner,
    type: 'Villager',
    weaponPower: 0.5,
  }
  const berrybush = {
    family: constants.FAMILY_TYPES.resource,
    hitPoints: 40,
    isDead: false,
    quantity: 100,
    type: constants.RESOURCE_TYPES.berrybush,
  }

  assert.equal(getActionCondition(villager, berrybush, 'forageberry'), true)
})

test('villagers flee from anything that fights back, human or AI-controlled alike', () => {
  const { shouldFleeWhenAttacked } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
    './equipmentStats': { getEntityWeaponPower: entity => entity?.weaponPower ?? 0, UNARMED_UNIT_WEAPON_POWER: 0.5 },
  })
  const villager = { category: 'Civilian', hitPoints: 25, weaponPower: 3, totalHitPoints: 25, type: 'Villager' }
  const enemySoldier = { family: 'unit', hitPoints: 40, totalHitPoints: 40, type: 'Fantassin' }

  assert.equal(shouldFleeWhenAttacked(villager, enemySoldier), true)
})

test('villagers keep hunting a nearly-dead animal instead of fleeing full health', () => {
  const { shouldFleeWhenAttacked } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
    './equipmentStats': { getEntityWeaponPower: entity => entity?.weaponPower ?? 0, UNARMED_UNIT_WEAPON_POWER: 0.5 },
  })
  const villager = { category: 'Civilian', hitPoints: 25, weaponPower: 3, totalHitPoints: 25, type: 'Villager' }
  const woundedDeer = { family: 'animal', hitPoints: 2, weaponPower: 1, totalHitPoints: 20, type: 'Deer' }

  assert.equal(shouldFleeWhenAttacked(villager, woundedDeer), false)
})

test('villagers retreat from a healthy animal once critically hurt themselves', () => {
  const { shouldFleeWhenAttacked } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
    './equipmentStats': { getEntityWeaponPower: entity => entity?.weaponPower ?? 0, UNARMED_UNIT_WEAPON_POWER: 0.5 },
  })
  const woundedVillager = { category: 'Civilian', hitPoints: 5, weaponPower: 3, totalHitPoints: 25, type: 'Villager' }
  const healthyBoar = { family: 'animal', hitPoints: 40, weaponPower: 6, totalHitPoints: 40, type: 'Boar' }

  assert.equal(shouldFleeWhenAttacked(woundedVillager, healthyBoar), true)
})

test('heroes and chiefs hold their ground like combatants instead of fleeing every hit', () => {
  const { shouldFleeWhenAttacked } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
    './equipmentStats': { getEntityWeaponPower: entity => entity?.weaponPower ?? 0, UNARMED_UNIT_WEAPON_POWER: 0.5 },
  })
  const healthyHero = { category: 'Civilian', hitPoints: 45, weaponPower: 5, totalHitPoints: 45, type: 'Hero' }
  const chief = { category: 'Civilian', hitPoints: 45, weaponPower: 5, totalHitPoints: 45, type: 'Chief' }
  const enemySoldier = { family: 'unit', hitPoints: 40, totalHitPoints: 40, type: 'Fantassin' }

  assert.equal(shouldFleeWhenAttacked(healthyHero, enemySoldier), false)
  assert.equal(shouldFleeWhenAttacked(chief, enemySoldier), false)
})

test('priests cannot convert bandit units', () => {
  const { getActionCondition } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const playerOwner = {
    isEnemy: targetOwner => targetOwner?.label === 'bandits',
    label: 'player',
    technologies: [],
  }
  const banditOwner = {
    isEnemy: targetOwner => targetOwner?.label === 'player',
    label: 'bandits',
  }
  const priest = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 25,
    isDead: false,
    owner: playerOwner,
    type: constants.UNIT_TYPES.priest,
  }
  const bandit = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    owner: banditOwner,
    type: constants.UNIT_TYPES.banditSword,
  }
  const soldier = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    owner: banditOwner,
    type: 'Fantassin',
  }

  assert.equal(getActionCondition(priest, soldier, constants.ACTION_TYPES.convert), true)
  assert.equal(getActionCondition(priest, bandit, constants.ACTION_TYPES.convert), false)
})

test('bandit-owned priests cannot convert units into the bandit team', () => {
  const { getActionCondition } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const banditOwner = {
    isEnemy: targetOwner => targetOwner?.label === 'player',
    label: 'bandit-owner',
    name: 'Bandits',
    isPlayed: false,
    technologies: [],
  }
  const playerOwner = {
    isEnemy: targetOwner => targetOwner?.label === 'bandit-owner',
    label: 'player',
    technologies: [],
  }
  const banditPriest = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 25,
    isDead: false,
    owner: banditOwner,
    type: constants.UNIT_TYPES.priest,
  }
  const soldier = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    owner: playerOwner,
    type: 'Fantassin',
  }

  assert.equal(getActionCondition(banditPriest, soldier, constants.ACTION_TYPES.convert), false)
})

test('early resource actions require only their remaining unlocking technologies', () => {
  const actionConstants = {
    ...constants,
    ACTION_TYPES: {
      farm: 'farm',
      hunt: 'hunt',
      minegold: 'minegold',
      minestone: 'minestone',
      takemeat: 'takemeat',
    },
    RESOURCE_TYPES: { gold: 'Gold', stone: 'Stone', wheat: 'Wheat' },
  }
  const { getActionCondition } = loadModule('app/lib/combat.ts', {
    '../constants': actionConstants,
  })
  const source = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 25,
    isDead: false,
    owner: { label: 'player', technologies: [] },
    type: constants.UNIT_TYPES.villager,
  }
  const deer = {
    family: constants.FAMILY_TYPES.animal,
    hitPoints: 10,
    isDead: false,
    quantity: 20,
  }
  const carcass = { ...deer, hitPoints: 0, isDead: true }
  const stone = {
    family: 'resource',
    isDead: false,
    quantity: 100,
    type: 'Stone',
  }
  const gold = { ...stone, type: 'Gold' }
  const wheat = {
    family: constants.FAMILY_TYPES.resource,
    isDead: false,
    isUsedBy: null,
    quantity: 10,
    sprite: { currentFrame: 0, textures: [{}, {}, {}, {}, {}] },
    type: 'Wheat',
  }

  assert.equal(getActionCondition(source, deer, 'hunt'), true)
  assert.equal(getActionCondition(source, carcass, 'takemeat'), true)
  assert.equal(getActionCondition(source, stone, 'minestone'), false)
  assert.equal(getActionCondition(source, gold, 'minegold'), false)
  assert.equal(getActionCondition(source, wheat, 'farm'), false)

  source.owner.technologies.push('Pickaxe', 'Farming')

  assert.equal(getActionCondition(source, deer, 'hunt'), true)
  assert.equal(getActionCondition(source, carcass, 'takemeat'), true)
  assert.equal(getActionCondition(source, stone, 'minestone'), true)
  assert.equal(getActionCondition(source, gold, 'minegold'), true)
  assert.equal(getActionCondition(source, wheat, 'farm'), false)

  wheat.sprite.currentFrame = wheat.sprite.textures.length - 1
  assert.equal(getActionCondition(source, wheat, 'farm'), true)

  const otherVillager = { owner: source.owner, type: constants.UNIT_TYPES.villager }
  wheat.isUsedBy = otherVillager
  assert.equal(getActionCondition(source, wheat, 'farm'), false)
  assert.equal(getActionCondition({ ...source, type: constants.UNIT_TYPES.hero }, wheat, 'farm'), true)
})

test('military units fight on until critically wounded, then retreat from a real threat', () => {
  const { shouldFleeWhenAttacked } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
    './equipmentStats': { getEntityWeaponPower: entity => entity?.weaponPower ?? 0, UNARMED_UNIT_WEAPON_POWER: 0.5 },
  })
  const healthySoldier = { category: 'Fantassin', hitPoints: 40, weaponPower: 3, totalHitPoints: 40, type: 'Fantassin' }
  const criticalSoldier = { category: 'Fantassin', hitPoints: 5, weaponPower: 3, totalHitPoints: 40, type: 'Fantassin' }
  const healthyEnemy = { family: 'unit', hitPoints: 40, totalHitPoints: 40, type: 'Fantassin' }
  const nearlyDeadEnemy = { family: 'unit', hitPoints: 2, totalHitPoints: 40, type: 'Fantassin' }

  assert.equal(shouldFleeWhenAttacked(healthySoldier, healthyEnemy), false)
  assert.equal(shouldFleeWhenAttacked(criticalSoldier, healthyEnemy), true)
  // Even critically wounded, finishing off a nearly-dead enemy beats running from it.
  assert.equal(shouldFleeWhenAttacked(criticalSoldier, nearlyDeadEnemy), false)
})

test('brave combatants can hold their ground when critically wounded', () => {
  const { shouldFleeWhenAttacked } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
    './equipmentStats': { getEntityWeaponPower: entity => entity?.weaponPower ?? 0, UNARMED_UNIT_WEAPON_POWER: 0.5 },
  })
  const braveSoldier = {
    category: 'Fantassin',
    combatBehavior: { bravery: 0.9, fleeHealthRatio: 0.3 },
    combatMoraleRoll: 0.1,
    hitPoints: 5,
    weaponPower: 3,
    totalHitPoints: 40,
    type: 'Fantassin',
  }
  const healthyEnemy = { family: 'unit', hitPoints: 40, totalHitPoints: 40, type: 'Fantassin' }

  assert.equal(shouldFleeWhenAttacked(braveSoldier, healthyEnemy), false)
})

test('low-bravery combatants still flee when critically wounded', () => {
  const { shouldFleeWhenAttacked } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
    './equipmentStats': { getEntityWeaponPower: entity => entity?.weaponPower ?? 0, UNARMED_UNIT_WEAPON_POWER: 0.5 },
  })
  const cautiousSoldier = {
    category: 'Fantassin',
    combatBehavior: { bravery: 0.2, fleeHealthRatio: 0.3 },
    combatMoraleRoll: 0.9,
    hitPoints: 5,
    weaponPower: 3,
    totalHitPoints: 40,
    type: 'Fantassin',
  }
  const healthyEnemy = { family: 'unit', hitPoints: 40, totalHitPoints: 40, type: 'Fantassin' }

  assert.equal(shouldFleeWhenAttacked(cautiousSoldier, healthyEnemy), true)
})

function makeMoraleMap(entities, { escape = true } = {}) {
  const size = 10
  const grid = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => ({
      i,
      j,
      border: false,
      category: 'Land',
      solid: !escape,
    }))
  )
  if (escape) grid[5][4].solid = false
  const bucket = new Set(entities)
  const instanceBuckets = [[bucket]]
  const context = { map: { grid, instanceBuckets } }
  for (const entity of entities) entity.context = context
  return context
}

function makeMoraleUnit(extra = {}) {
  return {
    category: 'Fantassin',
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 40,
    i: 4,
    isDead: false,
    j: 4,
    weaponPower: 3,
    owner,
    totalHitPoints: 40,
    type: 'Fantassin',
    ...extra,
  }
}

test('a trapped, badly wounded villager surrenders when local enemy force is overwhelming', () => {
  const { evaluateCombatMorale } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const villager = makeMoraleUnit({
    category: 'Civilian',
    hitPoints: 5,
    weaponPower: 3,
    totalHitPoints: 25,
    type: constants.UNIT_TYPES.villager,
  })
  const enemies = [0, 1, 2].map(offset =>
    makeMoraleUnit({
      hitPoints: 40,
      i: 3 + offset,
      j: 4,
      owner: { label: 'enemy' },
      type: 'Fantassin',
    })
  )
  makeMoraleMap([villager, ...enemies], { escape: false })

  assert.equal(evaluateCombatMorale(villager, enemies[0]), 'surrender')
})

test('a badly wounded villager with an escape route flees instead of surrendering', () => {
  const { evaluateCombatMorale } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const villager = makeMoraleUnit({
    category: 'Civilian',
    hitPoints: 5,
    weaponPower: 3,
    totalHitPoints: 25,
    type: constants.UNIT_TYPES.villager,
  })
  const enemy = makeMoraleUnit({ i: 3, owner: { label: 'enemy' }, type: 'Fantassin' })
  makeMoraleMap([villager, enemy], { escape: true })

  assert.equal(evaluateCombatMorale(villager, enemy), 'flee')
})

test('a supported soldier does not surrender just because enemies are nearby', () => {
  const { evaluateCombatMorale } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const soldier = makeMoraleUnit({ hitPoints: 25 })
  const ally = makeMoraleUnit({ hitPoints: 50, i: 4, j: 5, weaponPower: 8 })
  const enemies = [0, 1].map(offset =>
    makeMoraleUnit({
      hitPoints: 35,
      i: 3 + offset,
      j: 4,
      owner: { label: 'enemy' },
      type: 'Fantassin',
    })
  )
  makeMoraleMap([soldier, ally, ...enemies], { escape: false })

  assert.equal(evaluateCombatMorale(soldier, enemies[0]), 'fight')
})

test('a trapped, critically wounded soldier can surrender to an overwhelming enemy group', () => {
  const { evaluateCombatMorale } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const soldier = makeMoraleUnit({ hitPoints: 5 })
  const enemies = [0, 1, 2].map(offset =>
    makeMoraleUnit({
      hitPoints: 45,
      i: 3 + offset,
      j: 4,
      weaponPower: 7,
      owner: { label: 'enemy' },
      type: 'Fantassin',
    })
  )
  makeMoraleMap([soldier, ...enemies], { escape: false })

  assert.equal(evaluateCombatMorale(soldier, enemies[0]), 'surrender')
})

test('a brave trapped soldier keeps fighting instead of surrendering from morale', () => {
  const { evaluateCombatMorale } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const soldier = makeMoraleUnit({
    combatBehavior: { bravery: 0.95, fleeHealthRatio: 0.3 },
    combatMoraleRoll: 0.1,
    hitPoints: 5,
  })
  const enemies = [0, 1, 2].map(offset =>
    makeMoraleUnit({
      hitPoints: 45,
      i: 3 + offset,
      j: 4,
      weaponPower: 7,
      owner: { label: 'enemy' },
      type: 'Fantassin',
    })
  )
  makeMoraleMap([soldier, ...enemies], { escape: false })

  assert.equal(evaluateCombatMorale(soldier, enemies[0]), 'fight')
})

test('heroes and chiefs never auto-surrender from morale checks', () => {
  const { evaluateCombatMorale } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const hero = makeMoraleUnit({
    category: 'Civilian',
    hitPoints: 4,
    totalHitPoints: 45,
    type: constants.UNIT_TYPES.hero,
  })
  const enemy = makeMoraleUnit({ owner: { label: 'enemy' }, type: 'Fantassin' })
  makeMoraleMap([hero, enemy], { escape: false })

  assert.notEqual(evaluateCombatMorale(hero, enemy), 'surrender')
})

test('units with weapon config can attack enemies', () => {
  const { getActionCondition } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })

  const scoutShip = {
    hitPoints: 120,
    isDead: false,
    owner,
    weaponPower: 5,
    type: 'ScoutShip',
  }

  assert.equal(getActionCondition(scoutShip, target, 'attack'), true)
})

test('units cannot attack or damage friendly units', () => {
  const { getActionCondition, getHitPointsWithDamage, isFriendlyTarget } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const friendlyOwner = { label: 'player' }
  const scoutShip = {
    hitPoints: 120,
    isDead: false,
    owner: { label: 'player', isEnemy: targetOwner => targetOwner?.label === 'enemy' },
    weaponPower: 5,
    type: 'ScoutShip',
  }
  const friendlyTarget = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    owner: friendlyOwner,
  }

  assert.equal(isFriendlyTarget(scoutShip, friendlyTarget), true)
  assert.equal(getActionCondition(scoutShip, friendlyTarget, 'attack'), false)
  assert.equal(getHitPointsWithDamage(scoutShip, friendlyTarget), 20)
})

test('units cannot attack or damage allied-team units', () => {
  const { getActionCondition, getHitPointsWithDamage, isFriendlyTarget } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const alliedOwner = { label: 'ally', team: 1 }
  const scoutShip = {
    hitPoints: 120,
    isDead: false,
    owner: { label: 'player', team: 1, isEnemy: targetOwner => targetOwner?.team !== 1 },
    weaponPower: 5,
    type: 'ScoutShip',
  }
  const alliedTarget = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    owner: alliedOwner,
  }

  assert.equal(isFriendlyTarget(scoutShip, alliedTarget), true)
  assert.equal(getActionCondition(scoutShip, alliedTarget, 'attack'), false)
  assert.equal(getHitPointsWithDamage(scoutShip, alliedTarget), 20)
})

test('unarmed units deal half a point of damage', () => {
  const { getHitPointsWithDamage } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const attacker = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    owner,
    type: 'Villager',
    weaponPower: 0.5,
  }
  const enemy = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    owner: { label: 'enemy' },
  }

  assert.equal(getHitPointsWithDamage(attacker, enemy), 19.5)
})

test('melee damage uses melee armor instead of the best armor value', () => {
  const { getHitPointsWithDamage } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const attacker = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    owner,
    type: 'Fantassin',
    weaponPower: 10,
  }
  const enemy = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    meleeArmor: 2,
    owner: { label: 'enemy' },
    pierceArmor: 8,
  }

  assert.equal(getHitPointsWithDamage(attacker, enemy), 12)
})

test('pierce damage uses pierce armor and still applies armor to default damage', () => {
  const { getHitPointsWithDamage } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const attacker = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    owner,
    type: 'Bowman',
    weaponPower: 10,
  }
  const enemy = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    meleeArmor: 8,
    owner: { label: 'enemy' },
    pierceArmor: 2,
  }

  assert.equal(getHitPointsWithDamage(attacker, enemy, undefined, 0, 'pierce'), 12)
  assert.equal(getHitPointsWithDamage(attacker, enemy, 6, 0, 'pierce'), 16)
})

test('easy combat difficulty increases played damage against enemies', () => {
  const { getHitPointsWithDamage } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const playedOwner = { label: 'player', isPlayed: true, isEnemy: targetOwner => targetOwner?.label === 'enemy' }
  const enemyOwner = { label: 'enemy', isEnemy: targetOwner => targetOwner?.label === 'player' }
  const attacker = {
    context: { map: { difficulty: 'easy' } },
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    owner: playedOwner,
    type: 'Fantassin',
    weaponPower: 6,
  }
  const enemy = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    owner: enemyOwner,
  }

  assert.equal(getHitPointsWithDamage(attacker, enemy), 8)
})

test('easy combat difficulty reduces enemy damage against played units', () => {
  const { getHitPointsWithDamage } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const playedOwner = { label: 'player', isPlayed: true, isEnemy: targetOwner => targetOwner?.label === 'enemy' }
  const enemyOwner = { label: 'enemy', isEnemy: targetOwner => targetOwner?.label === 'player' }
  const attacker = {
    context: { map: { difficulty: 'easy' } },
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    owner: enemyOwner,
    type: 'Fantassin',
    weaponPower: 8,
  }
  const target = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    owner: playedOwner,
  }

  assert.equal(getHitPointsWithDamage(attacker, target), 16)
})

test('combat difficulty treats armed animals as threats but leaves passive hunting unchanged', () => {
  const { getHitPointsWithDamage } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const playedOwner = { label: 'player', isPlayed: true, isEnemy: () => false }
  const attacker = {
    context: { map: { difficulty: 'easy' } },
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    owner: playedOwner,
    type: 'Fantassin',
    weaponPower: 10,
  }
  const boar = {
    family: constants.FAMILY_TYPES.animal,
    hitPoints: 20,
    isDead: false,
    weaponPower: 3,
  }
  const deer = {
    family: constants.FAMILY_TYPES.animal,
    hitPoints: 20,
    isDead: false,
  }

  assert.equal(getHitPointsWithDamage(attacker, boar), 0)
  assert.equal(getHitPointsWithDamage(attacker, deer), 10)
})

test('medium combat difficulty keeps current damage unchanged', () => {
  const { getHitPointsWithDamage } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const playedOwner = { label: 'player', isPlayed: true, isEnemy: targetOwner => targetOwner?.label === 'enemy' }
  const enemyOwner = { label: 'enemy', isEnemy: targetOwner => targetOwner?.label === 'player' }
  const attacker = {
    context: { map: { difficulty: 'medium' } },
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    owner: playedOwner,
    type: 'Fantassin',
    weaponPower: 6,
  }
  const enemy = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    isDead: false,
    owner: enemyOwner,
  }

  assert.equal(getHitPointsWithDamage(attacker, enemy), 14)
})

test('hero defense blocks incoming damage and flashes', () => {
  const { getHitPointsWithDamage } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const flashes = []
  const attacker = {
    hitPoints: 20,
    isDead: false,
    weaponPower: 8,
    owner,
    type: 'Fantassin',
  }
  const defendingHero = {
    family: constants.FAMILY_TYPES.unit,
    heroDefenseActive: true,
    hitPoints: 20,
    isDead: false,
    meleeArmor: 0,
    owner: { label: 'enemy' },
    showHeroDefenseFlash: () => flashes.push('flash'),
  }

  assert.equal(getHitPointsWithDamage(attacker, defendingHero), 20)
  assert.deepEqual(flashes, ['flash'])
})

test('hero defense blocks animal attack damage too', () => {
  const { getHitPointsWithDamage } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })
  const flashes = []
  const animal = {
    family: constants.FAMILY_TYPES.animal,
    hitPoints: 20,
    isDead: false,
    weaponPower: 6,
    owner,
    type: 'Lion',
  }
  const defendingHero = {
    family: constants.FAMILY_TYPES.unit,
    heroDefenseActive: true,
    hitPoints: 20,
    isDead: false,
    owner: { label: 'enemy' },
    showHeroDefenseFlash: () => flashes.push('flash'),
  }

  assert.equal(getHitPointsWithDamage(animal, defendingHero), 20)
  assert.deepEqual(flashes, ['flash'])
})

function realAngleDelta(a, b) {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

function realGetPointsDegree(x1, y1, x2, y2) {
  const tX = x2 - x1
  const tY = y2 - y1
  return Math.round((Math.atan2(tY, tX) * 180) / Math.PI + 180)
}

const mathsMock = { angleDelta: realAngleDelta, getPointsDegree: realGetPointsDegree }

test('hero defense still blocks a hit landing in front of the hero', () => {
  const { getHitPointsWithDamage } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
    './maths': mathsMock,
  })
  const flashes = []
  const attacker = { hitPoints: 20, isDead: false, weaponPower: 8, owner, type: 'Fantassin', x: 10, y: 0 }
  const defendingHero = {
    degree: 180,
    family: constants.FAMILY_TYPES.unit,
    heroDefenseActive: true,
    hitPoints: 20,
    isDead: false,
    meleeArmor: 0,
    owner: { label: 'enemy' },
    showHeroDefenseFlash: () => flashes.push('flash'),
    x: 0,
    y: 0,
  }

  assert.equal(getHitPointsWithDamage(attacker, defendingHero), 20)
  assert.deepEqual(flashes, ['flash'])
})

test('hero defense still blocks a hit landing exactly at the edge of the frontal arc (side hit)', () => {
  const { getHitPointsWithDamage } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
    './maths': mathsMock,
  })
  const flashes = []
  const attacker = { hitPoints: 20, isDead: false, weaponPower: 8, owner, type: 'Fantassin', x: 0, y: 10 }
  const defendingHero = {
    degree: 180,
    family: constants.FAMILY_TYPES.unit,
    heroDefenseActive: true,
    hitPoints: 20,
    isDead: false,
    meleeArmor: 0,
    owner: { label: 'enemy' },
    showHeroDefenseFlash: () => flashes.push('flash'),
    x: 0,
    y: 0,
  }

  assert.equal(getHitPointsWithDamage(attacker, defendingHero), 20)
  assert.deepEqual(flashes, ['flash'])
})

test('hero defense does not block a hit landing behind the hero, even while active', () => {
  const { getHitPointsWithDamage } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
    './maths': mathsMock,
  })
  const flashes = []
  const attacker = { hitPoints: 20, isDead: false, weaponPower: 8, owner, type: 'Fantassin', x: -10, y: 0 }
  const defendingHero = {
    degree: 180,
    family: constants.FAMILY_TYPES.unit,
    heroDefenseActive: true,
    hitPoints: 20,
    isDead: false,
    meleeArmor: 0,
    owner: { label: 'enemy' },
    showHeroDefenseFlash: () => flashes.push('flash'),
    x: 0,
    y: 0,
  }

  assert.equal(getHitPointsWithDamage(attacker, defendingHero), 12)
  assert.deepEqual(flashes, [])
})

test('hero defense with no position data on either side fails open (still blocks)', () => {
  const { getHitPointsWithDamage } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
    './maths': mathsMock,
  })
  const flashes = []
  const attacker = { hitPoints: 20, isDead: false, weaponPower: 8, owner, type: 'Fantassin' }
  const defendingHero = {
    family: constants.FAMILY_TYPES.unit,
    heroDefenseActive: true,
    hitPoints: 20,
    isDead: false,
    meleeArmor: 0,
    owner: { label: 'enemy' },
    showHeroDefenseFlash: () => flashes.push('flash'),
  }

  assert.equal(getHitPointsWithDamage(attacker, defendingHero), 20)
  assert.deepEqual(flashes, ['flash'])
})

test('hero-controlled units do not use unit auto-detection attacks', () => {
  const calls = []
  const { UnitCombat } = loadModule('app/classes/unit/UnitCombat.ts', {
    '../../constants': constants,
    '../../lib': {
      applyCombatHit: (_source, target) => {
        target.hitPoints = 0
        target.die?.()
        return { damageDealt: 5, killed: true }
      },
      degreeToDirection: () => 'south',
      findInstancesInSight: () => [],
      getClosestInstanceWithPath: () => null,
      getHitPointsWithDamage: () => 0,
      getInstanceDegree: () => 0,
      instanceContactInstance: () => false,
      onSpriteLoopAtFrame: () => {},
      playAudibleSoundCue: () => {},
      BOW_SHOOT_RELEASE_FRAME: 8,
      SLASH_IMPACT_FRAME: 5,
      syncAnimationSpeedToRate: () => {},
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/combatFeedback': { showDamageFeedback: () => {} },
    '../../lib/unitControl': { canAutoAcquireTarget: () => false },
  })
  const unit = {
    context: { editor: null },
    dest: null,
    getActionCondition: () => true,
    path: [],
    sendTo: () => calls.push('sendTo'),
    work: constants.WORK_TYPES.attacker,
  }

  new UnitCombat(unit).detect({ family: constants.FAMILY_TYPES.unit })

  assert.deepEqual(calls, [])
})

test('attacker units show alert feedback when detection starts an attack', () => {
  const calls = []
  const { UnitCombat } = loadModule('app/classes/unit/UnitCombat.ts', {
    '../../constants': constants,
    '../../lib': {
      applyCombatHit: (_source, target) => {
        target.hitPoints = 0
        target.die?.()
        return { damageDealt: 5, killed: true }
      },
      degreeToDirection: () => 'south',
      findInstancesInSight: () => [],
      getClosestInstanceWithPath: () => null,
      getHitPointsWithDamage: () => 0,
      getInstanceDegree: () => 0,
      instanceContactInstance: () => false,
      onSpriteLoopAtFrame: () => {},
      playAudibleSoundCue: () => {},
      BOW_SHOOT_RELEASE_FRAME: 8,
      SLASH_IMPACT_FRAME: 5,
      syncAnimationSpeedToRate: () => {},
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/combatFeedback': {
      showAlertThenAggressionFeedback: (unit, onAggression) => {
        calls.push(['alertThenAggression', unit.label])
        onAggression()
      },
      showDamageFeedback: () => {},
    },
    '../../lib/unitControl': { canAutoAcquireTarget: () => true },
    '../../lib/unitEnergy': { spendOrWaitForEnergy: () => true },
  })
  const target = { family: constants.FAMILY_TYPES.unit }
  const unit = {
    context: { editor: null },
    dest: null,
    getActionCondition: instance => instance === target,
    label: 'guard-1',
    path: [],
    sendTo: instance => calls.push(['sendTo', instance]),
    work: constants.WORK_TYPES.attacker,
  }

  new UnitCombat(unit).detect(target)

  assert.deepEqual(calls, [
    ['alertThenAggression', 'guard-1'],
    ['sendTo', target],
  ])
})

test('melee attacks finish their current animation loop before resuming after a kill', () => {
  let impactCallback = null
  const calls = []
  const { UnitCombat } = loadModule('app/classes/unit/UnitCombat.ts', {
    '../../constants': constants,
    '../../lib': {
      applyCombatHit: (_source, target) => {
        target.hitPoints = 0
        target.die?.()
        return { damageDealt: 5, killed: true }
      },
      degreeToDirection: () => 'south',
      findInstancesInSight: () => [],
      getClosestInstanceWithPath: () => null,
      getHitPointsWithDamage: () => 0,
      getInstanceDegree: () => 0,
      instanceContactInstance: () => true,
      onSpriteLoopAtFrame: (_sprite, _frame, callback) => {
        impactCallback = callback
      },
      playAudibleSoundCue: () => {},
      BOW_SHOOT_RELEASE_FRAME: 8,
      SLASH_IMPACT_FRAME: 5,
      syncAnimationSpeedToRate: () => {},
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/combatFeedback': {
      showAlertThenAggressionFeedback: () => {},
      showDamageFeedback: () => {},
    },
    '../../lib/unitControl': { canAutoAcquireTarget: () => true },
    '../../lib/unitEnergy': { spendOrWaitForEnergy: () => true },
  })
  const target = {
    family: constants.FAMILY_TYPES.animal,
    hitPoints: 5,
    isDead: false,
    die() {
      this.isDead = true
      calls.push('die')
    },
  }
  const sprite = {
    loop: false,
    onComplete: null,
    onFrameChange: null,
    onLoop: null,
    textures: [1, 2, 3],
  }
  const unit = {
    action: constants.ACTION_TYPES.attack,
    dest: target,
    flushPendingOrder: () => false,
    getActionCondition: instance => instance === target && (target.hitPoints ?? 0) > 0 && !target.isDead,
    isUnitAtDest: () => true,
    rateOfFire: 1,
    setTextures: sheet => calls.push(['setTextures', sheet]),
    sprite,
    affectNewDest: () => calls.push('affectNewDest'),
  }

  new UnitCombat(unit).handleAttackAction()
  assert.equal(typeof impactCallback, 'function')

  impactCallback()

  assert.deepEqual(calls, [['setTextures', constants.SHEET_TYPES.action], 'die'])
  assert.equal(unit.actionLocked, true)
  assert.equal(sprite.onFrameChange, undefined)
  assert.equal(typeof sprite.onLoop, 'function')

  sprite.onLoop()

  assert.deepEqual(calls, [['setTextures', constants.SHEET_TYPES.action], 'die', 'affectNewDest'])
  assert.equal(unit.actionLocked, false)
  assert.equal(sprite.onLoop, undefined)
})

test('unit control policy disables automatic reactions for the active hero-controlled unit', () => {
  const hero = {}
  const { canAutoAcquireTarget, canAutoReactToAttack, isHeroControlled, setUnitControlMode } = loadModule(
    'app/lib/unitControl.ts',
    {}
  )

  const unit = {
    context: {
      controls: {
        heroUnit: hero,
        isHeroControlActive: () => true,
      },
    },
  }
  Object.assign(hero, unit)

  assert.equal(isHeroControlled(hero), true)
  assert.equal(canAutoAcquireTarget(hero), false)
  assert.equal(canAutoReactToAttack(hero), false)

  const explicitHero = {}
  setUnitControlMode(explicitHero, 'hero')
  assert.equal(isHeroControlled(explicitHero), true)
  assert.equal(canAutoAcquireTarget(explicitHero), false)

  const explicitStandardUnit = {
    context: unit.context,
  }
  setUnitControlMode(explicitStandardUnit, 'standard')
  assert.equal(isHeroControlled(explicitStandardUnit), false)
  assert.equal(canAutoReactToAttack(explicitStandardUnit), true)
})

test('melee unit attacks damage targets with weapon damage', () => {
  let impactCallback = null
  const applyCalls = []
  const { UnitCombat } = loadModule('app/classes/unit/UnitCombat.ts', {
    '../../constants': constants,
    '../../lib': {
      applyCombatHit: (_source, target, options) => {
        applyCalls.push({ target, defaultDamage: options.defaultDamage })
        target.hitPoints -= 4
        return { damageDealt: 4, killed: false }
      },
      degreeToDirection: () => 'south',
      findInstancesInSight: () => [],
      getClosestInstanceWithPath: () => null,
      getInstanceDegree: () => 0,
      instanceContactInstance: () => true,
      onSpriteLoopAtFrame: (_sprite, _frame, callback) => {
        impactCallback = callback
      },
      playAudibleSoundCue: () => {},
      BOW_SHOOT_RELEASE_FRAME: 8,
      SLASH_IMPACT_FRAME: 5,
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/combatFeedback': { showDamageFeedback: () => {} },
    '../../lib/unitControl': { canAutoAcquireTarget: () => true },
    '../../lib/unitEnergy': { spendOrWaitForEnergy: () => true },
  })
  const enemyUnit = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 40,
    isDead: false,
    owner: { label: 'enemy' },
    type: 'Fantassin',
  }
  const unit = {
    action: constants.ACTION_TYPES.attack,
    dest: enemyUnit,
    getActionCondition: instance => instance === enemyUnit && enemyUnit.hitPoints > 0,
    isUnitAtDest: () => true,
    setTextures: () => {},
    sprite: { loop: false, onComplete: null, onFrameChange: null, onLoop: null },
  }

  new UnitCombat(unit).handleAttackAction()
  impactCallback()

  assert.equal(enemyUnit.hitPoints, 36)
  assert.deepEqual(applyCalls, [{ target: enemyUnit, defaultDamage: undefined }])
})

test('axe melee units use sword attack cues when hitting units', () => {
  let impactCallback = null
  const soundCues = []
  const { UnitCombat } = loadModule('app/classes/unit/UnitCombat.ts', {
    '../../constants': {
      ...constants,
      SOUND_CUES: { unit: { swordAttack: ['sword-attack', 'sword-attack-2'] } },
    },
    '../../lib': {
      applyCombatHit: (_source, target) => {
        target.hitPoints -= 4
        return { damageDealt: 4, killed: false }
      },
      degreeToDirection: () => 'south',
      findInstancesInSight: () => [],
      getClosestInstanceWithPath: () => null,
      getInstanceDegree: () => 0,
      instanceContactInstance: () => true,
      onSpriteLoopAtFrame: (_sprite, _frame, callback) => {
        impactCallback = callback
      },
      playAudibleSoundCue: (_unit, cue) => soundCues.push(cue),
      BOW_SHOOT_RELEASE_FRAME: 8,
      SLASH_IMPACT_FRAME: 5,
    },
    '../Projectile': { Projectile: class {} },
    '../../lib/combatFeedback': { showDamageFeedback: () => {} },
    '../../lib/unitControl': { canAutoAcquireTarget: () => true },
    '../../lib/unitEnergy': { spendOrWaitForEnergy: () => true },
  })
  const enemyUnit = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 40,
    isDead: false,
    owner: { label: 'enemy' },
    type: 'Fantassin',
  }
  const unit = {
    action: constants.ACTION_TYPES.attack,
    dest: enemyUnit,
    equipment: ['axe_ceramic'],
    getActionCondition: instance => instance === enemyUnit && enemyUnit.hitPoints > 0,
    isUnitAtDest: () => true,
    setTextures: () => {},
    sprite: { loop: false, onComplete: null, onFrameChange: null, onLoop: null },
  }

  new UnitCombat(unit).handleAttackAction()
  impactCallback()

  assert.deepEqual(soundCues, [['sword-attack', 'sword-attack-2']])
})

test('melee slash recovery rewinds Pixi frames before completing', () => {
  const calls = []
  const scheduled = new Map()
  const spriteAnimation = loadModule('app/lib/spriteAnimation.ts')
  const { playReverseSlashRecovery } = loadModule('app/lib/slashRecoveryAnimation.ts', {
    '../constants': constants,
    './spriteAnimation': spriteAnimation,
  })
  const sprite = {
    currentFrame: 5,
    gotoAndStop: frame => {
      sprite.currentFrame = frame
      calls.push(['gotoAndStop', frame])
    },
  }
  const unit = {
    action: constants.ACTION_TYPES.attack,
    context: {
      scheduler: {
        add: (callback, time, name) => {
          calls.push(['add', time, name])
          scheduled.set(7, callback)
          return 7
        },
        remove: taskId => calls.push(['remove', taskId]),
      },
    },
    isDead: false,
    isDestroyed: false,
    sprite,
    syncAppearanceLayers: sheet => calls.push(['syncAppearanceLayers', sheet]),
    syncShadow: () => calls.push(['syncShadow']),
  }

  const completed = []
  const handled = playReverseSlashRecovery(unit, { releaseFrame: 5, onComplete: () => completed.push(true) })

  assert.equal(handled, true)
  assert.equal(unit.attackRecoveryAnimationTaskId, 7)
  for (let i = 0; i < 2; i++) scheduled.get(7)()

  assert.deepEqual(
    calls.filter(call => call[0] === 'gotoAndStop').map(([, frame]) => frame),
    [3, 2, 1]
  )
  assert.deepEqual(
    calls.filter(call => call[0] === 'add'),
    [['add', 45, 'combat.slashReverseRecovery']]
  )
  assert.deepEqual(calls.slice(-1), [['remove', 7]])
  assert.equal(unit.attackRecoveryAnimationTaskId, null)
  assert.deepEqual(completed, [true])
})

test('damage feedback can be cleared before its timer fires', () => {
  let scheduled = null
  const texts = []
  class ColorMatrixFilter {
    constructor() {
      this.matrix = []
    }
  }
  const { showDamageFeedback, clearDamageFeedback } = loadModule('app/lib/combatFeedback.ts', {
    'pixi.js': {
      ColorMatrixFilter,
      Text: class {
        constructor(options) {
          this.text = options.text
          this.anchor = { set: () => {} }
          this.destroyed = false
          texts.push(this)
        }
        destroy() {
          this.destroyed = true
        }
      },
    },
    '../constants': constants,
  })
  const originalFilters = ['original-filter']
  const sprite = { anchor: { y: 0 }, destroyed: false, filters: originalFilters, height: 20 }
  const target = {
    addChild: () => {},
    context: {
      scheduler: {
        add: () => 2,
        addOneShot: callback => {
          scheduled = callback
          return 1
        },
        remove: () => {},
      },
    },
    family: constants.FAMILY_TYPES.animal,
    isDestroyed: false,
    sprite,
  }

  showDamageFeedback(target, 4)
  assert.equal(sprite.filters.length, 2)

  clearDamageFeedback(target)

  assert.deepEqual(sprite.filters, originalFilters)
  assert.equal(texts[0].destroyed, true)
  assert.equal(typeof scheduled, 'function')
  scheduled()
  assert.deepEqual(sprite.filters, originalFilters)

  const buildingSprite = { anchor: { y: 0 }, destroyed: false, filters: originalFilters, height: 60 }
  const building = {
    addChild: text => {
      building.child = text
    },
    context: target.context,
    family: constants.FAMILY_TYPES.building,
    isDestroyed: false,
    sprite: buildingSprite,
  }

  showDamageFeedback(building, 7)

  assert.equal(building.child.text, '-7')
  assert.deepEqual(buildingSprite.filters, originalFilters)

  const previousTextCount = texts.length
  showDamageFeedback(building, 0.000005)
  assert.equal(texts.length, previousTextCount)

  showDamageFeedback(building, 2.6)
  assert.equal(building.child.text, '-3')
})
