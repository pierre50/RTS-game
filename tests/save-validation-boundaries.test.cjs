const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const config = {
  units: { Hero: {} },
  buildings: { House: {} },
  resources: { Tree: {} },
  animals: { Deer: { totalHitPoints: 10, totalQuantity: 20 } },
}
let loadedConfig = config
const { validateSaveData } = loadTsModule('app/serialization/SaveValidator.ts', {
  mocks: {
    'pixi.js': { Assets: { cache: { get: () => loadedConfig } } },
    '../lib/horses/horseTaming': { isHorseTamingStatus: value => ['wild', 'tamed'].includes(value) },
  },
})
function save() {
  return {
    world: { size: 1, seed: 42 },
    camera: { x: 0, y: 0 },
    resources: [],
    animals: [],
    players: [
      {
        type: 'Human',
        isPlayed: true,
        views: [
          [{}, {}],
          [{}, {}],
        ],
        buildings: [],
        units: [],
        corpses: [],
      },
    ],
  }
}
function rejects(mutate, message) {
  const data = save()
  mutate(data)
  assert.throws(() => validateSaveData(data), message)
}

test('save validation rejects malformed cave orders and delivery references', () => {
  for (const state of [
    { caveOrders: [] },
    { caveOrders: { dest: [NaN, 0] } },
    { resourceDelivery: { building: [0, 0, 42] } },
    { resourceDelivery: { returnTask: { dest: 'tree', action: {} } } },
  ])
    rejects(data => {
      data.players[0].units = [{ type: 'Hero', i: 0, j: 0, ...state }]
    }, /caveOrders|resourceDelivery/)
  const data = save()
  data.players[0].units = [
    {
      type: 'Hero',
      i: 0,
      j: 0,
      resourceDelivery: { building: 'store', returnTask: { dest: [1, 1, 'tree'], work: 'woodcutter' } },
    },
  ]
  assert.doesNotThrow(() => validateSaveData(data))
})

test('save validation rejects unsupported sizes, seeds, source sizes and world descriptors', () => {
  for (const value of [null, [], 1, 'save']) assert.throws(() => validateSaveData(value), /expected an object/)
  for (const size of ['1', 0, 513, 1.5, NaN, Infinity])
    rejects(data => {
      data.world.size = size
    }, /map size/)
  for (const seed of ['42', NaN, Infinity])
    rejects(data => {
      data.world.seed = seed
    }, /map seed/)
  for (const sourceSize of ['1', 0, 513, 1.5])
    rejects(data => {
      data.world.sourceSize = sourceSize
    }, /source map size/)
  for (const field of ['mapType', 'environment'])
    for (const value of [1, ''])
      rejects(data => {
        data.world[field] = value
      }, /map (type|environment)/)
  const data = save()
  data.world.sourceSize = 2
  data.world.mapType = 'continent'
  data.world.environment = 'Forest'
  assert.equal(validateSaveData(data), data)
  data.config = data.world
  delete data.world
  assert.equal(validateSaveData(data), data)
  data.map = [
    [{ type: 'Grass' }, { type: 'Grass' }],
    [{ type: 'Grass' }, { type: 'Grass' }],
  ]
  delete data.config.size
  assert.equal(validateSaveData(data), data)
  delete data.map
  assert.throws(() => validateSaveData(data), /map size/)
})

test('legacy map and camera validation reject malformed grids and cell metadata', () => {
  for (const map of [
    [],
    Array(514),
    [null, []],
    [[{}], []],
    [
      [null, {}],
      [{}, {}],
    ],
    [
      [{ type: '' }, {}],
      [{}, {}],
    ],
    [
      [{ type: 'Grass', z: Infinity }, {}],
      [{}, {}],
    ],
    [
      [{ type: 'Grass', fogSprites: 1 }, {}],
      [{}, {}],
    ],
  ])
    rejects(data => {
      data.map = map
    }, /Invalid save file/)
  for (const camera of [null, [], {}, { x: 0, y: Infinity }, { x: '0', y: 0 }])
    rejects(data => {
      data.camera = camera
    }, /camera/)
  rejects(data => {
    data.config = []
  }, /config/)
  loadedConfig = null
  try {
    assert.throws(() => validateSaveData(save()), /config is not loaded/)
  } finally {
    loadedConfig = config
  }
})

test('runtime and weather validation checks every persisted numeric field', () => {
  const runtimeFields = ['dayNightElapsedMs', 'elapsedMs', 'savedAt']
  const weatherFields = [
    'dailyWeatherSeed',
    'forcedUntilMs',
    'elapsedMs',
    'flashCooldownMs',
    'lightningBursts',
    'lightningNextBurstMs',
    'phaseEndsAt',
    'precipIntensity',
    'rainIntensity',
    'sandIntensity',
    'snowIntensity',
    'windIntensity',
    'windTargetX',
    'windX',
  ]
  rejects(data => {
    data.runtime = []
  }, /runtime is invalid/)
  rejects(data => {
    data.runtime = { weather: [] }
  }, /weather is invalid/)
  rejects(data => {
    data.runtime = { weather: { phase: 1 } }
  }, /weather phase/)
  for (const field of runtimeFields)
    rejects(data => {
      data.runtime = { [field]: Infinity }
    }, /finite number/)
  for (const field of weatherFields)
    rejects(data => {
      data.runtime = { weather: { [field]: NaN } }
    }, /finite number/)
  const data = save()
  data.runtime = {
    ...Object.fromEntries(runtimeFields.map(field => [field, 0])),
    weather: { phase: 'rain', ...Object.fromEntries(weatherFields.map(field => [field, 0])) },
  }
  assert.equal(validateSaveData(data), data)
  data.runtime = { weather: null }
  assert.equal(validateSaveData(data), data)
})

