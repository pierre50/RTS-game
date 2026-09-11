const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

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
  return loadTsModule('app/services/TributeRaidRules.ts', {
    mocks: {
      '../constants': constants,
    },
  })
}

function loadTributeRaidSpawning() {
  return loadTsModule('app/services/tribute/TributeRaidSpawning.ts', {
    mocks: {
      '../../constants': { FADE_DURATION_MS: 200 },
      '../../lib': {
        getCellsAroundPoint: (startI, startJ, grid, distance, callback) => {
          const cells = []
          for (const row of grid) {
            for (const cell of row) {
              if (Math.hypot(cell.i - startI, cell.j - startJ) <= distance && (!callback || callback(cell))) {
                cells.push(cell)
              }
            }
          }
          return cells
        },
        getFreeLandCellAroundInstance: (_target, grid, _pickRandomItem, extraCondition) => {
          for (const row of grid) {
            for (const cell of row) {
              if (!cell.solid && cell.category !== 'Water' && (!extraCondition || extraCondition(cell))) return cell
            }
          }
          return null
        },
      },
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
      '../Pathfinding': {
        findInstancePath: () => [{ i: 1, j: 1 }],
      },
      '../TributeRaidRules': loadTributeRaidRules(),
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
      '../ui/EntityInfoModalManager': {
        createTitledEntityInfoContent: () => ({ appendChild: () => {} }),
      },
      './TributeRaidRules': loadTributeRaidRules(),
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
  const { roundTributeCost, roundTributeValue } = loadTributeRaidRules()

  assert.equal(roundTributeValue(54), 50)
  assert.equal(roundTributeValue(61), 60)
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

test('bandit raids target a living allied ai chief before the hero', () => {
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

  assert.equal(findRaidTarget(context, 'bandit'), chief)
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

test('tribute raid spawn cells stay clear of the target owner buildings', () => {
  const { findTributeRaidSpawnCells } = loadTributeRaidSpawning()
  const targetOwner = {
    buildings: [{ i: 9, j: 10, size: 4, hitPoints: 250 }],
  }
  const target = { i: 10, j: 10, owner: targetOwner }
  const grid = Array.from({ length: 18 }, (_, i) =>
    Array.from({ length: 18 }, (_, j) => ({
      i,
      j,
      solid: false,
      has: null,
      border: false,
      waterBorder: false,
      category: 'Grass',
    }))
  )

  const cells = findTributeRaidSpawnCells({ map: { grid, random: () => 0.5 } }, target, 6)

  assert.ok(cells.length > 0)
  assert.equal(
    cells.some(cell => Math.hypot(cell.i - 9, cell.j - 10) <= 4),
    false
  )
})

test('faction raid spawn prefers the map edge facing the faction home region', () => {
  const { findTributeRaidSpawnCells } = loadTributeRaidSpawning()
  const target = { i: 10, j: 10, owner: { buildings: [] } }
  const grid = Array.from({ length: 20 }, (_, i) =>
    Array.from({ length: 20 }, (_, j) => ({
      i,
      j,
      solid: false,
      has: null,
      border: false,
      waterBorder: false,
      category: 'Grass',
    }))
  )

  const cells = findTributeRaidSpawnCells(
    {
      map: {
        grid,
        random: () => 0.5,
        worldRegion: { x: 2, y: 2 },
        worldManifest: {
          settlements: [{ kind: 'village', civ: 'Nord', factionId: 'civ-nord', region: { x: 0, y: 0 } }],
        },
      },
    },
    target,
    4,
    { faction: { id: 'civ-nord', civilization: 'Nord' } }
  )

  assert.ok(cells.length > 0)
  assert.equal(cells[0].i <= 3, true)
  assert.equal(cells[0].j <= 3, true)
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
    buttons: () => modalOptions.content.children[2].children,
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
  assert.ok(h.buttons()[0].title)
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
