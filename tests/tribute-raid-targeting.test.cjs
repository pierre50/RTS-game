const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('tutorial suppresses daily raids and cancels an already deferred faction raid', () => {
  const { TributeRaidSystem } = loadTributeRaidSystem()
  let deferred
  const runtime = {
    context: {
      isTutorialActive: () => true,
      scheduler: {
        addOneShot: callback => {
          deferred = callback
          return 1
        },
      },
    },
    deferredFactionRaidTaskId: null,
    triggerRaid: () => assert.fail('Unexpected bandit raid'),
    triggerScheduledFactionRaid: () => assert.fail('Unexpected faction raid'),
    triggerFactionRaid: () => assert.fail('Unexpected deferred faction raid'),
  }
  for (let day = 1; day <= 30; day++) {
    TributeRaidSystem.prototype.handleDailyWorldEvent.call(runtime, { day })
    TributeRaidSystem.prototype.triggerScheduledFactionRaid.call(runtime, day)
  }
  TributeRaidSystem.prototype.scheduleFactionRaidAtWindow.call(runtime, 10, 1000)
  deferred()
  assert.equal(runtime.deferredFactionRaidTaskId, null)
})

const constants = {
  ACTION_TYPES: { attack: 'attack' },
  FADE_DURATION_MS: 200,
  PLAYER_TYPES: { ai: 'AI', bandits: 'Bandits', human: 'Human' },
  UNIT_TYPES: {
    banditArcher: 'BanditArcher',
    banditChief: 'BanditChief',
    banditSword: 'BanditSword',
    bowman: 'Bowman',
    chief: 'Chief',
    hero: 'Hero',
    infantry: 'Fantassin',
    villager: 'Villager',
  },
  WORK_TYPES: { attacker: 'attacker' },
}

function loadTributeRaidTargeting() {
  return loadTsModule('app/services/TributeRaidTargeting.ts', {
    mocks: {
      '../constants': constants,
      '../lib/chief': {
        hasLivingChief: player =>
          Boolean(
            player?.units?.some(unit => unit.type === constants.UNIT_TYPES.chief && !unit.isDead && !unit.isDestroyed)
          ),
        isLivingChief: unit => Boolean(unit?.type === constants.UNIT_TYPES.chief && !unit.isDead && !unit.isDestroyed),
      },
    },
  })
}

function loadTributeRaidRules() {
  return loadTsModule('app/services/tribute/TributeRaidRules.ts', {
    mocks: {
      '../constants': constants,
    },
  })
}

function loadTributeRaidSpawning() {
  return loadTsModule('app/services/tribute/TributeRaidSpawning.ts', {
    mocks: {
      '../../constants': { FADE_DURATION_MS: 200, CELL_DEPTH: 16, CELL_WIDTH: 32, CELL_HEIGHT: 16 },
      '../../lib': loadTsModule('app/lib/grid/cells.ts'),
      '../../lib/buildings/passageCells': {
        createNonReservedPassageCellCondition: () => () => true,
      },
      '../../lib/entities/entityFade': {
        fadeOut: (_unit, _duration, callback) => callback?.(),
      },
      '../../lib/entities/overheadIndicator': {
        setUnitOverheadIndicator: () => {},
      },
      '../../lib/grid/cells': {
        getBuildingContactDistance: size => Math.floor((size - 1) / 2) + 1,
      },
      '../Pathfinding': loadTsModule('app/services/Pathfinding.ts'),
      './tribute/TributeRaidRules': loadTributeRaidRules(),
    },
  })
}

function loadTributeRaidText() {
  return loadTsModule('app/services/TributeRaidText.ts', {
    mocks: {
      '../lib/lang': {
        t: (key, vars) => {
          const translations = {
            Bandits: 'Bandits',
            Nord: 'Nord',
            computer: 'Ordinateur',
            factionCivilizationDisplayName: 'la tribu {civ}',
            unknownFaction: 'faction inconnue',
            factionRaidIncoming: '{name} a envoyé un émissaire vers vos terres.',
            factionTributeTitle: 'Émissaire de {name}',
          }
          let text = translations[key] ?? key
          for (const [name, value] of Object.entries(vars ?? {})) {
            text = text.replace(`{${name}}`, String(value))
          }
          return text
        },
      },
    },
  })
}

