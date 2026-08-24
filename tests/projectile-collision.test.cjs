const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadProjectile(libOverrides = {}) {
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
      applyCombatHit: () => ({ damageDealt: 0, killed: false }),
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
      isHeroControlled: () => false,
      isFriendlyTarget: (source, target) => source.owner?.label === target.owner?.label,
      isometricToCartesian: () => [0, 0],
      moveTowardPoint: () => {},
      playAudibleSoundCue: () => {},
      pointsDistance: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
      projectileTracksTarget: () => false,
      uuidv4: () => 'projectile-1',
      ...libOverrides,
    },
    '../lib/combat': {
      isFriendlyTarget: (source, target) => source.owner?.label === target.owner?.label,
      ...libOverrides,
    },
    '../lib/combatHit': {
      applyCombatHit: () => ({ damageDealt: 0, killed: false }),
      ...libOverrides,
    },
    '../lib/combatFeedback': { showDamageFeedback: () => {} },
    '../lib/diplomaticAggression': {
      applyDiplomaticAggression: () => ({ changed: false, hostileNow: false, relation: 'unchanged' }),
      canTargetBeAggressed: () => false,
      canTriggerDiplomaticAggression: () => false,
      ...libOverrides,
    },
    '../lib/entityFade': { fadeOutThenClear: () => {} },
    '../lib/equipmentStats': { getEntityWeaponPower: () => 0, getUnitCombatRange: unit => unit.range },
    '../lib/grid/movement': { moveTowardPoint: () => {} },
    '../lib/maths': {
      average: (a, b) => (a + b) / 2,
      degreeToDirection: () => 'south',
      degreesToRadians: degrees => degrees,
      getArcHeightForDistance: () => 0,
      getArcProgressOffset: () => 0,
      getInstanceZIndex: () => 0,
      getPointsDegree: () => 0,
      getReliefOffset: () => 0,
      getTerrainSetZIndex: () => 0,
      isometricToCartesian: () => [0, 0],
      pointsDistance: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by),
      randomRange: () => 0,
      uuidv4: () => 'projectile-1',
      ...libOverrides,
    },
    '../lib/projectiles': {
      getEffectiveProjectileType: type => type,
      projectileTracksTarget: () => false,
      ...libOverrides,
    },
    '../lib/debug': { debugLog: () => {} },
    '../lib/settings': { getShadowsEnabled: () => false },
    '../lib/sound': { playAudibleSoundCue: () => {}, ...libOverrides },
    '../lib/spriteTextures': {
      bindAnimatedSpriteToTicker: () => {},
      getAnimationFrames: () => [],
      getMirroredHalfArcFrameIndex: () => ({ frameIndex: 0, mirrored: false }),
      ...libOverrides,
    },
    '../lib/treeCollision': { findTreeSegmentCollision: () => null },
    '../lib/unitControl': { isHeroControlled: () => false, ...libOverrides },
    '../lib/unitExperience': {
      getCombatXpBonus: () => 0,
      grantUnitXp: () => {},
      XP_CATEGORIES: { hunting: 'hunting', ranged: 'ranged' },
      XP_KILL_BONUS: 15,
    },
  }
  const module = { exports: {} }
  const loadLocalTs = modulePath => {
    const localFilename = path.join(__dirname, '../app/classes', modulePath)
    const localSource = fs.readFileSync(localFilename, 'utf8')
    const { code: localCode } = babel.transformSync(localSource, {
      filename: localFilename,
      presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
    })
    const localModule = { exports: {} }
    new Function('module', 'exports', 'require', localCode)(localModule, localModule.exports, localRequire)
    return localModule.exports
  }
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    if (request === './ProjectileGeometry') {
      return loadLocalTs('ProjectileGeometry.ts')
    }
    if (request === './ProjectileVisuals') {
      return loadLocalTs('ProjectileVisuals.ts')
    }
    return require(request)
  }
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