test('campaign validation rejects corrupt metadata and missing current worlds', () => {
  const campaign = () => ({
    format: 'campaign-v1',
    version: 1,
    currentWorldId: 'home',
    worlds: { home: { id: 'home', state: save() } },
    worldGraph: {},
    heroParty: { followerLabels: [] },
    clock: { savedAt: 0, dayNightElapsedMs: 0 },
  })
  assert.equal(validateSaveData(campaign()).currentWorldId, 'home')
  for (const mutate of [
    data => {
      data.version = 2
    },
    data => {
      data.worlds = []
    },
    data => {
      data.worldGraph = null
    },
    data => {
      data.clock = []
    },
    data => {
      data.clock.savedAt = Infinity
    },
    data => {
      data.clock.dayNightElapsedMs = '0'
    },
    data => {
      data.heroParty = null
    },
    data => {
      data.heroParty.followerLabels = null
    },
    data => {
      data.worlds.home = undefined
    },
    data => {
      data.worlds.home.id = 'other'
    },
    data => {
      data.worlds.home.state.camera = null
    },
  ]) {
    const data = campaign()
    mutate(data)
    assert.throws(() => validateSaveData(data), /Invalid save file/)
  }
  const data = campaign()
  delete data.clock
  assert.equal(validateSaveData(data), data)
})

test('saved player records, vision, buildings and units are validated before loading', () => {
  for (const players of [null, [], [null], [{ type: 'unknown' }]])
    rejects(data => {
      data.players = players
    }, /Invalid save file/)
  for (const mutate of [
    player => {
      player.isPlayed = 'true'
    },
    player => {
      player.isPlayed = false
    },
    player => {
      player.views = []
    },
    player => {
      player.views[0] = null
    },
    player => {
      player.views[0] = []
    },
    player => {
      player.views[0][0] = null
    },
    player => {
      player.views[0][0].viewed = 1
    },
    player => {
      player.views[0][0].viewBy = {}
    },
    player => {
      player.units = [{ type: 'unknown', i: 0, j: 0 }]
    },
    player => {
      player.units = [{ type: 'Hero', i: -1, j: 0 }]
    },
    player => {
      player.corpses = [{ type: 'unknown', i: 0, j: 0 }]
    },
    player => {
      player.buildings = [{ type: 'unknown', i: 0, j: 0 }]
    },
    player => {
      player.buildings = [{ type: 'House', i: 0, j: 0, stableHorses: 'bad' }]
    },
    player => {
      player.buildings = [{ type: 'House', i: 0, j: 0, stableHorses: [{ tamingStatus: 'bad' }] }]
    },
    player => {
      player.buildings = [{ type: 'House', i: 0, j: 0, trainingStartedDay: Infinity }]
    },
    player => {
      player.buildings = [{ type: 'House', i: 0, j: 0, trainingCompleteDay: Infinity }]
    },
  ])
    rejects(data => mutate(data.players[0]), /Invalid save file/)
  const data = save()
  data.players[0].units = [{ type: 'Hero', i: 0, j: 0 }]
  data.players[0].corpses = [{ type: 'Hero', i: 1, j: 1 }]
  data.players[0].buildings = [{ type: 'House', i: 0, j: 1, stableHorses: [null, { tamingStatus: 'tamed' }] }]
  assert.equal(validateSaveData(data), data)
})

test('AI save state validates phase and observation lists', () => {
  const ai = {
    type: 'AI',
    isPlayed: false,
    views: [
      [{}, {}],
      [{}, {}],
    ],
  }
  const data = save()
  data.players.push(ai)
  for (const state of [
    null,
    {},
    { phase: 'economy', savedAt: 0, enemyUnits: [], enemyBuildings: [], threatenedTargets: [] },
  ]) {
    ai.aiState = state
    assert.equal(validateSaveData(data), data)
  }
  for (const state of [
    [],
    { phase: 1 },
    { phase: 'bad' },
    { savedAt: NaN },
    { enemyUnits: {} },
    { enemyBuildings: 2 },
    { threatenedTargets: '' },
  ]) {
    ai.aiState = state
    assert.throws(() => validateSaveData(data), /AI/)
  }
})