function loadTributeRaidSystem(overrides = {}) {
  return loadTsModule('app/services/TributeRaidSystem.ts', {
    mocks: {
      '../lib/units/playerTargetKnowledge': { playerSeesTarget: () => true },
      './tribute/FactionRaidEconomy': {
        selectFactionRaidArmy: () => ({ units: [{ type: 'Fantassin' }, { type: 'Bowman' }] }),
        commitFactionRaidArmy: () => true,
        returnFactionRaidUnit: () => true,
      },
      './FactionRaidEconomy': { selectFactionRaidArmy: () => ({ units: [{}, {}] }) },
      '../classes/players/Player': {
        Player: class Player {
          constructor(options) {
            Object.assign(this, options)
            this.label = 'raid-owner'
            this.colorHex = `hex:${options.color}`
            this.units = []
            this.buildings = []
            this.corpses = []
          }
        },
      },
      '../config/gameplay': {
        DAY_NIGHT_CONFIG: { dayLengthMs: 24 * 60 * 1000, hoursPerDay: 24 },
      },
      '../constants': constants,
      '../lib': {
        canAfford: () => true,
        getHexColor: color => `hex:${color}`,
        payCost: () => {},
      },
      '../lib/combat/factions': {
        FACTION_SCORE: { allied: 75, friendly: 35, neutral: 0, hostile: -65 },
      },
      '../lib/campaign/playerRoster': {
        BANDIT_FACTION_ID: 'bandits',
      },
      '../lib/entities/overheadIndicator': {
        setUnitOverheadIndicator: () => {},
      },
      '../lib/lpc': {
        preloadBakedLpcUnitsForPlayers: async () => {},
      },
      '../ui/InspectionPanel': {
        createInspectionModal: () => ({ close: () => {} }),
      },
      '../ui/EntityInfoContent': {
        createTitledEntityInfoContent: () => ({ appendChild: () => {} }),
      },
      './tribute/TributeRaidRules': loadTributeRaidRules(),
      './TributeRaidText': loadTributeRaidText(),
      './TributeRaidTargeting': {
        findRaidTarget: () => null,
        hasActiveBanditCampPresence: () => false,
      },
      './tribute/TributeRaidSpawning': {
        findTributeRaidSpawnCells: () => [],
        removeTributeRaidUnitFromRuntime: () => {},
      },
      ...overrides,
    },
  })
}

test('tribute demands are rounded to clean resource amounts', () => {
  const { roundTributeCost } = loadTributeRaidRules()

  assert.deepEqual(roundTributeCost({ wood: 54 }), { wood: 50 })
  assert.deepEqual(roundTributeCost({ wood: 61 }), { wood: 60 })
  assert.deepEqual(roundTributeCost({ food: 61, gold: 196 }), { food: 60, gold: 200 })
})

test('faction spawning preserves recruited types and only commits a complete group', async () => {
  let committed = 0
  const removed = []
  const target = { i: 10, j: 10, owner: {} }
  const { TributeRaidSystem } = loadTributeRaidSystem({
    './tribute/FactionRaidEconomy': {
      commitFactionRaidArmy: () => {
        committed++
        return true
      },
      expeditionState: (_army, original, raidId, factionId, tribute) => ({ original, raidId, factionId, tribute }),
    },
    './TributeRaidTargeting': { findRaidTarget: () => target },
  })
  const context = {
    players: [],
    player: {},
    map: { random: () => 0 },
    scheduler: { add: () => 1 },
    menu: { showMessage: () => {}, isMiniMapActive: () => false },
  }
  const system = new TributeRaidSystem(context)
  system.findSpawnCells = () => [
    { i: 0, j: 0 },
    { i: 0, j: 1 },
  ]
  system.preloadRaidOwnerAssets = async () => {}
  system.removeUnitFromRuntime = unit => removed.push(unit)
  let fail = true
  const created = []
  const owner = {
    createUnit: options => {
      if (fail && options.type === 'Bowman') return undefined
      const unit = { ...options, owner }
      created.push(unit)
      return unit
    },
  }
  const army = {
    regionId: 'home',
    playerLabel: 'ai',
    units: [
      { type: 'Fantassin', label: 'a', hitPoints: 8 },
      { type: 'Bowman', label: 'b', hitPoints: 11 },
    ],
  }
  const options = { kind: 'faction', army, faction: { id: 'civ-hellas' }, owner, size: 2, tribute: { gold: 10 } }
  assert.equal(await system.createRaid(options), false)
  assert.equal(committed, 0)
  assert.equal(removed.length, 1)
  fail = false
  assert.equal(await system.createRaid(options), true)
  assert.equal(committed, 1)
  assert.deepEqual(
    system.raids[0].units.map(unit => unit.type),
    ['Fantassin', 'Bowman']
  )
  assert.equal(system.raids[0].chief.type, 'Fantassin')
  assert.equal(system.raids[0].units[0].hitPoints, 8)
})

test('restoring a saved expedition restores its phase and blocks another raid', () => {
  const target = { i: 10, j: 10, owner: {} }
  const { TributeRaidSystem } = loadTributeRaidSystem({
    './TributeRaidTargeting': { findRaidTarget: () => target },
  })
  const orders = []
  const owner = { units: [] }
  const unit = {
    owner,
    type: 'Bowman',
    hitPoints: 10,
    sendToEvt: (...args) => orders.push(args),
    factionExpedition: { raidId: 'saved-raid', factionId: 'civ-hellas', phase: 'hostile', tribute: { gold: 10 } },
  }
  owner.units.push(unit)
  const system = new TributeRaidSystem({
    players: [owner],
    scheduler: { add: () => 1 },
    getCampaignFactions: () => ({ 'civ-hellas': { id: 'civ-hellas' } }),
  })
  assert.equal(system.raids[0].id, 'saved-raid')
  assert.equal(system.raids[0].phase, 'hostile')
  assert.equal(system.canStartRaid(), false)
  assert.equal(owner.factionId, 'civ-hellas')
  assert.equal(orders[0][1], 'attack')
})

test('faction raids are allowed from 09:00 until before 17:00', () => {
  const { isFactionRaidHourAllowed } = loadTributeRaidRules()

  assert.equal(isFactionRaidHourAllowed(8, 59), false)
  assert.equal(isFactionRaidHourAllowed(9, 0), true)
  assert.equal(isFactionRaidHourAllowed(16, 59), true)
  assert.equal(isFactionRaidHourAllowed(17, 0), false)
})