test('player arrows can turn a neutral faction hostile and damage the target', () => {
  let hit = null
  const faction = { relationState: 'neutral' }
  const Projectile = loadProjectile({
    applyCombatHit: (_source, target, options) => {
      hit = { target, options }
      target.hitPoints -= options.defaultDamage
      return { damageDealt: options.defaultDamage, killed: false }
    },
    applyDiplomaticAggression: (source, target) => {
      if (!source.owner?.isPlayed || target.owner?.factionId !== 'neutral-tribe') {
        return { changed: false, hostileNow: false, relation: 'unchanged' }
      }
      faction.relationState = 'hostile'
      return { changed: true, hostileNow: true, relation: 'hostile' }
    },
    canTargetBeAggressed: (source, target) =>
      Boolean(source.owner?.isPlayed && target.owner?.factionId === 'neutral-tribe'),
    canTriggerDiplomaticAggression: (source, target) =>
      Boolean(source.owner?.isPlayed && target.owner?.factionId === 'neutral-tribe'),
    isFriendlyTarget: (source, target) => !source.owner?.isEnemy?.(target.owner),
  })
  const owner = {
    family: 'unit',
    type: 'Hero',
    owner: {
      label: 'player',
      isPlayed: true,
      isEnemy: targetOwner => faction.relationState === 'hostile' && targetOwner?.factionId === 'neutral-tribe',
      config: { projectiles: { Arrow: { assets: 'projectiles/arrow_ceramic', size: 3, speed: 14 } } },
    },
    x: 0,
    y: 0,
    z: 0,
    width: 32,
    height: 48,
    range: 5,
    sprite: { height: 48 },
  }
  const target = {
    family: 'unit',
    owner: { label: 'neutral-ai', factionId: 'neutral-tribe' },
    x: 0,
    y: 0,
    z: 0,
    width: 32,
    height: 32,
    hitPoints: 20,
  }
  const projectile = new Projectile(
    { owner, target, type: 'Arrow', destination: { x: target.x, y: target.y }, weaponPower: 5 },
    { app: {}, players: [{ units: [target], buildings: [], animals: [] }], map: {}, scheduler: { add: () => null }, player: owner.owner }
  )

  assert.deepEqual(projectile.getCollisionCandidates(), [target])
  projectile.onHit(target)

  assert.equal(faction.relationState, 'hostile')
  assert.equal(target.hitPoints, 15)
  assert.equal(hit.target, target)
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
            assets: 'projectiles/arrow_ceramic',
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
    type: 'Fantassin',
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

test('directional spawn offsets move arrows toward the firing side', () => {
  const Projectile = loadProjectile({ degreeToDirection: () => 'east' })
  const owner = {
    family: 'unit',
    type: 'Bowman',
    owner: {
      label: 'player',
      config: {
        projectiles: {
          Arrow: {
            assets: 'projectiles/arrow_ceramic',
            size: 3,
            speed: 14,
            spawnOffsetY: 10,
            directionalSpawnOffsets: { east: { x: 10, y: -10 } },
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
  }
  const projectile = new Projectile(
    {
      owner,
      type: 'Arrow',
      destination: { x: 200, y: 100 },
    },
    {
      app: {},
      players: [],
      map: {},
      scheduler: { add: () => null },
    }
  )

  assert.equal(projectile.x, 110)
  assert.equal(projectile.y, 76)
})

test('left-facing LPC arrows spawn at the release pose height', () => {
  const Projectile = loadProjectile({ degreeToDirection: () => 'west' })
  const owner = {
    family: 'unit',
    type: 'BanditArcher',
    owner: {
      label: 'player',
      config: {
        projectiles: {
          Arrow: {
            assets: 'projectiles/arrow_ceramic',
            size: 3,
            speed: 14,
            spawnOffsetY: 10,
            directionalSpawnOffsets: { west: { x: -10, y: 8 } },
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
    sprite: { height: 64 },
  }
  const projectile = new Projectile(
    {
      owner,
      type: 'Arrow',
      destination: { x: 0, y: 100 },
    },
    {
      app: {},
      players: [],
      map: {},
      scheduler: { add: () => null },
    }
  )

  assert.equal(projectile.x, 90)
  assert.equal(projectile.y, 86)
})

test('age-specific arrows can still embed into the ground', () => {
  const Projectile = loadProjectile()
  const projectile = Object.create(Projectile.prototype)
  projectile.type = 'ArrowBronze'

  assert.equal(projectile.canUseEmbeddedMask(), true)
})

test('onHit reports the spawn-to-target vector as the hit direction', () => {
  let capturedOptions = null
  const Projectile = loadProjectile({
    applyCombatHit: (_source, _target, options) => {
      capturedOptions = options
      return { damageDealt: 5, killed: false }
    },
  })
  const owner = {
    family: 'unit',
    type: 'Bowman',
    owner: { label: 'player', config: { projectiles: { Arrow: { assets: 'projectiles/arrow_ceramic', size: 3, speed: 14 } } } },
    x: 0,
    y: 0,
    z: 0,
    width: 32,
    height: 48,
    range: 5,
    sprite: { height: 48 },
  }
  const target = {
    family: 'animal',
    owner: { label: 'gaia' },
    x: 120,
    y: 40,
    z: 0,
    width: 32,
    height: 32,
    hitPoints: 10,
  }
  const projectile = new Projectile(
    { owner, target, type: 'Arrow', destination: { x: target.x, y: target.y }, weaponPower: 5 },
    { app: {}, players: [], map: {}, scheduler: { add: () => null }, player: owner.owner }
  )

  projectile.onHit(target)

  assert.deepEqual(capturedOptions.hitDirection, {
    x: projectile.destinationPoint.x - projectile.spawnOrigin.x,
    y: projectile.destinationPoint.y - projectile.spawnOrigin.y,
  })
  // The shot flies rightward from spawn to target, so the hit direction should too.
  assert.equal(capturedOptions.hitDirection.x > 0, true)
})
