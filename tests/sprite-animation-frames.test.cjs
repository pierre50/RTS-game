const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')
const { AnimatedSprite, Texture } = require('pixi.js')

for (const replaceBody of [false, true]) {
  test(`corpse appearance refresh preserves decay until completion (replace body: ${replaceBody})`, () => {
    const { setUnitTexture } = loadModule('app/lib/entities/spriteTextures.ts', {})
    const { CORPSE_TIME } = loadModule('app/constants/core.ts', {})
    const original = new Texture()
    const replacement = new Texture()
    const sprite = new AnimatedSprite({ textures: [original], autoUpdate: false, loop: false })
    let completed = 0
    sprite.animationSpeed = 1 / (CORPSE_TIME * 60)
    sprite.onComplete = () => completed++
    sprite.play()
    const unit = {
      context: {},
      degree: 180,
      currentSheet: 'corpseSheet',
      sheetDirectionCounts: { corpseSheet: 1 },
      corpseSheet: { data: { animationSpeed: 0 }, textures: { '000.png': original } },
      sprite,
    }
    const advance = seconds => {
      for (let frame = 0; frame < seconds * 60; frame++) sprite.update({ deltaTime: 1 })
    }

    advance(CORPSE_TIME / 2)
    if (replaceBody) unit.corpseSheet.textures['000.png'] = replacement
    setUnitTexture('corpseSheet', unit)

    assert.equal(sprite.animationSpeed, 1 / (CORPSE_TIME * 60))
    assert.equal(sprite.playing, true)
    assert.equal(sprite.loop, false)
    assert.equal(completed, 0)
    assert.equal(sprite.texture, replaceBody ? replacement : original)
    // Identical body textures keep the elapsed time; replacing them must still expire.
    advance((replaceBody ? CORPSE_TIME : CORPSE_TIME / 2) + 1 / 60)
    assert.equal(completed, 1)
    assert.equal(sprite.playing, false)
    sprite.destroy()
    original.destroy()
    replacement.destroy()
  })
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

test('paused placement updates facing textures without starting animation', () => {
  const { setUnitTexture, getSpriteFrameSelection } = loadModule('app/lib/entities/spriteTextures.ts', {
    '../constants': { SHEET_TYPES: {
      standing: 'standingSheet', walking: 'walkingSheet', action: 'actionSheet',
      dying: 'dyingSheet', corpse: 'corpseSheet',
    } },
  })
  const textures = Object.fromEntries(Array.from({ length: 6 }, (_, id) => [`${id}.png`, { id }]))
  const sheet = { data: {}, textures }
  const sprite = {
    currentFrame: 0, textures: [], playing: true,
    anchor: { set() {} }, scale: { x: 1, y: 1 },
    stop() { this.playing = false },
    play() { this.playing = true },
  }
  for (const degree of [0, 45, 90, 135, 180, 225, 270, 315]) {
    const expected = getSpriteFrameSelection(textures, degree, 3)
    setUnitTexture('standingSheet', {
      context: { paused: true }, degree, sprite,
      standingSheet: sheet, walkingSheet: sheet,
      sheetDirectionCounts: { standingSheet: 3, walkingSheet: 3 },
    })
    assert.deepEqual(sprite.textures, [expected.textures[0]])
    assert.equal(sprite.scale.x, expected.mirrored ? -1 : 1)
    assert.equal(sprite.playing, false)
  }
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

test('unit animation speed uses the selected action sheet speed directly', () => {
  const { getUnitSpritesheetAnimationSpeed, setUnitTexture } = loadModule('app/lib/entities/spriteTextures.ts', {
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

  assert.equal(getUnitSpritesheetAnimationSpeed({ data: { animationSpeed: 0.4 } }, 'actionSheet'), 0.4)
  assert.equal(getUnitSpritesheetAnimationSpeed({ data: {} }, 'standingSheet'), 0.2)
  assert.equal(getUnitSpritesheetAnimationSpeed({ data: {} }, 'corpseSheet'), 0)
  assert.equal(getUnitSpritesheetAnimationSpeed({ data: {} }, 'actionSheet'), 0.4)

  const sprite = {
    currentFrame: 0,
    textures: [],
    anchor: { set: () => {} },
    scale: { x: 1, y: 1 },
    play() {},
  }

  setUnitTexture('actionSheet', {
    context: {},
    degree: 180,
    sprite,
    actionSheet: {
      data: { animationSpeed: 0.4 },
      textures: { '000.png': { id: 'action-0' }, '001.png': { id: 'action-1' } },
    },
  })

  assert.equal(sprite.animationSpeed, 0.4)
})

test('unit action frame sequence reorders the main sprite textures', () => {
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
    play() {},
  }

  setUnitTexture('actionSheet', {
    actionFrameSequence: [5, 5, 4, 4, 1, 0, 0, 0, 0],
    context: {},
    degree: 180,
    sheetDirectionCounts: { actionSheet: 3 },
    sprite,
    actionSheet: {
      data: { animationSpeed: 0.25 },
      textures: Object.fromEntries(
        Array.from({ length: 18 }, (_, index) => [`${String(index).padStart(3, '0')}.png`, { id: index }])
      ),
    },
  })

  assert.deepEqual(
    sprite.textures.map(texture => texture.id),
    [17, 17, 16, 16, 13, 12, 12, 12, 12]
  )
})

test('npc and hero hosts derive the same custom action frame sequence from work and action', () => {
  const { setUnitTexture } = loadModule('app/lib/entities/spriteTextures.ts', {
    '../constants': {
      ACTION_TYPES: {},
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
  const makeHost = controlMode => ({
    action: 'chopwood',
    context: {},
    controlMode,
    degree: 180,
    sheetDirectionCounts: { actionSheet: 3 },
    sprite: {
      currentFrame: 0,
      textures: [],
      anchor: { set: () => {} },
      scale: { x: 1, y: 1 },
      play() {},
    },
    work: 'woodcutter',
    actionSheet: {
      data: { animationSpeed: 0.25 },
      textures: Object.fromEntries(
        Array.from({ length: 18 }, (_, index) => [`${String(index).padStart(3, '0')}.png`, { id: index }])
      ),
    },
  })
  const npc = makeHost('unit')
  const hero = makeHost('hero')

  setUnitTexture('actionSheet', npc)
  setUnitTexture('actionSheet', hero)

  assert.deepEqual(
    npc.sprite.textures.map(texture => texture.id),
    [17, 17, 16, 16, 15, 13, 12, 12, 12, 12]
  )
  assert.deepEqual(hero.sprite.textures, npc.sprite.textures)
})

test('attack action frame sequence follows runtime equipment on the main sprite', () => {
  const { setUnitTexture } = loadModule('app/lib/entities/spriteTextures.ts', {
    '../constants': {
      ACTION_TYPES: {},
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
  const makeHost = equipment => ({
    action: 'attack',
    context: {},
    degree: 180,
    equipment,
    sheetDirectionCounts: { actionSheet: 3 },
    sprite: {
      currentFrame: 0,
      textures: [],
      anchor: { set: () => {} },
      scale: { x: 1, y: 1 },
      play() {},
    },
    work: 'attacker',
    actionSheet: {
      data: { animationSpeed: 0.25 },
      textures: Object.fromEntries(
        Array.from({ length: 18 }, (_, index) => [`${String(index).padStart(3, '0')}.png`, { id: index }])
      ),
    },
  })
  const bareHand = makeHost([])
  const axeBandit = makeHost(['axe_ceramic', 'armor_leather'])

  setUnitTexture('actionSheet', bareHand)
  setUnitTexture('actionSheet', axeBandit)

  assert.deepEqual(
    bareHand.sprite.textures.map(texture => texture.id),
    [12, 13, 14, 15, 16, 17]
  )
  assert.deepEqual(
    axeBandit.sprite.textures.map(texture => texture.id),
    [17, 17, 16, 16, 15, 13, 12, 12, 12, 12]
  )
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