test('bandit raids are blocked when an active bandit camp already controls the map', () => {
  const { hasActiveBanditCampPresence } = loadTributeRaidTargeting()
  const context = {
    players: [
      {
        type: constants.PLAYER_TYPES.bandits,
        units: [{ hitPoints: 12 }],
        buildings: [],
      },
    ],
  }

  assert.equal(hasActiveBanditCampPresence(context), true)
})

test('destroyed bandit camps do not block later bandit raids', () => {
  const { hasActiveBanditCampPresence } = loadTributeRaidTargeting()
  const context = {
    players: [
      {
        type: constants.PLAYER_TYPES.bandits,
        units: [{ isDead: true, hitPoints: 0 }],
        buildings: [{ isDestroyed: true, hitPoints: 0 }],
      },
    ],
  }

  assert.equal(hasActiveBanditCampPresence(context), false)
})

test('bandit raids target the hero even when an allied chief has more local presence', () => {
  const { findRaidTarget } = loadTributeRaidTargeting()
  const heroOwner = { isEnemy: () => false }
  const hero = { type: constants.UNIT_TYPES.hero, owner: heroOwner }
  const chief = { type: constants.UNIT_TYPES.chief }
  const alliedChiefOwner = {
    type: constants.PLAYER_TYPES.ai,
    isPlayed: false,
    isEnemy: () => false,
    units: [chief, { type: constants.UNIT_TYPES.villager }],
    buildings: [{ hitPoints: 150 }],
  }
  chief.owner = alliedChiefOwner
  const context = {
    controls: { heroUnit: hero },
    player: heroOwner,
    players: [heroOwner, alliedChiefOwner],
  }

  assert.equal(findRaidTarget(context, 'bandit'), hero)
})

test('bandit raids fall back to the hero without a credible local chief', () => {
  const { findRaidTarget } = loadTributeRaidTargeting()
  const heroOwner = { isEnemy: () => false }
  const hero = { type: constants.UNIT_TYPES.hero, owner: heroOwner }
  const enemyChiefOwner = {
    type: constants.PLAYER_TYPES.ai,
    isPlayed: false,
    isEnemy: () => true,
    units: [{ type: constants.UNIT_TYPES.chief }],
    buildings: [{ hitPoints: 150 }],
  }
  const context = {
    controls: { heroUnit: hero },
    player: heroOwner,
    players: [heroOwner, enemyChiefOwner],
  }

  assert.equal(findRaidTarget(context, 'bandit'), hero)
})

function raidSpawnFixture() {
  const target = { i: 50, j: 50, label: 'hero', owner: { buildings: [] } }
  const grid = Array.from({ length: 100 }, (_, i) =>
    Array.from({ length: 100 }, (_, j) => ({
      i,
      j,
      solid: false,
      has: null,
      category: 'Grass',
    }))
  )
  const { cartesianToIsometric } = loadTsModule('app/lib/maths.ts')
  const [x, y] = cartesianToIsometric(target.i, target.j)
  const context = {
    map: { grid, random: () => 0.5 },
    controls: {
      heroUnit: target,
      getViewportMetrics: () => ({ visibleLeft: x - 100, visibleTop: y - 80, visibleWidth: 200, visibleHeight: 160 }),
    },
  }
  grid[50][50].has = target
  grid[50][50].solid = true
  return { target, grid, context, cartesianToIsometric }
}

test('raids spawn together 20–35 cells from the hero, outside the camera and clear of buildings', () => {
  const { findTributeRaidSpawnCells } = loadTributeRaidSpawning()
  const { target, context, cartesianToIsometric } = raidSpawnFixture()
  target.owner.buildings.push({ i: 50, j: 24, size: 4 })
  const cells = findTributeRaidSpawnCells(context, target, 24)
  assert.equal(cells.length, 24)
  for (const cell of cells) {
    const distance = Math.hypot(cell.i - target.i, cell.j - target.j)
    assert.ok(distance >= 20 && distance <= 35)
    assert.ok(Math.hypot(cell.i - 50, cell.j - 24) > 4)
    assert.ok(Math.max(Math.abs(cell.i - cells[0].i), Math.abs(cell.j - cells[0].j)) <= 6)
    const [x, y] = cartesianToIsometric(cell.i, cell.j)
    const rect = context.controls.getViewportMetrics()
    assert.ok(
      x < rect.visibleLeft - 128 ||
        x > rect.visibleLeft + rect.visibleWidth + 128 ||
        y < rect.visibleTop - 128 ||
        y > rect.visibleTop + rect.visibleHeight + 128
    )
  }
})

for (const bridge of [false, true]) {
  test(`raid spawns are connected to the hero across a river (bridge: ${bridge})`, () => {
    const { findTributeRaidSpawnCells } = loadTributeRaidSpawning()
    const { findInstancePath } = loadTsModule('app/services/Pathfinding.ts')
    const { target, grid, context } = raidSpawnFixture()
    for (let i = 0; i < 100; i++) grid[i][40].category = bridge && i === 40 ? 'Grass' : 'Water'
    context.map.worldRegion = { x: 2, y: 2 }
    context.map.worldManifest = { settlements: [{ factionId: 'enemy', region: { x: 0, y: 0 } }] }
    const cells = findTributeRaidSpawnCells(context, target, 24, { faction: { id: 'enemy' } })
    assert.equal(cells.length, 24)
    for (const cell of cells) {
      // Reach an adjacent approach cell; the hero's own cell is occupied.
      assert.ok(findInstancePath(cell, 50, 51, context.map).length, `Unreachable ${cell.i},${cell.j}`)
      if (!bridge) assert.ok(cell.j > 40)
    }
  })
}

