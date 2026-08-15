const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadMovementSurfaceAudio({ heroControlled = false, played = [] } = {}) {
  const filename = path.join(__dirname, '../app/lib/movementSurfaceAudio.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '../constants': {
      FAMILY_TYPES: { resource: 'resource' },
      CELL_HEIGHT: 32,
      CELL_WIDTH: 64,
      RESOURCE_TYPES: { berrybush: 'Berrybush', wheat: 'Wheat' },
      SOUND_CUES: {
        surface: {
          bushRustle: ['surface/bush-rustling-1', 'surface/bush-rustling-2', 'surface/bush-rustling-3'],
        },
      },
    },
    './unitControl': {
      isHeroControlled: () => heroControlled,
    },
    './sound': {
      playSoundCue: (cue, options) => played.push({ cue, options }),
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

function createUnit({ elapsedMs = 1000, hero = null, visible = true, x = 0, y = 0, resourceType = 'Wheat' } = {}) {
  const resource = { family: 'resource', type: resourceType, i: 1, j: 2, x: x + 1, y }
  const grid = [
    [{ has: null }, { has: null }, { has: null }],
    [{ has: null }, { has: null }, { has: resource }],
    [{ has: null }, { has: null }, { has: null }],
  ]
  const unit = {
    context: {
      controls: { heroUnit: hero },
      map: { grid },
      scheduler: { elapsedMs },
    },
    currentCell: { i: 1, j: 1, type: 'Grass' },
    visible,
    x,
    y,
  }
  return { unit, resource }
}

test('movement surface audio plays rustle sounds for visible movers contacting wheat or bushes', () => {
  const played = []
  const { playMovementSurfaceAudio } = loadMovementSurfaceAudio({ played })
  const { unit } = createUnit()

  playMovementSurfaceAudio(unit, 4)

  assert.equal(played.length, 1)
  assert.deepEqual(played[0].cue, ['surface/bush-rustling-1', 'surface/bush-rustling-2', 'surface/bush-rustling-3'])
  assert.ok(Math.abs(played[0].options.volume - 0.58) < 0.001)
})

test('movement surface audio respects per-unit cooldown', () => {
  const played = []
  const { playMovementSurfaceAudio } = loadMovementSurfaceAudio({ played })
  const { unit } = createUnit()

  playMovementSurfaceAudio(unit, 4)
  unit.context.scheduler.elapsedMs += 200
  playMovementSurfaceAudio(unit, 4)
  unit.context.scheduler.elapsedMs += 200
  playMovementSurfaceAudio(unit, 4)

  assert.equal(played.length, 2)
})

test('movement surface audio attenuates from the hero and ignores far movers', () => {
  const played = []
  const { playMovementSurfaceAudio } = loadMovementSurfaceAudio({ played })
  const hero = { x: 0, y: 0 }
  const { unit } = createUnit({ hero, x: 310, y: 0 })

  playMovementSurfaceAudio(unit, 4)
  assert.ok(played[0].options.volume < 0.58)

  unit.x = 700
  unit.context.scheduler.elapsedMs += 400
  playMovementSurfaceAudio(unit, 4)
  assert.equal(played.length, 1)
})

test('movement surface audio uses movement direction in the outer contact margin', () => {
  const towardPlayed = []
  const towardLoaded = loadMovementSurfaceAudio({ played: towardPlayed })
  const { unit: towardUnit, resource: towardResource } = createUnit()
  towardUnit.currentCell.type = 'Dirt'
  towardUnit.x = 0
  towardResource.x = 40
  towardLoaded.playMovementSurfaceAudio(towardUnit, 4, { previousX: -4, previousY: 0 })
  assert.equal(towardPlayed.length, 1)

  const awayPlayed = []
  const awayLoaded = loadMovementSurfaceAudio({ played: awayPlayed })
  const { unit: awayUnit, resource: awayResource } = createUnit()
  awayUnit.currentCell.type = 'Dirt'
  awayUnit.x = 0
  awayResource.x = 40
  awayLoaded.playMovementSurfaceAudio(awayUnit, 4, { previousX: 4, previousY: 0 })
  assert.equal(awayPlayed.length, 0)
})

test('movement surface audio requires movement and visibility unless the mover is the hero', () => {
  const played = []
  const loaded = loadMovementSurfaceAudio({ played })
  const { unit } = createUnit({ visible: false })

  loaded.playMovementSurfaceAudio(unit, 0)
  loaded.playMovementSurfaceAudio(unit, 4)
  assert.equal(played.length, 0)

  const heroPlayed = []
  const heroLoaded = loadMovementSurfaceAudio({ heroControlled: true, played: heroPlayed })
  heroLoaded.playMovementSurfaceAudio(unit, 4)
  assert.equal(heroPlayed.length, 1)
})
