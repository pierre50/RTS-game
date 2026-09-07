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
          Boolean(player?.units?.some(unit => unit.type === constants.UNIT_TYPES.chief && !unit.isDead && !unit.isDestroyed)),
        isLivingChief: unit =>
          Boolean(unit?.type === constants.UNIT_TYPES.chief && !unit.isDead && !unit.isDestroyed),
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

function loadTributeRaidSystem() {
  return loadTsModule('app/services/TributeRaidSystem.ts', {
    mocks: {
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
    },
  })
}

test('tribute demands are rounded to clean resource amounts', () => {
  const { roundTributeCost, roundTributeValue } = loadTributeRaidRules()

  assert.equal(roundTributeValue(54), 50)
  assert.equal(roundTributeValue(61), 60)
  assert.deepEqual(roundTributeCost({ food: 61, gold: 196 }), { food: 60, gold: 200 })
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
  assert.equal(cells.some(cell => Math.hypot(cell.i - 9, cell.j - 10) <= 4), false)
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
