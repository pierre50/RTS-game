const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function setup(t) {
  const overlay = {
    textContent: '',
    classList: { contains: () => true },
    remove() {
      this.removed = true
    },
  }
  const previousDocument = global.document
  global.document = { getElementById: () => overlay }
  t.after(() => {
    global.document = previousDocument
  })
  const mocks = {
    'pixi.js': {},
    '../../lib': {},
    '../../ai/unitGroups': {
      classifyMilitaryUnits: () => ({ infantry: [], archers: [], cavalry: [] }),
      isAliveUnit: () => true,
    },
    '../../lib/entities/entityHealthDisplay': {},
    '../../classes/unit/movement/UnitMovementDebug': {},
    './DebugMapRenderers': {},
    './shared': {
      stopDebugTicker(context, key) {
        context.map[key] = null
      },
    },
  }
  const moduleCache = new Map()
  const renderers = loadTsModule('app/dev-console/actions/DebugOverlayRenderers.ts', { mocks, moduleCache })
  const { aiInfo } = loadTsModule('app/dev-console/actions/OverlayDebug.ts', { mocks, moduleCache })
  const playerActions = loadTsModule('app/dev-console/actions/player.ts', {
    mocks: { './shared': {}, '../../lib/audio/settings': {} },
  })
  const { createDevCommands } = loadTsModule('app/dev-console/createDevCommands.ts', {
    mocks: {
      'pixi.js': {},
      '../lib/audio/settings': { SPEED_VALUES: ['1'], GAME_SPEED_USAGE: 'speed [1]' },
      './DevCommandActions': { ...playerActions, aiInfo, WEATHER_PHASES: ['sunny'] },
      './actions/debug': {},
      './actions/heroInventory': {},
      './actions/economy': {},
      './actions/DebugOverlayRenderers': renderers,
    },
  })
  const village = {
    type: 'AI',
    label: 'Village',
    name: 'Village',
    units: [],
    buildings: [],
    maxVillagers: 20,
    maxInfantry: 5,
    maxArchers: 4,
    maxCavalry: 3,
    difficultyConfig: { popCapMultiplier: 1 },
    enemyUnitMemory: new Map(),
    enemyBuildingMemory: new Map(),
    strategy: { military: { getGroupCombatPower: () => 0 }, getEconomicDemand: () => ({}) },
    economy: {
      getWorkerSnapshot: () => ({
        villagersOnFood: [],
        villagersOnWood: [],
        villagersOnGold: [],
        villagersOnStone: [],
        inactifVillagers: [],
        villagersHunting: [],
      }),
      getResourceTargets: () => ({}),
    },
    getLivingUnitsByType: () => [],
    getActiveThreats: () => [],
  }
  const human = { type: 'Human', name: 'Hero', units: [], buildings: [] }
  const bandits = { type: 'AI', name: 'Bandits', units: [], buildings: [] }
  const context = { player: human, players: [human, bandits, village], map: {}, app: { ticker: { add() {} } } }
  return { context, registry: createDevCommands(), overlay }
}

test('removed RTS commands cannot be executed or autocompleted', t => {
  const { registry, context } = setup(t)
  for (const name of ['civ', 'popmax', 'age', 'tech', 'free-camera', 'fcam']) {
    assert.equal(registry.execute(name, context).ok, false)
    assert.deepEqual(registry.complete(name, context), [])
  }
})

test('player listing and AI selection share runtime indices and exclude passive bandit owners', t => {
  const { registry, context, overlay } = setup(t)
  assert.match(registry.execute('list players', context).message, /^2\. Village/m)
  assert.deepEqual(registry.complete('spawn Villager 1 ', context), ['0', '1', '2'])
  assert.deepEqual(registry.complete('building House ', context), ['0', '1', '2'])
  assert.deepEqual(registry.complete('ai-info ', context), ['on', 'off', '2'])
  assert.equal(registry.execute('ai-info 1', context).ok, false)
  assert.equal(registry.execute('ai-info 2', { ...context }).ok, true)
  assert.match(overlay.textContent, /AI \[2\] Village/)
  assert.doesNotMatch(overlay.textContent, /Bandits/)
  assert.equal(context.map.debugAiInfoTargetIndex, 2)
  assert.equal(registry.execute('ai-info 2junk', context).ok, false)
  assert.equal(registry.execute('ai-info 2.5', context).ok, false)
})

test('AI overlay can be closed after the last village AI leaves the map', t => {
  const { registry, context, overlay } = setup(t)
  registry.execute('ai-info on', { ...context })
  context.players.pop()
  assert.equal(registry.execute('ai-info off', { ...context }).ok, true)
  assert.equal(context.map.debugAiInfoVisible, false)
  assert.equal(context.map.debugAiInfoTargetIndex, null)
  assert.equal(context.map._debugAiInfoTicker, null)
  assert.equal(overlay.removed, true)
})
