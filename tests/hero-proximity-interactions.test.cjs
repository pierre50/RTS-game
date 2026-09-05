const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadHeroProximityInteractions() {
  return loadTsModule('app/lib/hero/heroProximityInteractions.ts', {
    mocks: {
      '../../constants': {
        ACTION_TYPES: { attack: 'attack' },
        BUILDING_TYPES: {
          chest: 'Chest',
          fireCamp: 'FireCamp',
          house: 'House',
          stable: 'Stable',
          townCenter: 'TownCenter',
          trap: 'Trap',
        },
        SHEET_TYPES: { corpse: 'corpseSheet' },
        UNIT_TYPES: { villager: 'Villager' },
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
      '../grid/visibility': {
        findInstancesInSight: hero => hero.hostilesInSight ?? [],
        instanceIsInActiveOrTeamSight: building => building.visibleToHero === true,
      },
      '../horses/horseTaming': {
        isTamedHorse: horse => horse?.type === 'Horse' && horse?.tamingStatus === 'tamed',
      },
      '../mapSpaces': {
        getEntitySpaceMapLike: entity => entity?.context?.map ?? null,
        getMapSpace: (map, spaceId) => map?.spaces?.get?.(spaceId) ?? null,
        isOutsideSpaceId: spaceId => !spaceId || spaceId === 'outside',
      },
      '../npc/npcChatter': {
        pickForeignNpcChatterLine: () => 'foreign chatter',
        pickNpcChatterLine: () => 'friendly chatter',
        pickNpcRestingChatterLine: () => 'resting chatter',
      },
      '../npc/npcInteraction': {
        isTalkableNpc: (_hero, target) => target?.talkable === true,
      },
      '../units/villagerSchedule': {
        shouldVillagerRestBeforeBed: unit => {
          const hour = unit?.context?.dayNight?.state?.hour ?? 12
          return hour >= 18 && hour < 22
        },
      },
      './heroCampfireSleep': {
        isUsableFireCamp: (_hero, building) => building?.type === 'FireCamp' && building.reachable !== false,
      },
      './heroActionRange': {
        isHeroInteractionTargetReachable: (_hero, _action, target) => target?.reachable !== false,
      },
    },
  })
}

function makeHero(extra = {}) {
  const grid = Array.from({ length: 12 }, (_, i) =>
    Array.from({ length: 12 }, (_, j) => ({ i, j, corpses: new Set(), has: null }))
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

test('hero proximity interaction offers to force entry on defended enemy interiors', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const enemy = { label: 'enemy' }
  const player = { isEnemy: owner => owner === enemy, label: 'player' }
  const building = {
    hitPoints: 30,
    i: 5,
    isBuilt: true,
    j: 5,
    owner: enemy,
    totalHitPoints: 100,
    type: 'TownCenter',
  }

  assert.deepEqual(resolveHeroProximityInteraction({ buildings: [building], hero: makeHero({ owner: player }) }), {
    action: 'enter',
    labelKey: 'heroInteractionForceEntry',
    target: building,
  })
})

test('hero proximity interaction allows entry once an enemy interior is weakened', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const enemy = { label: 'enemy' }
  const player = { isEnemy: owner => owner === enemy, label: 'player' }
  const building = {
    hitPoints: 20,
    i: 5,
    isBuilt: true,
    j: 5,
    owner: enemy,
    totalHitPoints: 100,
    type: 'TownCenter',
  }

  assert.deepEqual(resolveHeroProximityInteraction({ buildings: [building], hero: makeHero({ owner: player }) }), {
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

  assert.deepEqual(
    resolveHeroProximityInteraction({ buildings: [building], hero: makeHero({ onInteriorExit: true }) }),
    {
      action: 'exit',
      labelKey: 'heroInteractionExit',
    }
  )
})

test('hero proximity interaction ignores a town center when hero is not on the entry cell', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const building = { i: 5, isBuilt: true, j: 5, type: 'TownCenter' }

  assert.equal(resolveHeroProximityInteraction({ buildings: [building], hero: makeHero({ i: 4 }) }), null)
})

test('hero proximity interaction ignores a fogged trap', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const building = {
    i: 6,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 7,
    reachable: true,
    requiresActiveSightInteraction: true,
    type: 'Trap',
    visibleToHero: false,
    x: 100,
    y: 248,
  }

  assert.equal(resolveHeroProximityInteraction({ buildings: [building], hero: makeHero() }), null)
})

test('hero proximity interaction can recover a visible foreign trap', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const building = {
    i: 6,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 7,
    owner: { label: 'other-player' },
    reachable: true,
    requiresActiveSightInteraction: true,
    type: 'Trap',
    visibleToHero: true,
    x: 100,
    y: 248,
  }

  assert.deepEqual(resolveHeroProximityInteraction({ hero: makeHero(), openEntityTarget: building }), {
    action: 'recoverTrap',
    labelKey: 'heroInteractionRecover',
    target: building,
  })
})

