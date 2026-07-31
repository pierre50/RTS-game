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
    ARROW_GROUND_TIME: 180,
    CELL_HEIGHT: 32,
    CELL_WIDTH: 64,
    FADE_DURATION_MS: 2000,
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
      AnimatedSprite: class {
        constructor(textures = []) {
          this.textures = textures
          this.anchor = { x: 0, y: 0, set: (x, y = x) => ((this.anchor.x = x), (this.anchor.y = y)) }
          this.scale = { x: 1, y: 1, set: (x, y = x) => ((this.scale.x = x), (this.scale.y = y)) }
          this.currentFrame = 0
          this.playing = false
        }
        play() {
          this.playing = true
        }
        gotoAndStop(frame) {
          this.currentFrame = frame
          this.playing = false
        }
        gotoAndPlay(frame) {
          this.currentFrame = frame
          this.playing = true
        }
      },
      Assets: { cache: { get: () => ({ textures: { '0.png': { defaultAnchor: { x: 0.5, y: 0.5 } } } }) } },
      Container: class {
        addChild() {}
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
      getTerrainSetZIndex: () => 0,
      isFriendlyTarget: (source, target) => source.owner?.label === target.owner?.label,
      isometricToCartesian: () => [0, 0],
      moveTowardPoint: () => {},
      playAudibleSoundCue: () => {},
      pointsDistance: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
      projectileTracksTarget: () => false,
      uuidv4: () => 'projectile-1',
    },
    '../lib/combatFeedback': { showDamageFeedback: () => {} },
    '../lib/entityFade': { fadeOutThenClear: () => {} },
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

test('mounted archers spawn arrows from the visual rider height', () => {
  const Projectile = loadProjectile()
  const owner = {
    family: 'unit',
    type: 'Bowman',
    owner: {
      label: 'player',
      config: {
        projectiles: {
          Arrow: {
            assets: 'projectiles/arrow',
            size: 3,
            speed: 14,
            spawnOffsetY: 10,
          },
        },
      },
    },
    x: 100,
    y: 100,
    z: 0,
    width: 32,
    height: 48,
    range: 5,
    sprite: { height: 48 },
    getMountedRiderY: () => -20,
  }
  const target = {
    family: 'unit',
    type: 'Clubman',
    owner: { label: 'enemy' },
    x: 200,
    y: 180,
    z: 0,
    width: 32,
    height: 48,
    hitPoints: 10,
    getMountedRiderY: () => -16,
  }
  const projectile = new Projectile(
    {
      owner,
      target,
      type: 'Arrow',
      destination: { x: target.x, y: target.y },
    },
    {
      app: {},
      players: [],
      map: {},
      scheduler: { add: () => null },
    }
  )

  assert.equal(projectile.y, 66)
  assert.equal(projectile.destinationPoint.y, 164)
})
