const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const calls = []
  const { PixiUnitView } = loadTsModule('app/rendering/pixi/PixiUnitView.ts', {
    mocks: {
      'pixi.js': { AnimatedSprite: class {}, Container: class {} },
      '../../constants': { LABEL_TYPES: {}, SHEET_TYPES: {} },
      '../../lib': {},
      '../../lib/audio/settings': {},
      '../../lib/mapSpaces': {},
      '../../lib/terrain/reliefSurface': {},
      '../../lib/units/visuals/unitWorkAppearance': {},
      '../../classes/unit/appearance/UnitVisualState': {
        pauseUnitVisuals: () => calls.push('pauseExtras'),
        resumeUnitVisuals: () => false,
      },
      '../../classes/Instance': { Instance: class {} },
    },
  })
  const sprite = {
    playing: true,
    play() {
      this.playing = true
      calls.push('play')
    },
    stop() {
      this.playing = false
      calls.push('stop')
    },
  }
  const shadow = { play: () => calls.push('shadowPlay'), stop: () => calls.push('shadowStop') }
  const unit = {
    sprite,
    shadow,
    horseSprite: null,
    horseShadow: null,
    currentSheet: 'walking',
    syncAppearanceLayers: sheet => calls.push(['layers', sheet]),
    drawHealthBar: () => calls.push('drawHealth'),
    drawEnergyBar: () => calls.push('drawEnergy'),
    removeHealthBar: () => calls.push('removeHealth'),
    removeEnergyBar: () => calls.push('removeEnergy'),
    shouldKeepHealthBarVisible: () => false,
  }
  return { view: new PixiUnitView(unit, () => {}), unit, calls }
}

test('pause and resume preserve the animation state and its companion visuals', () => {
  const { view, unit, calls } = fixture()
  view.pause()
  assert.equal(unit.sprite.playing, false)
  view.resume()
  assert.equal(unit.sprite.playing, true)
  assert.deepEqual(calls, ['stop', 'pauseExtras', 'play', 'shadowPlay', ['layers', 'walking']])

  calls.length = 0
  unit.sprite.stop()
  calls.length = 0
  view.pause()
  view.resume()
  assert.equal(unit.sprite.playing, false)
  assert.deepEqual(calls, ['stop', 'pauseExtras', 'stop', 'shadowStop', ['layers', 'walking']])
})

test('selection controls Pixi health bars through the view', () => {
  const { view, unit, calls } = fixture()
  view.setSelected(true)
  view.setSelected(false)
  assert.deepEqual(calls, ['drawHealth', 'drawEnergy', 'removeHealth', 'removeEnergy'])
  calls.length = 0
  unit.shouldKeepHealthBarVisible = () => true
  view.setSelected(false)
  assert.deepEqual(calls, ['drawHealth', 'drawEnergy'])
})

test('work impact fires once per animation loop and loop mode reaches companion layers', () => {
  const { view, unit } = fixture()
  unit.sprite.textures = Array.from({ length: 6 })
  unit.appearanceLayerSprites = new Map([[0, { loop: true }]])
  let impacts = 0
  view.onFrameEachLoop(3, () => { impacts++ })
  for (const frame of [0, 3, 4, 0, 4]) unit.sprite.onFrameChange(frame)
  assert.equal(impacts, 2)

  view.setLoop(false)
  assert.equal(unit.sprite.loop, false)
  assert.equal(unit.shadow.loop, false)
  assert.equal(unit.appearanceLayerSprites.get(0).loop, false)
  view.clearFrameCallback()
  assert.equal(unit.sprite.onFrameChange, undefined)
})
