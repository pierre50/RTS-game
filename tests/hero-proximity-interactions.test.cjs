const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadHeroProximityInteractions() {
  return loadTsModule('app/lib/hero/heroProximityInteractions.ts', {
    mocks: {
      '../../constants': {
        ACTION_TYPES: { attack: 'attack' },
        BUILDING_TYPES: { house: 'House', townCenter: 'TownCenter' },
        SHEET_TYPES: { corpse: 'corpseSheet' },
      },
      '../chief': {
        heroCanCommand: hero => Boolean(hero?.isChief),
      },
      '../buildings/interiorExits': {
        isHeroOnInteriorExitCell: hero => Boolean(hero?.onInteriorExit),
      },
      '../grid/cells': {
        getCellsInCellRadius: (_i, _j, grid) => grid.flat(),
      },
      '../npc/npcChatter': {
        pickForeignNpcChatterLine: () => 'foreign chatter',
        pickNpcChatterLine: () => 'friendly chatter',
      },
      '../npc/npcInteraction': {
        isTalkableNpc: (_hero, target) => target?.talkable === true,
      },
      './heroActionRange': {
        isHeroInteractionTargetReachable: (_hero, _action, target) => target?.reachable !== false,
      },
    },
  })
}

function makeHero(extra = {}) {
  const grid = Array.from({ length: 12 }, (_, i) =>
    Array.from({ length: 12 }, (_, j) => ({ i, j, corpses: new Set() }))
  )
  return {
    i: 6,
    isChief: true,
    j: 7,
    degree: 90,
    x: 100,
    y: 248,
    context: { map: { grid } },
    ...extra,
  }
}

test('hero proximity interaction resolves a town center door as enter', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const building = { i: 5, isBuilt: true, j: 5, type: 'TownCenter' }

  assert.deepEqual(resolveHeroProximityInteraction({ buildings: [building], hero: makeHero() }), {
    action: 'enter',
    labelKey: 'heroInteractionEnter',
    target: building,
  })
})

test('hero proximity interaction resolves a house door as enter', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const building = { i: 5, isBuilt: true, j: 5, type: 'House' }

  assert.deepEqual(resolveHeroProximityInteraction({ buildings: [building], hero: makeHero() }), {
    action: 'enter',
    labelKey: 'heroInteractionEnter',
    target: building,
  })
})

test('hero proximity interaction resolves an interior exit cell as exit', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const building = { i: 5, isBuilt: true, j: 5, type: 'TownCenter' }

  assert.deepEqual(resolveHeroProximityInteraction({ buildings: [building], hero: makeHero({ onInteriorExit: true }) }), {
    action: 'exit',
    labelKey: 'heroInteractionExit',
  })
})

test('hero proximity interaction ignores a town center when hero is not on the entry cell', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const building = { i: 5, isBuilt: true, j: 5, type: 'TownCenter' }

  assert.equal(resolveHeroProximityInteraction({ buildings: [building], hero: makeHero({ i: 4 }) }), null)
})

test('hero proximity interaction resolves a close companion horse as mount', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const horse = { family: 'animal', i: 0, isDead: false, isDestroyed: false, j: 1, type: 'Horse', x: 110, y: 250 }

  assert.deepEqual(resolveHeroProximityInteraction({ companionHorse: horse, hero: makeHero({ y: 100 }) }), {
    action: 'mount',
    labelKey: 'heroInteractionMount',
    target: horse,
  })
})

test('hero proximity interaction resolves the nearest openable corpse as open', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const farCorpse = { currentSheet: 'corpseSheet', family: 'unit', isDead: true, type: 'Scout', x: 160, y: 100 }
  const nearCorpse = { currentSheet: 'corpseSheet', family: 'unit', isDead: true, type: 'Scout', x: 105, y: 100 }
  const hero = makeHero({
    context: { map: { grid: [[{ corpses: new Set([farCorpse, nearCorpse]) }]] } },
    y: 100,
  })

  assert.deepEqual(resolveHeroProximityInteraction({ hero }), {
    action: 'open',
    labelKey: 'heroInteractionOpen',
    target: nearCorpse,
  })
})

test('hero proximity interaction resolves a facing talkable npc as communicate', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const owner = { isPlayed: true }
  const npc = {
    family: 'unit',
    isDead: false,
    isDestroyed: false,
    owner,
    talkable: true,
    type: 'Villager',
    x: 100,
    y: 90,
  }
  const hero = makeHero({ owner, y: 100 })

  assert.deepEqual(resolveHeroProximityInteraction({ hero, openEntityTarget: npc }), {
    action: 'communicate',
    labelKey: 'heroInteractionCommunicate',
    target: npc,
  })
})

test('hero proximity interaction disables npc orders when the hero cannot command', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const owner = { isPlayed: true }
  const npc = {
    family: 'unit',
    isDead: false,
    isDestroyed: false,
    owner,
    talkable: true,
    type: 'Villager',
    x: 100,
    y: 90,
  }
  const hero = makeHero({ isChief: false, owner, y: 100 })

  assert.deepEqual(resolveHeroProximityInteraction({ hero, openEntityTarget: npc }), {
    action: 'communicate',
    labelKey: 'heroInteractionCommunicate',
    npcOptions: { chatterLine: 'friendly chatter', ordersEnabled: false },
    target: npc,
  })
})

test('hero proximity interaction disables npc orders for foreign talkable npcs', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const npc = {
    family: 'unit',
    isDead: false,
    isDestroyed: false,
    owner: { isPlayed: false },
    talkable: true,
    type: 'Villager',
    x: 100,
    y: 90,
  }

  assert.deepEqual(
    resolveHeroProximityInteraction({ hero: makeHero({ owner: { isPlayed: true }, y: 100 }), openEntityTarget: npc }),
    {
      action: 'communicate',
      labelKey: 'heroInteractionCommunicate',
      npcOptions: { chatterLine: 'foreign chatter', ordersEnabled: false },
      target: npc,
    }
  )
})
