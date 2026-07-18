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
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const constants = {
  ACTION_TYPES: {
    attack: 'attack',
  },
  BUILDING_TYPES: {},
  FAMILY_TYPES: {
    animal: 'animal',
    building: 'building',
    unit: 'unit',
  },
  RESOURCE_TYPES: {},
  UNIT_TYPES: {
    villager: 'Villager',
  },
  WORK_TYPES: {
    attacker: 'attacker',
  },
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

test('units with no attack stats cannot attack enemies', () => {
  const { getActionCondition } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })

  const fishingBoat = {
    hitPoints: 45,
    isDead: false,
    owner,
    type: 'FishingBoat',
  }

  assert.equal(getActionCondition(fishingBoat, target, 'attack'), false)
})

test('non-attacking boats flee when attacked', () => {
  const { shouldFleeWhenAttacked } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })

  assert.equal(shouldFleeWhenAttacked({ category: 'Boat', type: 'FishingBoat' }), true)
  assert.equal(shouldFleeWhenAttacked({ category: 'Boat', type: 'LightTransport', transportCapacity: 5 }), true)
  assert.equal(shouldFleeWhenAttacked({ category: 'Boat', type: 'HeavyTransport', transportCapacity: 10 }), true)
})

test('attacking boats do not use the unarmed flee behavior', () => {
  const { shouldFleeWhenAttacked } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })

  assert.equal(shouldFleeWhenAttacked({ category: 'Boat', type: 'ScoutShip', pierceAttack: 5 }), false)
})

test('units with attack stats can attack enemies', () => {
  const { getActionCondition } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })

  const scoutShip = {
    hitPoints: 120,
    isDead: false,
    owner,
    pierceAttack: 5,
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
    pierceAttack: 5,
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
    pierceAttack: 5,
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

test('land ranged units can target enemy boats', () => {
  const { getActionCondition } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })

  const archer = {
    hitPoints: 35,
    isDead: false,
    owner,
    pierceAttack: 3,
    type: 'Bowman',
  }
  const enemyBoat = {
    family: constants.FAMILY_TYPES.unit,
    category: 'Boat',
    hitPoints: 120,
    isDead: false,
    owner: { label: 'enemy' },
  }

  assert.equal(getActionCondition(archer, enemyBoat, 'attack'), true)
})

test('attacking boats can target enemy land units', () => {
  const { getActionCondition } = loadModule('app/lib/combat.ts', {
    '../constants': constants,
  })

  const scoutShip = {
    category: 'Boat',
    hitPoints: 120,
    isDead: false,
    owner,
    pierceAttack: 5,
    type: 'ScoutShip',
  }
  const enemyArcher = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 35,
    isDead: false,
    owner: { label: 'enemy' },
    type: 'Bowman',
  }

  assert.equal(getActionCondition(scoutShip, enemyArcher, 'attack'), true)
})

test('ARPG heroes do not use unit auto-detection attacks', () => {
  const calls = []
  const { UnitCombat } = loadModule('app/classes/unit/UnitCombat.ts', {
    '../../constants': constants,
    '../../lib': {
      degreeToDirection: () => 'south',
      findInstancesInSight: () => [],
      getClosestInstanceWithPath: () => null,
      getHitPointsWithDamage: () => 0,
      getInstanceDegree: () => 0,
      instanceContactInstance: () => false,
      onSpriteLoopAtFrame: () => {},
      playAudibleSoundCue: () => {},
      SHOOT_RELEASE_FRAME: 5,
      SLASH_IMPACT_FRAME: 3,
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

test('unit control policy disables automatic reactions for the active ARPG hero', () => {
  const hero = {}
  const {
    canAutoAcquireTarget,
    canAutoReactToAttack,
    canUseRtsEntityPointer,
    canUseRtsSelection,
    getRtsCommandableUnits,
    hasRtsCommandableUnits,
    isHeroControlled,
    setUnitControlMode,
  } = loadModule('app/lib/unitControl.ts', {})

  const unit = {
    context: {
      controls: {
        heroUnit: hero,
        isArpgActive: () => true,
      },
    },
  }
  Object.assign(hero, unit)

  assert.equal(isHeroControlled(hero), true)
  assert.equal(canAutoAcquireTarget(hero), false)
  assert.equal(canAutoReactToAttack(hero), false)
  assert.equal(canUseRtsEntityPointer({ context: { map: { arpgMode: true } }, isArpgActive: () => false }), false)
  assert.equal(canUseRtsSelection({ context: { map: { arpgMode: true } }, isArpgActive: () => false }), false)

  const explicitHero = {}
  setUnitControlMode(explicitHero, 'arpg')
  assert.equal(isHeroControlled(explicitHero), true)
  assert.equal(canAutoAcquireTarget(explicitHero), false)
  assert.equal(hasRtsCommandableUnits([explicitHero]), false)

  const explicitRtsUnit = {
    context: unit.context,
  }
  setUnitControlMode(explicitRtsUnit, 'rts')
  assert.equal(isHeroControlled(explicitRtsUnit), false)
  assert.equal(canAutoReactToAttack(explicitRtsUnit), true)
  assert.deepEqual(getRtsCommandableUnits([explicitHero, explicitRtsUnit]), [explicitRtsUnit])
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
})
