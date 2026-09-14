const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { runPathStep } = loadTsModule('app/lib/units/pathProgress.ts')
const noop = () => {}
function sprite() {
  return {
    playing: true,
    play() {
      this.playing = true
    },
    stop() {
      this.playing = false
    },
  }
}
function actor() {
  return {
    x: 0,
    y: 0,
    path: [{ i: 1, j: 1 }],
    sprite: sprite(),
    shadow: sprite(),
    appearanceLayerSprites: new Map([[0, sprite()]]),
  }
}

test('a blocked path stops all walking layers and resumes them on actual movement', () => {
  const unit = actor()
  runPathStep(unit, noop, noop, noop)
  for (const layer of [unit.sprite, unit.shadow, ...unit.appearanceLayerSprites.values()]) {
    assert.equal(layer.playing, false)
  }
  runPathStep(
    unit,
    () => {
      unit.x++
    },
    noop,
    noop
  )
  for (const layer of [unit.sprite, unit.shadow, ...unit.appearanceLayerSprites.values()]) {
    assert.equal(layer.playing, true)
  }
})

test('blocked flying animals keep their flight animation', () => {
  const animal = actor()
  runPathStep(animal, noop, noop, noop, true)
  assert.equal(animal.sprite.playing, true)
})

test('persistent blockage retries finitely, prevents recursive repathing and reports once per phase', t => {
  const warnings = []
  t.mock.method(console, 'warn', (...args) => warnings.push(args))
  const unit = actor()
  let retries = 0
  let stops = 0
  let nestedSteps = 0
  for (let i = 0; i < 400; i++) {
    runPathStep(
      unit,
      noop,
      () => {
        retries++
        runPathStep(unit, () => nestedSteps++, noop, noop)
      },
      () => {
        stops++
        unit.path = []
      }
    )
  }
  assert.equal(retries, 3)
  assert.equal(stops, 1)
  assert.equal(nestedSteps, 0)
  assert.equal(warnings.length, 2)
})

test('regular progress and space transfers reset the stall timer', () => {
  const unit = actor()
  const unexpected = () => assert.fail('moving actor must not recover')
  for (let i = 0; i < 500; i++) {
    runPathStep(
      unit,
      () => {
        unit.x += 0.02
      },
      unexpected,
      unexpected
    )
  }
  for (let i = 0; i < 90; i++) runPathStep(unit, noop, unexpected, unexpected)
  unit.spaceId = 'house'
  runPathStep(unit, noop, unexpected, unexpected)
})

test('arrival does not stop a new work animation', () => {
  const unit = actor()
  runPathStep(
    unit,
    () => {
      unit.path = []
      unit.sprite.play()
    },
    noop,
    noop
  )
  assert.equal(unit.sprite.playing, true)
})
