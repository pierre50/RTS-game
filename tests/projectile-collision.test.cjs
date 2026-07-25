const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadProjectile() {
  const filename = path.join(__dirname, '../app/classes/Projectile.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })

  const constants = {
    CELL_HEIGHT: 32,
    CELL_WIDTH: 64,
    FAMILY_TYPES: {
      animal: 'animal',
      building: 'building',
      projectile: 'projectile',
      unit: 'unit',
    },
    LABEL_TYPES: { shadow: 'shadow', sprite: 'sprite' },
    MENU_INFO_IDS: { hitPoints: 'hitPoints' },
    STEP_TIME: 16,
    UNIT_TYPES: { villager: 'Villager' },
  }
  const mocks = {
    'pixi.js': {
      AnimatedSprite: class {},
      Assets: { cache: { get: () => null } },
      Container: class {
        destroy() {}
      },
    },
    '../constants': constants,
    '../lib': {
      average: (a, b) => (a + b) / 2,
      bindAnimatedSpriteToTicker: () => {},
      degreeToDirection: () => 'south',
      degreesToRadians: degrees => degrees,
      getAnimationFrames: () => [],
      getArcHeightForDistance: () => 0,
      getArcProgressOffset: () => 0,
      getEffectiveProjectileType: type => type,
      getHitPointsWithDamage: (_source, target, damage = 1) => target.hitPoints - damage,
      getInstanceZIndex: () => 0,
      getMirroredHalfArcFrameIndex: () => ({ frameIndex: 0, mirrored: false }),
      getPointsDegree: () => 0,
      getReliefOffset: () => 0,
      isFriendlyTarget: (source, target) => source.owner?.label === target.owner?.label,
      moveTowardPoint: () => {},
      playAudibleSoundCue: () => {},
      pointsDistance: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
      projectileTracksTarget: () => false,
      uuidv4: () => 'projectile-1',
    },
    '../lib/combatFeedback': { showDamageFeedback: () => {} },
    '../lib/settings': { getShadowsEnabled: () => false },
    '../lib/unitExperience': {
      getCombatXpBonus: () => 0,
      grantUnitXp: () => {},
      XP_CATEGORIES: { hunting: 'hunting', ranged: 'ranged' },
      XP_KILL_BONUS: 15,
    },
  }
  const module = { exports: {} }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.Projectile
}

test('projectile collision candidates include enemy buildings', () => {
  const Projectile = loadProjectile()
  const projectile = Object.create(Projectile.prototype)
  const enemyBuilding = {
    family: 'building',
    hitPoints: 40,
    isDead: false,
    isDestroyed: false,
    owner: { label: 'enemy' },
  }
  const enemyUnit = { family: 'unit', hitPoints: 10, isDead: false, isDestroyed: false, owner: { label: 'enemy' } }
  const gaiaAnimal = { family: 'animal', hitPoints: 5, isDead: false, isDestroyed: false, owner: { label: 'gaia' } }
  const friendlyBuilding = {
    family: 'building',
    hitPoints: 40,
    isDead: false,
    isDestroyed: false,
    owner: { label: 'player' },
  }

  Object.assign(projectile, {
    context: {
      map: { gaia: { animals: [gaiaAnimal] } },
      players: [{ buildings: [enemyBuilding, friendlyBuilding], units: [enemyUnit], animals: [] }],
    },
    owner: { owner: { label: 'player' } },
  })

  const candidates = projectile.getCollisionCandidates()

  assert.deepEqual(candidates, [enemyBuilding, enemyUnit, gaiaAnimal])
})
