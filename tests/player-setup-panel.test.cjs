const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadModule(filename, mocks = {}) {
  return loadTsModule(filename, { mocks })
}

const { PlayerSetupPanel } = loadModule(path.join(__dirname, '../app/ui/PlayerSetupPanel.ts'), {
  '../lib/avatar': {
    getUnitFacePortraitTexture: () => null,
  },
  '../lib/uiSound': { playClickSound: () => {} },
  '../lib/lang': { t: key => key },
  '../config/civilizations': {
    CIVILIZATIONS: [
      { labelKey: 'greek', value: 'Greek' },
      { labelKey: 'roman', value: 'Roman' },
    ],
  },
  '../config/playerNames': {
    randomPlayerNameForCivilization: (civ, gender) => `${civ}-${gender === 'female' ? 'female' : 'male'}-name`,
    isGeneratedPlayerName: name => /^.+-(male|female)-name$/.test(name),
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

test('generated human name changes when civilization changes', () => {
  const panel = setupPanel([
    { name: 'Greek-male-name', color: 'blue', civ: 'Greek', gender: 'male', team: null, isHuman: true },
  ])

  panel._setPlayerCiv(0, 'Roman')

  assert.equal(panel.players[0].civ, 'Roman')
  assert.equal(panel.players[0].name, 'Roman-male-name')
})

test('generated human name follows female gender selection', () => {
  const panel = setupPanel([
    { name: 'Greek-male-name', color: 'blue', civ: 'Greek', gender: 'male', team: null, isHuman: true },
  ])

  panel._setPlayerGender(0, 'female')

  assert.equal(panel.players[0].gender, 'female')
  assert.equal(panel.players[0].name, 'Greek-female-name')
})

test('custom human name is preserved when civilization changes', () => {
  const panel = setupPanel([
    { name: 'Pierre', color: 'blue', civ: 'Greek', gender: 'male', team: null, isHuman: true },
  ])

  panel._setPlayerCiv(0, 'Roman')

  assert.equal(panel.players[0].civ, 'Roman')
  assert.equal(panel.players[0].name, 'Pierre')
})

test('simplified setup keeps only the human player', () => {
  const panel = setupPanel([
    { name: 'You', color: 'blue', civ: 'Greek', gender: 'male', team: null, isHuman: true },
    { name: 'Computer 1', color: 'red', civ: 'Roman', gender: 'male', team: null, isHuman: false },
  ])

  panel._keepOnlyHumanPlayer()

  assert.equal(panel.players.length, 1)
  assert.equal(panel.players[0].isHuman, true)
  assert.equal(panel.players[0].name, 'You')
})