test('isolated heroes, interiors and a fully visible search area defer without unsafe fallback', () => {
  const { findTributeRaidSpawnCells } = loadTributeRaidSpawning()
  const { target, grid, context } = raidSpawnFixture()
  for (const [i, j] of [
    [49, 50],
    [51, 50],
    [50, 49],
    [50, 51],
  ])
    grid[i][j].category = 'Water'
  assert.deepEqual(findTributeRaidSpawnCells(context, target, 6), [])
  for (const [i, j] of [
    [49, 50],
    [51, 50],
    [50, 49],
    [50, 51],
  ])
    grid[i][j].category = 'Grass'
  target.spaceId = 'house'
  assert.deepEqual(findTributeRaidSpawnCells(context, target, 6), [])
  delete target.spaceId
  context.controls.getViewportMetrics = () => ({
    visibleLeft: -100000,
    visibleTop: -100000,
    visibleWidth: 200000,
    visibleHeight: 200000,
  })
  assert.deepEqual(findTributeRaidSpawnCells(context, target, 6), [])
})

test('5000 map raid search never enumerates the grid and has a fixed cell budget', () => {
  const { findTributeRaidSpawnCells } = loadTributeRaidSpawning()
  const { target, context } = raidSpawnFixture()
  target.i = target.j = 2500
  let reads = 0
  context.map.grid = new Proxy(
    {},
    {
      get(_rows, i) {
        assert.ok(/^\d+$/.test(String(i)), 'Only local numeric grid access is allowed')
        return new Proxy(
          {},
          {
            get(_row, j) {
              assert.ok(/^\d+$/.test(String(j)))
              assert.ok(Math.abs(Number(i) - 2500) <= 43 && Math.abs(Number(j) - 2500) <= 43)
              reads++
              return { i: Number(i), j: Number(j), category: 'Grass' }
            },
          }
        )
      },
    }
  )
  assert.equal(findTributeRaidSpawnCells(context, target, 24).length, 24)
  assert.ok(reads <= 8192, `Read ${reads} cells`)
})

test('faction raid text ignores stale bandit faction names', () => {
  const { getIncomingRaidMessage, getTributeTitle } = loadTributeRaidText()
  const raid = {
    kind: 'faction',
    faction: { id: 'civ-nord', civilization: 'Nord', name: 'Bandits' },
  }

  assert.equal(getIncomingRaidMessage(raid), 'la tribu Nord a envoyé un émissaire vers vos terres.')
  assert.equal(getTributeTitle(raid), 'Émissaire de la tribu Nord')
})

test('faction raid text uses an unknown faction fallback instead of computer', () => {
  const { getIncomingRaidMessage, getTributeTitle } = loadTributeRaidText()
  const raid = {
    kind: 'faction',
    faction: { id: 'mystery', name: 'Bandits' },
  }

  assert.equal(getIncomingRaidMessage(raid), 'faction inconnue a envoyé un émissaire vers vos terres.')
  assert.equal(getTributeTitle(raid), 'Émissaire de faction inconnue')
})

test('faction raids ignore the dedicated bandit faction', () => {
  const { TributeRaidSystem } = loadTributeRaidSystem()
  const system = Object.create(TributeRaidSystem.prototype)
  system.context = {
    getCampaignFactions: () => ({
      bandits: { id: 'bandits', name: 'Bandits', relationScore: -100, relationState: 'hostile' },
      'civ-nord': { id: 'civ-nord', name: 'Clan Nord', relationScore: -20, relationState: 'wary' },
    }),
    getCurrentWorldId: () => 'root',
    getWorldGraph: () => ({ rootWorldId: 'root' }),
    map: { random: () => 0 },
  }

  assert.equal(system.findAngryKnownFaction()?.id, 'civ-nord')
})

test('scheduled faction raids wait until the daytime raid window opens', () => {
  const { TributeRaidSystem } = loadTributeRaidSystem()
  const calls = []
  const system = Object.create(TributeRaidSystem.prototype)
  system.lastScheduledDay = 0
  system.deferredFactionRaidTaskId = null
  system.context = {
    dayNight: { state: { hour: 6, minute: 0 } },
    scheduler: {
      addOneShot(callback, delayMs, name) {
        calls.push(['addOneShot', delayMs, name])
        this.callback = callback
        return 42
      },
    },
  }
  system.triggerFactionRaid = async options => {
    calls.push(['triggerFactionRaid', options.source])
    return true
  }

  system.triggerScheduledFactionRaid(3)

  assert.deepEqual(calls, [['addOneShot', 180000, 'tributeRaid.factionWindow']])

  system.context.dayNight.state = { hour: 9, minute: 0 }
  system.context.scheduler.callback()

  assert.equal(system.deferredFactionRaidTaskId, null)
  assert.equal(calls[1][0], 'triggerFactionRaid')
})

test('faction raids cannot be triggered outside the daytime raid window', async () => {
  const { TributeRaidSystem } = loadTributeRaidSystem()
  const system = Object.create(TributeRaidSystem.prototype)
  system.context = {
    dayNight: { state: { hour: 18, minute: 0 } },
  }

  assert.equal(await system.triggerFactionRaid({ source: 'dev-console', ignoreBaseWorld: true }), false)
})

