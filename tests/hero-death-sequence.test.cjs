const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('death completion resolves only after the dying animation reaches its last frame', async () => {
  const { UnitLifecycle } = loadTsModule('app/classes/unit/UnitLifecycle.ts', { mocks: {
    '../../lib': { updateInstanceVisibility() {} },
    '../../lib/entities/deathFlash': { runAfterDeathFlash: (_sprite, callback) => callback },
    '../../lib/entities/entityVisualFeedback': { clearEntityVisualFeedback() {} },
    '../../lib/units/unitVisualTransition': { setUnitVisualSheet: () => 1, isUnitVisualAnimationCurrent: () => true },
  } })
  const unit = { sprite: {}, owner: { corpses: [] }, zIndex: 1 }
  const lifecycle = new UnitLifecycle(unit)
  let decomposed = false
  lifecycle.decompose = () => { decomposed = true }
  lifecycle.death()
  let completed = false
  unit.deathAnimationComplete.then(() => { completed = true })
  await Promise.resolve()
  assert.equal(completed, false)
  assert.equal(decomposed, false)
  unit.sprite.onComplete()
  await unit.deathAnimationComplete
  assert.equal(completed, true)
  assert.equal(decomposed, true)
})

test('critical health blur persists during death and is removed with the old scene', () => {
  const { HeroCriticalHealthEffects } = loadTsModule('app/services/HeroCriticalHealthEffects.ts', { mocks: {
    '@pixi/sound': { sound: { play: () => ({ stop() {}, volume: 0 }) } },
    'pixi-filters': { ZoomBlurFilter: class { constructor(options) { Object.assign(this, options) } } },
  } })
  const otherFilter = {}
  const app = { stage: { filters: [otherFilter] } }
  const effects = new HeroCriticalHealthEffects(app)
  const hero = { hitPoints: 1, totalHitPoints: 100 }
  effects.update(hero, 250)
  const previous = effects.filter.strength
  effects.update({ ...hero, hitPoints: 0, isDead: true }, 250)
  assert.ok(effects.filter.strength >= previous)
  assert.ok(app.stage.filters.includes(effects.filter))
  effects.destroy()
  assert.deepEqual(app.stage.filters, [otherFilter])
})
