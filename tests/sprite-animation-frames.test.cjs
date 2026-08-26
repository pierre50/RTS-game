const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

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
    return requireFromTsFile(request, filename, mocks)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('direction count 1 keeps every wreck frame instead of slicing it as a 5-direction sheet', () => {
  const { getAnimationFrames } = loadModule('app/lib/entities/spriteTextures.ts', {
    '../constants': { SHEET_TYPES: {}, WORK_TYPES: {} },
    './maths': {},
  })

  const textures = {
    '000.png': { id: 0 },
    '001.png': { id: 1 },
    '002.png': { id: 2 },
    '003.png': { id: 3 },
    '004.png': { id: 4 },
  }

  const frames = getAnimationFrames(textures, 'south', 1)
  assert.equal(frames.length, 5)
  assert.deepEqual(
    frames.map(frame => frame.id),
    [0, 1, 2, 3, 4]
  )
})

test('missing standing sheet idles on the first walking frame from the current direction', () => {
  const { setUnitTexture } = loadModule('app/lib/entities/spriteTextures.ts', {
    '../constants': {
      SHEET_TYPES: {
        action: 'actionSheet',
        corpse: 'corpseSheet',
        dying: 'dyingSheet',
        standing: 'standingSheet',
        walking: 'walkingSheet',
      },
      WORK_TYPES: {},
    },
    './maths': {
      degreeToDirection: degree => (degree === 0 ? 'north' : 'south'),
    },
  })

  const textures = {
    '000.png': { id: 0 },
    '001.png': { id: 1 },
    '002.png': { id: 2 },
    '003.png': { id: 3 },
    '004.png': { id: 4 },
    '005.png': { id: 5 },
  }
  const sprite = {
    currentFrame: 0,
    textures: [],
    anchor: { set: () => {} },
    scale: { x: 1, y: 1 },
    stop: () => {},
  }

  setUnitTexture('standingSheet', {
    context: {},
    degree: 180,
    sheetDirectionCounts: { walkingSheet: 3 },
    sprite,
    walkingSheet: { data: {}, textures },
  })

  assert.deepEqual(sprite.textures, [{ id: 4 }])

  setUnitTexture('standingSheet', {
    context: {},
    degree: 0,
    sheetDirectionCounts: { walkingSheet: 3 },
    sprite,
    walkingSheet: { data: {}, textures },
  })

  assert.deepEqual(sprite.textures, [{ id: 0 }])
})

test('missing animal corpse sheet freezes on the last dying frame', () => {
  const { setUnitTexture } = loadModule('app/lib/entities/spriteTextures.ts', {
    '../constants': {
      SHEET_TYPES: {
        action: 'actionSheet',
        corpse: 'corpseSheet',
        dying: 'dyingSheet',
        standing: 'standingSheet',
        walking: 'walkingSheet',
      },
      WORK_TYPES: {},
    },
    './maths': {
      degreeToDirection: () => 'south',
    },
  })

  const sprite = {
    currentFrame: 2,
    textures: [],
    anchor: { set: () => {} },
    scale: { x: 1, y: 1 },
    stopCalls: 0,
    stop() {
      this.stopCalls += 1
    },
  }

  setUnitTexture('corpseSheet', {
    context: {},
    degree: 180,
    sheetDirectionCounts: { dyingSheet: 1 },
    sprite,
    dyingSheet: {
      data: { animationSpeed: 0.2 },
      textures: {
        '000.png': { id: 'fall-0' },
        '001.png': { id: 'fall-1' },
        '002.png': { id: 'corpse' },
      },
    },
    walkingSheet: {
      data: {},
      textures: { '000.png': { id: 'walk' } },
    },
  })

  assert.equal(sprite.currentFrame, 0)
  assert.equal(sprite.animationSpeed, 0)
  assert.equal(sprite.stopCalls, 1)
  assert.deepEqual(sprite.textures, [{ id: 'corpse' }])
})

test('single-direction dying sheets always use south-facing frames', () => {
  const { setUnitTexture } = loadModule('app/lib/entities/spriteTextures.ts', {
    '../constants': {
      SHEET_TYPES: {
        action: 'actionSheet',
        corpse: 'corpseSheet',
        dying: 'dyingSheet',
        standing: 'standingSheet',
        walking: 'walkingSheet',
      },
      WORK_TYPES: {},
    },
    './maths': {
      degreeToDirection: () => 'north',
    },
  })

  const sprite = {
    currentFrame: 0,
    textures: [],
    anchor: { set: () => {} },
    scale: { x: 1, y: 1 },
    playCalls: 0,
    play() {
      this.playCalls += 1
    },
  }

  setUnitTexture('dyingSheet', {
    context: {},
    degree: 90,
    sheetDirectionCounts: { dyingSheet: 1 },
    sprite,
    dyingSheet: {
      data: { animationSpeed: 0.2 },
      textures: {
        '000.png': { id: 'south-fall-0' },
        '001.png': { id: 'south-fall-1' },
        '002.png': { id: 'south-fall-2' },
      },
    },
  })

  assert.deepEqual(sprite.textures, [{ id: 'south-fall-0' }, { id: 'south-fall-1' }, { id: 'south-fall-2' }])
  assert.equal(sprite.scale.x, 1)
  assert.equal(sprite.playCalls, 1)
})

test('mounted units use action art for idle, walking and animated attack actions', () => {
  const { setUnitTexture } = loadModule('app/lib/entities/spriteTextures.ts', {
    '../constants': {
      SHEET_TYPES: {
        action: 'actionSheet',
        corpse: 'corpseSheet',
        dying: 'dyingSheet',
        standing: 'standingSheet',
        walking: 'walkingSheet',
      },
      WORK_TYPES: {},
    },
    './maths': {
      degreeToDirection: () => 'south',
    },
  })

  const sprite = {
    currentFrame: 0,
    textures: [],
    anchor: { set: () => {} },
    scale: { x: 1, y: 1 },
    playCalls: 0,
    stopCalls: 0,
    gotoAndPlay(frame) {
      this.playCalls += 1
      this.currentFrame = frame
    },
    play() {
      this.playCalls += 1
    },
    stop() {
      this.stopCalls += 1
    },
  }
  const actionSheet = {
    data: { animationSpeed: 0.2 },
    textures: { '000.png': { id: 'hit-0' }, '001.png': { id: 'hit-1' } },
  }

  setUnitTexture('standingSheet', {
    context: {},
    degree: 180,
    mountedOnHorse: true,
    sprite,
    actionSheet,
    standingSheet: { data: {}, textures: { '000.png': { id: 'stand' } } },
  })

  assert.deepEqual(sprite.textures, [{ id: 'hit-0' }])
  assert.equal(sprite.stopCalls, 1)

  setUnitTexture('actionSheet', {
    context: {},
    degree: 180,
    mountedOnHorse: true,
    sprite,
    actionSheet,
  })

  assert.deepEqual(sprite.textures, [{ id: 'hit-0' }, { id: 'hit-1' }])
  assert.equal(sprite.playCalls, 1)
})
