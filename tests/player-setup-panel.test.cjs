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
  '../lib/audio/uiSound': { playClickSound: () => {} },
  '../lib/lang': { t: key => key },
  '../config/civilizations': {
    CIVILIZATIONS: [
      { labelKey: 'civGreek', value: 'Hellas' },
      { labelKey: 'civLatium', value: 'Latium' },
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
    { name: 'You', color: 'blue', civ: 'Hellas', team: null, isHuman: true },
    { name: 'Computer 1', color: 'red', civ: 'Hellas', team: null, isHuman: false },
  ])

  panel._cycleColor(0)

  assert.equal(panel.players[0].color, 'red')
  assert.notEqual(panel.players[1].color, 'red')
})

test('AI colors are reassigned to free colors when the human color conflicts', () => {
  const panel = setupPanel([
    { name: 'You', color: 'green', civ: 'Hellas', team: null, isHuman: true },
    { name: 'Computer 1', color: 'green', civ: 'Hellas', team: null, isHuman: false },
    { name: 'Computer 2', color: 'blue', civ: 'Hellas', team: null, isHuman: false },
  ])

  panel._reassignAIColors()

  assert.equal(panel.players[0].color, 'green')
  assert.equal(new Set(panel.players.map(player => player.color)).size, panel.players.length)
})

test('human setup normalizes grey to a playable color', () => {
  const panel = setupPanel([])

  const player = panel._normalizePlayer({
    name: 'You',
    color: 'grey',
    civ: 'Hellas',
    gender: 'male',
    isHuman: true,
    team: null,
  })

  assert.notEqual(player.color, 'grey')
  assert.notEqual(player.color, 'gray')
  assert.equal(player.color, 'violet')
})

test('generated human name changes when civilization changes', () => {
  const panel = setupPanel([
    { name: 'Hellas-male-name', color: 'blue', civ: 'Hellas', gender: 'male', team: null, isHuman: true },
  ])

  panel._setPlayerCiv(0, 'Latium')

  assert.equal(panel.players[0].civ, 'Latium')
  assert.equal(panel.players[0].name, 'Latium-male-name')
  assert.deepEqual(panel.players[0].heroAppearance, { hairStyle: 'buzzcut', hairColor: 'dark_brown' })
})

test('generated human name follows female gender selection', () => {
  const panel = setupPanel([
    { name: 'Hellas-male-name', color: 'blue', civ: 'Hellas', gender: 'male', team: null, isHuman: true },
  ])

  panel._setPlayerGender(0, 'female')

  assert.equal(panel.players[0].gender, 'female')
  assert.equal(panel.players[0].name, 'Hellas-female-name')
  assert.deepEqual(panel.players[0].heroAppearance, { hairStyle: 'braid', hairColor: 'dark_brown' })
})

test('custom human name is preserved when civilization changes', () => {
  const panel = setupPanel([
    { name: 'Pierre', color: 'blue', civ: 'Hellas', gender: 'male', team: null, isHuman: true },
  ])

  panel._setPlayerCiv(0, 'Latium')

  assert.equal(panel.players[0].civ, 'Latium')
  assert.equal(panel.players[0].name, 'Pierre')
})

test('simplified setup keeps only the human player', () => {
  const panel = setupPanel([
    { name: 'You', color: 'blue', civ: 'Hellas', gender: 'male', team: null, isHuman: true },
    { name: 'Computer 1', color: 'red', civ: 'Latium', gender: 'male', team: null, isHuman: false },
  ])

  panel._keepOnlyHumanPlayer()

  assert.equal(panel.players.length, 1)
  assert.equal(panel.players[0].isHuman, true)
  assert.equal(panel.players[0].name, 'You')
})

test('random color resolves only for game start, excludes AI colors and keeps setup unchanged', () => {
  const panel = setupPanel([
    { name: 'You', color: 'violet', isHuman: true },
    ...['violet', 'blue', 'red', 'yellow', 'brown', 'orange', 'green'].map(color => ({ color, isHuman: false })),
  ])
  panel.randomHumanColor = true
  assert.equal(panel.getPlayers()[0].color, 'violet')
  const players = panel.getPlayers(true)
  assert.equal(players[0].color, 'teal')
  assert.equal(new Set(players.map(player => player.color)).size, players.length)
  assert.equal(panel.players[0].color, 'violet')
})

test('choosing a fixed swatch disables random color', () => {
  const panel = setupPanel([{ color: 'violet', isHuman: true }])
  panel.randomHumanColor = true
  panel._cycleColor(0)
  assert.equal(panel.randomHumanColor, false)
  assert.equal(panel.getPlayers(true)[0].color, 'blue')
})
