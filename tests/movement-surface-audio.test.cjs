const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadMovementSurfaceAudio({ heroControlled = false, played = [] } = {}) {
  const filename = path.join(__dirname, '../app/lib/audio/movementSurfaceAudio.ts')
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
      RESOURCE_TYPES: {
        berrybush: 'Berrybush',
        fiberPlant: 'FiberPlant',
        medicinalHerb: 'MedicinalHerb',
        toxicHerb: 'ToxicHerb',
        wheat: 'Wheat',
      },
      SOUND_CUES: {
        hero: {
          footstepGrass: [
            'surface/hero-footstep-grass-1',
            'surface/hero-footstep-grass-2',
            'surface/hero-footstep-grass-3',
          ],
          footstepDirt: [
            'surface/hero-footstep-dirt-1',
            'surface/hero-footstep-dirt-2',
            'surface/hero-footstep-dirt-3',
          ],
          footstepStone: [
            'surface/hero-footstep-stone-1',
            'surface/hero-footstep-stone-2',
            'surface/hero-footstep-stone-3',
          ],
        },
        surface: {
          bushRustle: ['surface/bush-rustling-1', 'surface/bush-rustling-2', 'surface/bush-rustling-3'],
        },
      },
    },
    '../units/unitControl': {
      isHeroControlled: () => heroControlled,
    },
    '../units/unitLocomotion': {
      isUnitWalkSpeedFactor: factor => factor < 1,
    },
    './sound': {
      getHeroDistanceSoundVolume: (unit, profile, baseVolume) => {
        const profiles = {
          footstep: { curve: 2, maxCells: 8, maxVolume: 1, minVolume: 0.14 },
          surface: { curve: 2, maxCells: 10, maxVolume: 0.58, minVolume: 0.06 },
        }
        const distanceProfile = profiles[profile] ?? profiles.surface
        const hero = unit.context?.controls?.heroUnit
        if (!hero || hero === unit) return baseVolume * distanceProfile.maxVolume
        const distance = Math.hypot((unit.i ?? 0) - (hero.i ?? 0), (unit.j ?? 0) - (hero.j ?? 0))
        if (distance >= distanceProfile.maxCells) return 0
        const ratio = Math.max(0, Math.min(1, 1 - distance / distanceProfile.maxCells))
        return (
          baseVolume *
          (distanceProfile.minVolume +
            (distanceProfile.maxVolume - distanceProfile.minVolume) * Math.pow(ratio, distanceProfile.curve))
        )
      },
      playSoundCue: (cue, options) => played.push({ cue, options }),
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

function createUnit({
  elapsedMs = 1000,
  hero = null,
  visible = true,
  i = 1,
  j = 1,
  x = 0,
  y = 0,
  resourceType = 'Wheat',
  shiftKeyActive = false,
  cellType = 'Grass',
} = {}) {
  const resource = { family: 'resource', type: resourceType, i: 1, j: 2, x: x + 1, y }
  const grid = [
    [{ has: null }, { has: null }, { has: null }],
    [{ has: null }, { has: null }, { has: resource }],
    [{ has: null }, { has: null }, { has: null }],
  ]
  const unit = {
    context: {
      controls: { heroUnit: hero, shiftKeyActive },
      map: { grid },
      scheduler: { elapsedMs },
    },
    currentCell: { i: 1, j: 1, type: cellType },
    visible,
    i,
    j,
    x,
    y,
  }
  return { unit, resource }
}

test('movement surface audio plays rustle sounds for visible movers contacting wheat, bushes, or wildgrass', () => {
  const played = []
  const { playMovementSurfaceAudio } = loadMovementSurfaceAudio({ played })
  const { unit } = createUnit()

  playMovementSurfaceAudio(unit, 4)

  assert.equal(played.length, 1)
  assert.deepEqual(played[0].cue, ['surface/bush-rustling-1', 'surface/bush-rustling-2', 'surface/bush-rustling-3'])
  assert.ok(Math.abs(played[0].options.volume - 0.58) < 0.001)
})

test('movement surface audio uses the wheat rustle cue when the hero passes through wildgrass', () => {
  const played = []
  const { playMovementSurfaceAudio } = loadMovementSurfaceAudio({ heroControlled: true, played })
  const { unit } = createUnit({ resourceType: 'MedicinalHerb' })

  playMovementSurfaceAudio(unit, 4)

  assert.deepEqual(played[1].cue, ['surface/bush-rustling-1', 'surface/bush-rustling-2', 'surface/bush-rustling-3'])
})

test('movement surface audio selects hero footsteps from terrain type', () => {
  const played = []
  const loaded = loadMovementSurfaceAudio({ heroControlled: true, played })
  const { unit } = createUnit({ resourceType: 'Tree' })

  unit.currentCell.type = 'Desert'
  loaded.playMovementSurfaceAudio(unit, 4)
  assert.deepEqual(played[0].cue, [
    'surface/hero-footstep-stone-1',
    'surface/hero-footstep-stone-2',
    'surface/hero-footstep-stone-3',
  ])

  unit.context.scheduler.elapsedMs += 400
  unit.currentCell.type = 'Dirt'
  loaded.playMovementSurfaceAudio(unit, 4)
  assert.deepEqual(played[1].cue, [
    'surface/hero-footstep-dirt-1',
    'surface/hero-footstep-dirt-2',
    'surface/hero-footstep-dirt-3',
  ])

  unit.context.scheduler.elapsedMs += 400
  unit.currentCell.type = 'Snow'
  loaded.playMovementSurfaceAudio(unit, 4)
  assert.deepEqual(played[2].cue, [
    'surface/hero-footstep-dirt-1',
    'surface/hero-footstep-dirt-2',
    'surface/hero-footstep-dirt-3',
  ])
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
  const hero = { i: 0, j: 0, x: 0, y: 0 }
  const { unit } = createUnit({ hero, i: 6, j: 0, x: 310, y: 0, resourceType: 'Tree' })

  playMovementSurfaceAudio(unit, 4)
  assert.equal(played.length, 1)
  assert.ok(played[0].options.volume < 0.11)

  unit.i = 9
  unit.x = 700
  unit.context.scheduler.elapsedMs += 400
  playMovementSurfaceAudio(unit, 4)
  assert.equal(played.length, 1)
})

test('movement surface audio plays quiet NPC footsteps by distance to the hero', () => {
  const played = []
  const { playMovementSurfaceAudio } = loadMovementSurfaceAudio({ played })
  const hero = { i: 0, j: 0, x: 0, y: 0 }
  const { unit } = createUnit({ hero, i: 3, j: 0, x: 120, y: 0, resourceType: 'Tree', cellType: 'Desert' })

  playMovementSurfaceAudio(unit, 4)
  assert.equal(played.length, 1)
  assert.deepEqual(played[0].cue, [
    'surface/hero-footstep-stone-1',
    'surface/hero-footstep-stone-2',
    'surface/hero-footstep-stone-3',
  ])
  assert.ok(played[0].options.volume > 0)
  assert.ok(played[0].options.volume < 0.11)

  unit.context.scheduler.elapsedMs += 400
  unit.i = 9
  unit.x = 700
  playMovementSurfaceAudio(unit, 4)
  assert.equal(played.length, 1)
})

test('movement surface audio skips NPC footsteps while walking slowly', () => {
  const played = []
  const { playMovementSurfaceAudio } = loadMovementSurfaceAudio({ played })
  const hero = { i: 0, j: 0, x: 0, y: 0 }
  const { unit } = createUnit({ hero, i: 3, j: 0, x: 120, y: 0, resourceType: 'Tree', cellType: 'Desert' })
  unit.requestedMoveSpeedFactor = 0.5

  playMovementSurfaceAudio(unit, 4)

  assert.equal(played.length, 0)
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
  unit.context.map.grid[1][2].has.type = 'Tree'
  heroLoaded.playMovementSurfaceAudio(unit, 4)
  assert.equal(heroPlayed.length, 1)
  assert.deepEqual(heroPlayed[0].cue, [
    'surface/hero-footstep-grass-1',
    'surface/hero-footstep-grass-2',
    'surface/hero-footstep-grass-3',
  ])
})

test('movement surface audio plays light hero footsteps unless shift is held', () => {
  const played = []
  const loaded = loadMovementSurfaceAudio({ heroControlled: true, played })
  const { unit } = createUnit({ resourceType: 'Tree' })

  loaded.playMovementSurfaceAudio(unit, 4)
  assert.equal(played.length, 1)
  assert.deepEqual(played[0].cue, [
    'surface/hero-footstep-grass-1',
    'surface/hero-footstep-grass-2',
    'surface/hero-footstep-grass-3',
  ])
  assert.ok(played[0].options.volume < 0.2)

  unit.context.scheduler.elapsedMs += 100
  loaded.playMovementSurfaceAudio(unit, 4)
  assert.equal(played.length, 1)

  unit.context.scheduler.elapsedMs += 400
  unit.context.controls.shiftKeyActive = true
  loaded.playMovementSurfaceAudio(unit, 4)
  assert.equal(played.length, 1)
})
