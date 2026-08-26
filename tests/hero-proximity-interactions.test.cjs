const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadHeroProximityInteractions() {
  return loadTsModule('app/lib/hero/heroProximityInteractions.ts', {
    mocks: {
      '../../constants': {
        BUILDING_TYPES: { townCenter: 'TownCenter' },
        SHEET_TYPES: { corpse: 'corpseSheet' },
      },
      '../grid/cells': {
        getCellsInCellRadius: (_i, _j, grid) => grid.flat(),
      },
      '../npc/npcInteraction': {
        isTalkableNpc: (_hero, target) => target?.talkable === true,
      },
      './heroActionRange': {
        isHeroInteractionTargetReachable: (_hero, _action, target) => target?.reachable !== false,
      },
      '../maths': {
        angleDelta(a, b) {
          const diff = Math.abs(a - b) % 360
          return diff > 180 ? 360 - diff : diff
        },
        getInstanceDegree(instance, x, y) {
          return Math.round((Math.atan2(y - instance.y, x - instance.x) * 180) / Math.PI + 180)
        },
      },
    },
  })
}

function makeHero(extra = {}) {
  return {
    i: 0,
    j: 0,
    degree: 90,
    x: 100,
    y: 248,
    context: { map: { grid: [[{ corpses: new Set() }]] } },
    ...extra,
  }
}

test('hero proximity interaction resolves a town center door as enter', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const building = { isBuilt: true, type: 'TownCenter', x: 100, y: 200 }

  assert.deepEqual(resolveHeroProximityInteraction({ buildings: [building], hero: makeHero() }), {
    action: 'enter',
    labelKey: 'heroInteractionEnter',
    target: building,
  })
})

test('hero proximity interaction ignores a town center door behind the hero', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const building = { isBuilt: true, type: 'TownCenter', x: 100, y: 200 }

  assert.equal(resolveHeroProximityInteraction({ buildings: [building], hero: makeHero({ degree: 270 }) }), null)
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
  const npc = { family: 'unit', isDead: false, isDestroyed: false, talkable: true, type: 'Villager', x: 100, y: 90 }

  assert.deepEqual(resolveHeroProximityInteraction({ hero: makeHero({ y: 100 }), openEntityTarget: npc }), {
    action: 'communicate',
    labelKey: 'heroInteractionCommunicate',
    target: npc,
  })
})
