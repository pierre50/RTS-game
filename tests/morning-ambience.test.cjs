const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadMorningAmbience() {
  return loadTsModule('app/lib/audio/morningAmbience.ts')
}

test('morning ambience fades in at dawn and fades out after villagers start work', () => {
  const { getMorningAmbienceTargetVolume } = loadMorningAmbience()
  const maxVolume = 0.24

  assert.equal(getMorningAmbienceTargetVolume(5, 29), 0)
  assert.equal(getMorningAmbienceTargetVolume(null), 0)
  assert.equal(getMorningAmbienceTargetVolume(6, 0), maxVolume)
  assert.equal(getMorningAmbienceTargetVolume(7, 0), maxVolume)
  assert.ok(getMorningAmbienceTargetVolume(8, 0) > 0)
  assert.equal(getMorningAmbienceTargetVolume(8, 15), 0)
})

test('morning ambience ducks night ambience during dawn instead of stacking both loops', () => {
  const { duckNightAmbienceForMorning, getMorningAmbienceTargetVolume } = loadMorningAmbience()
  const nightVolume = 0.28

  assert.equal(duckNightAmbienceForMorning(0, nightVolume), nightVolume)
  assert.equal(duckNightAmbienceForMorning(getMorningAmbienceTargetVolume(6, 0), nightVolume), 0)
  assert.ok(duckNightAmbienceForMorning(getMorningAmbienceTargetVolume(5, 45), nightVolume) < nightVolume)
})
