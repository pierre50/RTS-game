const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadEntityHealthDisplay() {
  const filename = path.join(__dirname, '../app/lib/entityHealthDisplay.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '../constants': { MENU_INFO_IDS: { hitPoints: 'hit-points' } },
    './hitPointsText': {
      formatHitPointsText: (hitPoints, totalHitPoints) =>
        `${Math.round(Number(hitPoints))}/${Math.round(Number(totalHitPoints))}`,
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('syncEntityHealthDisplay draws visible health bars and updates selected info', () => {
  const { syncEntityHealthDisplay } = loadEntityHealthDisplay()
  const calls = []
  const entity = {
    hitPoints: 1.5,
    totalHitPoints: 100,
    selected: true,
    drawHealthBar: () => calls.push(['drawHealthBar']),
  }
  const player = { selectedOther: entity }
  const menu = { updateInfo: (id, value) => calls.push(['updateInfo', id, value]) }

  syncEntityHealthDisplay(entity, { player, menu })

  assert.deepEqual(calls, [['drawHealthBar'], ['updateInfo', 'hit-points', '2/100']])
})

test('syncEntityHealthDisplay can empty depleted health text for harvested resources', () => {
  const { syncEntityHealthDisplay } = loadEntityHealthDisplay()
  const calls = []
  const entity = {
    hitPoints: 0,
    totalHitPoints: 100,
    selected: true,
    drawHealthBar: () => calls.push(['drawHealthBar']),
  }
  const menu = { updateInfo: (id, value) => calls.push(['updateInfo', id, value]) }

  syncEntityHealthDisplay(entity, { forceInfo: true, menu, emptyWhenDepleted: true })

  assert.deepEqual(calls, [['drawHealthBar'], ['updateInfo', 'hit-points', '']])
})