test('faction raid relation becomes hostile only when the tribute turns violent', () => {
  const { TributeRaidSystem } = loadTributeRaidSystem()
  const calls = []
  const system = Object.create(TributeRaidSystem.prototype)
  system.context = {
    changeFactionRelation: (...args) => calls.push(args),
  }

  system.makeFactionRaidRelationHostile({
    kind: 'faction',
    faction: { id: 'civ-test', relationScore: -10, relationState: 'neutral' },
  })

  assert.deepEqual(calls, [['civ-test', -55, 'tribute-refused']])
})

test('faction raid owner uses its origin faction color and civilization', () => {
  const { TributeRaidSystem } = loadTributeRaidSystem()
  const system = Object.create(TributeRaidSystem.prototype)
  system.context = {
    map: { startingResources: {} },
    player: { civ: 'Hellas' },
    players: [],
  }

  const owner = system.getOrCreateFactionRaidOwner({
    id: 'civ-nord',
    civilization: 'Nord',
    color: 'violet',
    name: 'Clan Nord',
  })

  assert.equal(owner.civ, 'Nord')
  assert.equal(owner.color, 'violet')
  assert.equal(owner.colorHex, 'hex:violet')

  const reused = system.getOrCreateFactionRaidOwner({
    id: 'civ-nord',
    civilization: 'Nord',
    color: 'green',
    name: 'Clan Nord',
  })

  assert.equal(reused, owner)
  assert.equal(reused.civ, 'Nord')
  assert.equal(reused.color, 'green')
  assert.equal(reused.colorHex, 'hex:green')
})

test('bandit raids keep targeting the hero when the player has the stronger local presence', () => {
  const { findRaidTarget } = loadTributeRaidTargeting()
  const heroOwner = {
    isEnemy: () => false,
    units: [
      { type: constants.UNIT_TYPES.hero },
      { type: constants.UNIT_TYPES.villager },
      { type: constants.UNIT_TYPES.villager },
    ],
    buildings: [{ hitPoints: 150 }, { hitPoints: 150 }],
  }
  const hero = { type: constants.UNIT_TYPES.hero, owner: heroOwner }
  heroOwner.units[0] = hero
  const chief = { type: constants.UNIT_TYPES.chief }
  const alliedChiefOwner = {
    type: constants.PLAYER_TYPES.ai,
    isPlayed: false,
    isEnemy: () => false,
    units: [chief],
    buildings: [{ hitPoints: 150 }],
  }
  chief.owner = alliedChiefOwner
  const context = {
    controls: { heroUnit: hero },
    player: heroOwner,
    players: [heroOwner, alliedChiefOwner],
  }

  assert.equal(findRaidTarget(context, 'bandit'), hero)
})

function negotiationHarness(t, { affordable = true, local = false } = {}) {
  const calls = []
  let modalOptions
  let canPay = affordable
  const originalDocument = global.document
  global.document = {
    createElement: tag => ({
      tag,
      children: [],
      listeners: {},
      appendChild(child) {
        this.children.push(child)
      },
      addEventListener(event, fn) {
        this.listeners[event] = fn
      },
    }),
  }
  t.after(() => {
    global.document = originalDocument
  })
  const { TributeRaidSystem } = loadTributeRaidSystem({
    '../lib': { canAfford: () => canPay, payCost: owner => calls.push(['paid', owner]), getHexColor: color => color },
    '../ui/InspectionPanel': {
      createInspectionModal: options => {
        modalOptions = options
        return { close: options.onClose }
      },
    },
  })
  const player = { isPlayed: !local }
  const chief = { stop: () => calls.push(['stop']), owner: {} }
  const raid = {
    id: 'test',
    kind: 'bandit',
    chief,
    target: { owner: player },
    units: [chief],
    tribute: { gold: 50 },
    phase: 'approaching',
    modal: null,
    updateTaskId: 12,
  }
  const system = new TributeRaidSystem({
    player,
    map: { random: () => 0 },
    menu: { showMessage: (...args) => calls.push(['message', ...args]), updateTopbar: () => calls.push(['topbar']) },
    scheduler: { remove: id => calls.push(['remove', id]) },
  })
  system.raids.push(raid)
  system.acceptTribute = current => {
    current.phase = 'leaving'
    calls.push(['accepted'])
  }
  system.makeRaidHostile = current => {
    current.phase = 'hostile'
    calls.push(['hostile'])
  }
  return {
    system,
    raid,
    calls,
    setAffordable: value => {
      canPay = value
    },
    modal: () => modalOptions,
    buttons: () =>
      modalOptions.content.children.find(child => child.className?.includes('bandit-tribute-actions')).children,
  }
}

test('tribute payment is rechecked and a resolved modal cannot charge twice or turn hostile', t => {
  const h = negotiationHarness(t)
  h.system.resolveTributeParley(h.raid)
  const [pay, refuse] = h.buttons()
  assert.equal(pay.disabled, false)
  h.setAffordable(false)
  pay.listeners.click()
  assert.equal(h.calls.filter(c => c[0] === 'paid').length, 0)
  assert.equal(h.raid.phase, 'parley')
  h.setAffordable(true)
  pay.listeners.click()
  pay.listeners.click()
  refuse.listeners.click()
  assert.equal(h.calls.filter(c => c[0] === 'paid').length, 1)
  assert.equal(h.calls.filter(c => c[0] === 'accepted').length, 1)
  assert.equal(h.calls.filter(c => c[0] === 'hostile').length, 0)
  assert.equal(h.raid.modal, null)
})

