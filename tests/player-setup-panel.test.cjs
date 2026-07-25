const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')
const babel = require('@babel/core')

function loadModule(filename, mocks = {}) {
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => mocks[request] || require(request)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const { PlayerSetupPanel } = loadModule(path.join(__dirname, '../app/ui/PlayerSetupPanel.ts'), {
  '../lib/uiSound': { playClickSound: () => {} },
  '../lib/lang': { t: key => key },
  '../config/civilizations': {
    CIVILIZATIONS: [{ labelKey: 'greek', value: 'Greek' }],
  },
})

function setupPanel(players) {
  return Object.assign(Object.create(PlayerSetupPanel.prototype), {
    players,
    onChange: null,
    showAge: false,
    simplified: true,
    maxPlayers: 5,
    _refresh() {},
    _emitChange() {},
  })
}

test('human can choose a color already used by an AI and the AI moves away', () => {
  const panel = setupPanel([
    { name: 'You', color: 'blue', civ: 'Greek', team: null, isHuman: true },
    { name: 'Computer 1', color: 'red', civ: 'Greek', team: null, isHuman: false },
  ])

  panel._cycleColor(0)

  assert.equal(panel.players[0].color, 'red')
  assert.notEqual(panel.players[1].color, 'red')
})

test('AI colors are reassigned to free colors when the human color conflicts', () => {
  const panel = setupPanel([
    { name: 'You', color: 'green', civ: 'Greek', team: null, isHuman: true },
    { name: 'Computer 1', color: 'green', civ: 'Greek', team: null, isHuman: false },
    { name: 'Computer 2', color: 'blue', civ: 'Greek', team: null, isHuman: false },
  ])

  panel._reassignAIColors()

  assert.equal(panel.players[0].color, 'green')
  assert.equal(new Set(panel.players.map(player => player.color)).size, panel.players.length)
})