test('hero proximity interaction ignores a visible trap that is not the facing target', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const building = {
    i: 6,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 7,
    owner: { label: 'other-player' },
    reachable: true,
    requiresActiveSightInteraction: true,
    type: 'Trap',
    visibleToHero: true,
    x: 100,
    y: 248,
  }

  assert.equal(resolveHeroProximityInteraction({ buildings: [building], hero: makeHero() }), null)
})

test('hero proximity interaction opens a nearby chest', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const chest = {
    i: 6,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 7,
    reachable: true,
    type: 'Chest',
    x: 100,
    y: 248,
  }

  assert.deepEqual(resolveHeroProximityInteraction({ hero: makeHero(), openEntityTarget: chest }), {
    action: 'open',
    labelKey: 'heroInteractionOpen',
    target: chest,
  })
})

test('hero proximity interaction ignores a nearby chest that is not the facing target', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const chest = {
    i: 6,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 7,
    reachable: true,
    type: 'Chest',
    x: 100,
    y: 248,
  }

  assert.equal(resolveHeroProximityInteraction({ buildings: [chest], hero: makeHero() }), null)
})

test('hero proximity interaction opens any reachable fire camp as fire usage', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const fireCamp = {
    i: 6,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 7,
    owner: { label: 'other-player' },
    reachable: true,
    type: 'FireCamp',
    x: 100,
    y: 248,
  }

  assert.deepEqual(resolveHeroProximityInteraction({ hero: makeHero(), openEntityTarget: fireCamp }), {
    action: 'open',
    labelKey: 'heroInteractionUseFire',
    target: fireCamp,
  })
})

test('hero proximity interaction still opens fire camp usage when a hostile is in hero sight', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const enemyOwner = { label: 'enemy-player' }
  const heroOwner = { label: 'hero-player', isEnemy: owner => owner === enemyOwner }
  const fireCamp = {
    i: 6,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 7,
    reachable: true,
    type: 'FireCamp',
    x: 100,
    y: 248,
  }
  const hostile = { family: 'unit', isDead: false, isDestroyed: false, owner: enemyOwner }

  assert.deepEqual(
    resolveHeroProximityInteraction({
      hero: makeHero({ hostilesInSight: [hostile], owner: heroOwner }),
      openEntityTarget: fireCamp,
    }),
    {
      action: 'open',
      labelKey: 'heroInteractionUseFire',
      target: fireCamp,
    }
  )
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

test('hero proximity interaction resolves a nearby tamed horse as mount', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const hero = makeHero({ y: 100 })
  const horse = {
    family: 'animal',
    i: 6,
    isDead: false,
    isDestroyed: false,
    j: 8,
    tamingStatus: 'tamed',
    type: 'Horse',
    x: 104,
    y: 100,
  }
  hero.context.map.grid[6][8].has = horse

  assert.deepEqual(resolveHeroProximityInteraction({ hero }), {
    action: 'mount',
    labelKey: 'heroInteractionMount',
    target: horse,
  })
})