test('refusing or closing an unresolved tribute dialog makes the raid hostile once', t => {
  const h = negotiationHarness(t, { affordable: false })
  h.system.openTributeModal(h.raid)
  assert.equal(h.buttons()[0].disabled, true)
  assert.equal(h.buttons()[0].title, undefined)
  assert.ok(
    h.modal().content.children.some(child => child.tag === 'p' && child.textContent === 'banditTributeCannotPay')
  )
  const modal = h.raid.modal
  h.system.openTributeModal(h.raid)
  assert.equal(h.raid.modal, modal)
  h.buttons()[1].listeners.click()
  h.buttons()[1].listeners.click()
  assert.equal(h.calls.filter(c => c[0] === 'hostile').length, 1)
  h.raid.phase = 'approaching'
  h.system.openTributeModal(h.raid)
  h.modal().onClose()
  assert.equal(h.calls.filter(c => c[0] === 'hostile').length, 2)
})

test('cleaning up an open tribute negotiation never counts as a refusal', t => {
  const h = negotiationHarness(t)
  h.system.openTributeModal(h.raid)
  const [pay, refuse] = h.buttons()
  h.system.cleanupRaid(h.raid)
  pay.listeners.click()
  refuse.listeners.click()
  assert.equal(h.raid.phase, 'leaving')
  assert.equal(h.raid.modal, null)
  assert.equal(h.system.raids.length, 0)
  assert.deepEqual(
    h.calls.filter(c => ['paid', 'hostile', 'accepted'].includes(c[0])),
    []
  )
  assert.ok(h.calls.some(c => c[0] === 'remove' && c[1] === 12))
})

test('local chiefs pay only when affordable and the negotiation roll succeeds', t => {
  const h = negotiationHarness(t, { local: true })
  h.system.resolveTributeParley(h.raid)
  assert.equal(h.calls.filter(c => c[0] === 'paid').length, 1)
  h.setAffordable(false)
  h.system.resolveTributeParley(h.raid)
  assert.equal(h.raid.phase, 'hostile')
  h.setAffordable(true)
  h.system.context.map.random = () => 0.5
  assert.equal(h.system.shouldLocalChiefPayTribute(h.raid), false)
  delete h.raid.target.owner
  h.system.resolveTributeParley(h.raid)
  assert.equal(h.system.shouldLocalChiefPayTribute(h.raid), false)
  assert.equal(h.calls.filter(c => c[0] === 'paid').length, 1)
})

test('raid balance keeps limits, military exclusions and rounded tribute amounts', () => {
  const { TributeRaidSystem } = loadTributeRaidSystem()
  const system = new TributeRaidSystem({ map: { random: () => 0 } })
  const faction = { relationScore: 0 }
  assert.equal(system.getLivingPlayerMilitaryCount(), 0)
  assert.equal(system.getBanditRaidSize(), 2)
  assert.equal(system.getFactionRaidSize(faction), 2)
  assert.deepEqual(system.getBanditTributeCost(), { food: 50, gold: 30 })
  assert.deepEqual(system.getFactionTributeCost(faction), { food: 50, gold: 30 })
  system.context.player = {
    age: 1,
    units: [
      { type: 'Hero' },
      { type: 'Villager' },
      { type: 'Fantassin' },
      { type: 'Bowman' },
      { type: 'Fantassin', isDead: true },
      { type: 'Bowman', isDestroyed: true },
    ],
  }
  system.context.dayNight = { state: { day: 10 } }
  assert.equal(system.getLivingPlayerMilitaryCount(), 2)
  assert.equal(system.getBanditRaidSize(), 5)
  assert.equal(system.getFactionRaidSize({ relationScore: -50 }), 6)
  assert.deepEqual(system.getFactionTributeCost({ relationScore: -50 }), { food: 160, gold: 110 })
  system.context.player.age = 100
  assert.equal(system.getBanditRaidSize(), 7)
  assert.equal(system.getFactionRaidSize({ relationScore: -100 }), 9)
})

test('faction selection respects the base world and the worst-relation candidate window', () => {
  const { TributeRaidSystem } = loadTributeRaidSystem()
  const context = {
    map: { random: () => 0 },
    getCurrentWorldId: () => 'other',
    getWorldGraph: () => ({ rootWorldId: 'root' }),
  }
  const system = new TributeRaidSystem(context)
  assert.equal(system.findAngryKnownFaction(), null)
  assert.equal(system.findAngryKnownFaction({ ignoreBaseWorld: true }), null)
  const worst = { id: 'worst', relationScore: -90 }
  context.getCampaignFactions = () => ({
    worst,
    near: { id: 'near', relationScore: -75 },
    far: { id: 'far', relationScore: -20 },
    friend: { id: 'friend', relationScore: 20 },
  })
  assert.equal(system.findAngryKnownFaction({ ignoreBaseWorld: true }), worst)
  context.map.random = () => 0.9
  assert.equal(system.findAngryKnownFaction({ ignoreBaseWorld: true }).id, 'near')
  context.map.random = () => 1
  assert.equal(system.findAngryKnownFaction({ ignoreBaseWorld: true }), worst)
  delete context.getWorldGraph
  delete context.getCurrentWorldId
  assert.equal(system.isBaseWorld(), false)
})