test('animal save state rejects invalid status, action, position, paths and bounded statistics', () => {
  const animal = { type: 'Deer', i: 0, j: 0 }
  const invalid = [
    { type: 'unknown' },
    { i: '0' },
    { j: 2 },
    { quantity: -1 },
    { quantity: 21 },
    { hitPoints: 11 },
    { isDead: 1 },
    { isDestroyed: true },
    { action: 1 },
    { action: 'bad' },
    { currentSheet: 1 },
    { currentSheet: 'bad' },
    { tamingStatus: 'bad' },
    { path: 'bad' },
    { path: Array(5).fill({ i: 0, j: 0 }) },
    { path: [{ i: 0.5, j: 0 }] },
    { dest: [] },
    { dest: [0, 0, 'x', 'y'] },
    { dest: [0, 0, 2] },
    { dest: 'bad' },
    { dest: { i: 0, j: 0, x: NaN } },
    { dest: { i: 0, j: 0, y: Infinity } },
    { dest: { i: 0, j: 0, label: 1 } },
    { previousDest: [2, 0] },
    { realDest: [0, -1] },
  ]
  for (const patch of invalid)
    rejects(data => {
      data.animals = [{ ...animal, ...patch }]
    }, /Invalid save file/)
  const data = save()
  data.animals = [
    {
      ...animal,
      isDead: true,
      isDestroyed: true,
      quantity: 0,
      hitPoints: 0,
      dest: [0, 1, 'target'],
      previousDest: { i: 0, j: 0, x: 1, y: 2, label: 'target' },
      path: [{ i: 1, j: 1 }],
    },
  ]
  assert.equal(validateSaveData(data), data)
  for (const entity of [null, { type: 'Tree', i: 0, j: 0 }, { type: 'Tree', i: 0, j: Infinity }]) {
    data.resources = [entity]
    if (entity?.j === 0) assert.equal(validateSaveData(data), data)
    else assert.throws(() => validateSaveData(data), /Invalid save file/)
  }
  rejects(data => {
    data.naturalResourceRespawnSlots = [{ type: 'Tree', i: 0, j: 0, depletedDay: Infinity }]
  }, /finite number/)
  rejects(data => {
    data.naturalResourceRespawnSlots = [{ type: 'unknown', i: 0, j: 0 }]
  }, /unsupported type/)
})

test('saved pursuers require distinct identities, valid owners and finite nonnegative delays', () => {
  const entry = {
    entity: { type: 'Hero', label: 'enemy', i: 0, j: 0 },
    owner: { label: 'ai', type: 'AI' },
    targetLabel: 'hero',
    arrival: { i: 1, j: 1 },
    remainingMs: 0,
  }
  const data = save()
  data.runtime = { worldPursuers: [entry] }
  assert.equal(validateSaveData(data), data)
  for (const patch of [
    null,
    { entity: null },
    { arrival: null },
    { targetLabel: '' },
    { targetLabel: 1 },
    { remainingMs: '0' },
    { remainingMs: Infinity },
    { remainingMs: -1 },
    { owner: [] },
    { owner: { label: 1, type: 'AI' } },
    { owner: { label: 'ai', type: 'bad' } },
    { entity: { ...entry.entity, label: '' } },
  ]) {
    data.runtime.worldPursuers = [patch === null ? null : { ...entry, ...patch }]
    assert.throws(() => validateSaveData(data), /pursuer/)
  }
  data.runtime.worldPursuers = [entry, structuredClone(entry)]
  assert.throws(() => validateSaveData(data), /identity/)
  data.runtime.worldPursuers = [{ ...entry, owner: null, entity: { ...entry.entity, type: 'Deer' } }]
  assert.equal(validateSaveData(data), data)
})

test('save validation accepts runtime bandit unit types', () => {
  const data = save()
  data.players.push({
    type: 'AI',
    isPlayed: false,
    views: [
      [{}, {}],
      [{}, {}],
    ],
    buildings: [],
    units: [
      { type: 'BanditChief', label: 'bandit-chief', i: 0, j: 0 },
      { type: 'BanditSword', label: 'bandit-sword', i: 0, j: 0 },
      { type: 'BanditArcher', label: 'bandit-archer', i: 0, j: 0 },
    ],
    corpses: [{ type: 'BanditSword', label: 'bandit-corpse', i: 0, j: 0 }],
  })

  assert.equal(validateSaveData(data), data)
})

test('building age validation accepts legacy saves and rejects invalid explicit tiers', () => {
  for (const age of [-1, 0.5, '1', Infinity, NaN]) {
    rejects(data => {
      data.players[0].buildings = [{ type: 'House', i: 0, j: 0, buildingAge: age }]
    }, /building age/)
  }
  for (const age of [undefined, 0, 1, 2]) {
    const data = save()
    data.players[0].buildings = [{ type: 'House', i: 0, j: 0, ...(age == null ? {} : { buildingAge: age }) }]
    assert.doesNotThrow(() => validateSaveData(data))
  }
})

test('save validation accepts a neutral Gaia owner for generated caves', () => {
  const data = save()
  data.players.push({ ...data.players[0], type: 'Gaia', isPlayed: false, diplomacy: 'neutral' })
  assert.doesNotThrow(() => validateSaveData(data))
})