test('hero proximity interaction labels a foreign stable horse as theft', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const spaceId = 'interior:foreign-stable'
  const hero = makeHero({ owner: { label: 'player' }, y: 100 })
  hero.context.map.spaces = new Map([
    [spaceId, { building: { owner: { label: 'neutral-ai' }, type: 'Stable' }, kind: 'interior' }],
  ])
  const horse = {
    family: 'animal',
    i: 6,
    isDead: false,
    isDestroyed: false,
    j: 8,
    spaceId,
    tamingStatus: 'tamed',
    type: 'Horse',
    x: 104,
    y: 100,
  }
  hero.context.map.grid[6][8].has = horse

  assert.deepEqual(resolveHeroProximityInteraction({ hero }), {
    action: 'mount',
    labelKey: 'heroInteractionSteal',
    target: horse,
  })
})

test('hero proximity interaction ignores a nearby wild horse for mounting', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const hero = makeHero({ y: 100 })
  hero.context.map.grid[6][8].has = {
    family: 'animal',
    i: 6,
    isDead: false,
    isDestroyed: false,
    j: 8,
    tamingStatus: 'wild',
    type: 'Horse',
    x: 104,
    y: 100,
  }

  assert.equal(resolveHeroProximityInteraction({ hero }), null)
})

test('mounted hero ignores a tamed horse inside a stable interior', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const spaceId = 'interior:stable-1'
  const stable = { type: 'Stable' }
  const hero = makeHero({
    mountedOnHorse: true,
    y: 100,
  })
  hero.context.map.spaces = new Map([[spaceId, { building: stable, kind: 'interior' }]])
  const horse = {
    family: 'animal',
    i: 6,
    isDead: false,
    isDestroyed: false,
    j: 8,
    spaceId,
    tamingStatus: 'tamed',
    type: 'Horse',
    x: 104,
    y: 100,
  }
  hero.context.map.grid[6][8].has = horse

  assert.equal(resolveHeroProximityInteraction({ hero }), null)
})

test('hero proximity interaction resolves a facing openable corpse as open', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const nearCorpse = { currentSheet: 'corpseSheet', family: 'unit', isDead: true, type: 'Scout', x: 105, y: 100 }
  const hero = makeHero({
    y: 100,
  })

  assert.deepEqual(resolveHeroProximityInteraction({ hero, openEntityTarget: nearCorpse }), {
    action: 'open',
    labelKey: 'heroInteractionOpen',
    target: nearCorpse,
  })
})

test('hero proximity interaction ignores a nearby corpse that is not the facing target', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const corpse = { currentSheet: 'corpseSheet', family: 'unit', isDead: true, type: 'Scout', x: 105, y: 100 }
  const hero = makeHero({
    context: { map: { grid: [[{ corpses: new Set([corpse]) }]] } },
    y: 100,
  })

  assert.equal(resolveHeroProximityInteraction({ hero }), null)
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

test('hero proximity interaction uses rest chatter for own villagers resting before bed', () => {
  const { resolveHeroProximityInteraction } = loadHeroProximityInteractions()
  const owner = { isPlayed: true }
  const npc = {
    context: { dayNight: { state: { hour: 19 } } },
    family: 'unit',
    isDead: false,
    isDestroyed: false,
    owner,
    shelterState: { status: 'outside', reason: 'sleep', location: 'outside' },
    sleepVisualState: null,
    talkable: true,
    type: 'Villager',
    x: 100,
    y: 90,
  }
  const hero = makeHero({ isChief: false, owner, y: 100 })

  assert.deepEqual(resolveHeroProximityInteraction({ hero, openEntityTarget: npc }), {
    action: 'communicate',
    labelKey: 'heroInteractionCommunicate',
    npcOptions: { chatterLine: 'resting chatter', ordersEnabled: false },
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