test('temporary raid owners retain their identities and use civilization fallbacks', async t => {
  const { TributeRaidSystem } = loadTributeRaidSystem()
  const system = new TributeRaidSystem({ players: [], map: {} })
  const bandit = system.getOrCreateBanditOwner()
  assert.equal(bandit.civ, 'Hellas')
  bandit.diplomacy = 'hostile'
  assert.equal(system.getOrCreateBanditOwner(), bandit)
  assert.equal(bandit.diplomacy, 'neutral')
  const faction = { id: 'f', name: 'Faction' }
  const owner = system.getOrCreateFactionRaidOwner(faction)
  assert.equal(owner.civ, 'Hellas')
  assert.equal(owner.color, 'red')
  delete owner.color
  delete owner.civ
  assert.equal(system.getOrCreateFactionRaidOwner(faction).civ, 'Hellas')
  system.context.player = { civ: 'Nord' }
  delete owner.civ
  assert.equal(system.getOrCreateFactionRaidOwner(faction).civ, 'Nord')
  assert.equal(system.context.players.length, 2)
  await system.preloadRaidOwnerAssets(owner)
  const messages = []
  t.mock.method(console, 'error', (...args) => messages.push(args))
  const failing = loadTributeRaidSystem({
    '../lib/lpc': {
      preloadBakedLpcUnitsForPlayers: async () => {
        throw new Error('unavailable')
      },
    },
  })
  await new failing.TributeRaidSystem(system.context).preloadRaidOwnerAssets(owner)
  assert.equal(messages.length, 1)
})

test('tutorial faction raid starts at night without an economic army and attacks without parley', async () => {
  const target = { label: 'hero', i: 10, j: 10, owner: {} }
  const { TributeRaidSystem } = loadTributeRaidSystem({
    './TributeRaidTargeting': { findRaidTarget: () => target },
    './tribute/FactionRaidEconomy': {
      commitFactionRaidArmy: () => assert.fail('Scripted army must not drain world economy'),
    },
  })
  const context = {
    players: [],
    player: { civ: 'Hellas' },
    map: { random: () => 0 },
    isTutorialActive: () => true,
    dayNight: { state: { day: 1, hour: 23 } },
    scheduler: { add: () => 1 },
    menu: { showMessage() {}, isMiniMapActive: () => false },
  }
  const system = new TributeRaidSystem(context)
  system.isFactionRaidWindowOpen = () => false
  system.findSpawnCells = (_target, count) => Array.from({ length: count }, (_, i) => ({ i, j: 0 }))
  system.preloadRaidOwnerAssets = async () => {}
  system.startRaidUpdates = () => {}
  system.sendRaidToTarget = () => assert.fail('No tribute approach during tutorial')
  const attacks = []
  const owner = {
    units: [],
    createUnit(options) {
      const unit = {
        ...options,
        label: `raider-${this.units.length}`,
        owner: this,
        hitPoints: 50,
        sendToEvt: (dest, action) => attacks.push([dest, action]),
      }
      this.units.push(unit)
      return unit
    },
  }
  system.createTemporaryRaidOwner = () => owner
  assert.equal(await system.triggerTutorialRaid(), true)
  assert.equal(system.raids[0].kind, 'faction')
  assert.equal(system.raids[0].phase, 'hostile')
  assert.equal(system.raids[0].units.length, 24)
  assert.equal(attacks.length, 24)
  assert.ok(attacks.every(([dest, action]) => dest === target && action === 'attack'))
  assert.equal(await system.triggerTutorialRaid(), false)
  assert.equal(system.factionRaidPending, false)
})

test('scripted tutorial raid is unavailable outside the tutorial', async () => {
  const { TributeRaidSystem } = loadTributeRaidSystem()
  const runtime = {
    context: { isTutorialActive: () => false },
    createTemporaryRaidOwner: () => assert.fail('Unexpected army'),
  }
  assert.equal(await TributeRaidSystem.prototype.triggerTutorialRaid.call(runtime), false)
})

test('hostile raiders approach the raid location before seeing the hero, then attack on sight', () => {
  let visible = false
  const { TributeRaidSystem } = loadTributeRaidSystem({
    '../lib/units/playerTargetKnowledge': { playerSeesTarget: () => visible },
    '../lib/mapSpaces': { getEntitySpaceMapLike: (_unit, map) => map },
  })
  const cell = { i: 10, j: 10 }
  const orders = []
  const unit = { i: 0, j: 0, owner: {}, sendToEvt: (...args) => orders.push(args) }
  const target = { i: 10, j: 10 }
  const raid = { units: [unit], chief: unit, target, phase: 'hostile' }
  const runtime = new TributeRaidSystem({ map: { grid: { 10: { 10: cell } } }, players: [] })
  runtime.updateRaid(raid)
  assert.equal(orders[0][0], cell)
  assert.equal(orders[0][1], null)
  unit.path = [cell]
  target.i = 15
  runtime.updateRaid(raid)
  assert.equal(orders.length, 1, 'hidden hero movement must not keep changing the rally order')
  visible = true
  runtime.updateRaid(raid)
  assert.equal(orders[1][0], target)
  assert.equal(orders[1][1], 'attack')
  unit.action = 'attack'
  runtime.updateRaid(raid)
  assert.equal(orders.length, 2, 'ongoing combat is not restarted')
})

function deferredRaidFixture(kind = 'bandit') {
  const hero = { i: 50, j: 50, label: 'hero' }
  let committed = 0,
    nextTask = 0
  const tasks = new Map()
  const { TributeRaidSystem } = loadTributeRaidSystem({
    './TributeRaidTargeting': { findRaidTarget: context => context.controls.heroUnit },
    './tribute/FactionRaidEconomy': {
      commitFactionRaidArmy: () => {
        committed++
        return true
      },
      expeditionState: () => ({}),
    },
  })
  const context = {
    map: { random: () => 0 },
    players: [],
    controls: { heroUnit: hero },
    scheduler: {
      add: () => ++nextTask,
      addOneShot: (callback, delay, name) => {
        tasks.set(++nextTask, { callback, delay, name })
        return nextTask
      },
      remove: id => tasks.delete(id),
    },
  }
  const system = new TributeRaidSystem(context)
  const owner = { createUnit: options => ({ ...options, owner }) }
  const options = {
    kind,
    owner,
    size: 2,
    tribute: {},
    ...(kind === 'faction'
      ? {
          faction: { id: 'enemy' },
          army: { units: [{ type: 'Fantassin' }, { type: 'Bowman' }] },
        }
      : {}),
  }
  system.preloadRaidOwnerAssets = async () => {}
  system.findSpawnCells = target => [
    { i: target.i + 25, j: target.j },
    { i: target.i + 25, j: target.j + 1 },
  ]
  system.triggerRaid = () => system.createRaid(options)
  system.triggerFactionRaid = () => system.createRaid(options)
  const retry = async () => {
    const [id, task] = tasks.entries().next().value
    assert.equal(task.delay, 5000)
    tasks.delete(id)
    task.callback()
    await new Promise(resolve => setImmediate(resolve))
  }
  return { system, context, options, tasks, hero, retry, committed: () => committed }
}

for (const kind of ['bandit', 'faction']) {
  test(`${kind}: placement uses the hero after preload and concurrent requests cannot duplicate a raid`, async () => {
    const f = deferredRaidFixture(kind)
    let loaded
    f.system.preloadRaidOwnerAssets = () =>
      new Promise(resolve => {
        loaded = resolve
      })
    const starting = f.system.createRaid(f.options)
    assert.equal(await f.system.createRaid(f.options), false)
    f.hero.i = 200
    loaded()
    assert.equal(await starting, true)
    assert.equal(f.system.raids.length, 1)
    assert.equal(f.system.raids[0].units[0].i, 225)
  })

  test(`${kind}: blocked placement queues one retry, then spawns without early faction costs`, async () => {
    const f = deferredRaidFixture(kind)
    const valid = f.system.findSpawnCells
    f.system.findSpawnCells = () => []
    assert.equal(await f.system.createRaid(f.options), false)
    assert.equal(await f.system.createRaid(f.options), false)
    assert.equal(f.tasks.size, 1)
    assert.equal(f.committed(), 0)
    f.system.findSpawnCells = valid
    await f.retry()
    assert.equal(f.system.raids.length, 1)
    assert.equal(f.committed(), kind === 'faction' ? 1 : 0)
    assert.equal(f.tasks.size, 0)
  })
}

test('indoor heroes defer before asset loading; pending retries disappear with the runtime', async () => {
  const f = deferredRaidFixture()
  f.hero.spaceId = 'house'
  f.system.preloadRaidOwnerAssets = async () => assert.fail('No preload needed indoors')
  assert.equal(await f.system.createRaid(f.options), false)
  assert.equal(f.tasks.size, 1)
  await f.retry()
  assert.equal(f.tasks.size, 1)
  assert.equal(f.system.raids.length, 0)
  f.system.destroy()
  assert.equal(f.tasks.size, 0)
})

test('a hero entering an interior during preload defers rather than using outside coordinates', async () => {
  const f = deferredRaidFixture()
  f.system.preloadRaidOwnerAssets = async () => {
    f.hero.spaceId = 'house'
  }
  f.system.findSpawnCells = () => assert.fail('Interior coordinates must not be used on the outside grid')
  assert.equal(await f.system.createRaid(f.options), false)
  assert.equal(f.tasks.size, 1)
})

test('faction spawn retry waits for the permitted hour before attempting recruitment', async () => {
  const f = deferredRaidFixture('faction')
  f.system.findSpawnCells = () => []
  assert.equal(await f.system.createRaid(f.options), false)
  f.context.dayNight = { state: { hour: 20, minute: 0 } }
  f.system.triggerFactionRaid = () => assert.fail('Faction hours must be respected')
  await f.retry()
  assert.equal(f.tasks.size, 1)
  assert.equal(f.committed(), 0)
})

test('wide cameras expand the nearby range within a hard cap instead of preventing every raid', () => {
  const { findTributeRaidSpawnCells } = loadTributeRaidSpawning()
  const { target, context, cartesianToIsometric } = raidSpawnFixture()
  const [heroX, heroY] = cartesianToIsometric(target.i, target.j)
  context.controls.getViewportMetrics = () => ({
    visibleLeft: heroX - 960,
    visibleTop: heroY - 540,
    visibleWidth: 1920,
    visibleHeight: 1080,
  })
  const cells = findTributeRaidSpawnCells(context, target, 24)
  assert.equal(cells.length, 24)
  for (const cell of cells) {
    assert.ok(Math.hypot(cell.i - target.i, cell.j - target.j) <= 80)
    const [x, y] = cartesianToIsometric(cell.i, cell.j)
    assert.ok(Math.abs(x - heroX) > 1088 || Math.abs(y - heroY) > 668)
  }
})
