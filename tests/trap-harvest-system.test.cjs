const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadTrapHarvestSystem({ deferFade = false } = {}) {
  const filename = path.join(__dirname, '../app/services/world/TrapHarvestSystem.ts')
  const overheadCalls = []
  const soundCalls = []
  const pendingFades = []
  const module = requireFromTsFile(filename, filename, {
    '../constants': {
      BUILDING_TYPES: { trap: 'Trap' },
      SHEET_TYPES: { corpse: 'corpse' },
    },
    '../lib/audio/sound': {
      playAudibleSoundCue: (...args) => soundCalls.push(args),
    },
    '../lib': {
      updateInstanceVisibility: animal => {
        animal.visibilityUpdated = true
      },
    },
    '../lib/entities/entityFade': {
      fadeOut: (_entity, _duration, onComplete) => {
        if (deferFade) pendingFades.push(onComplete)
        else onComplete?.()
      },
    },
    '../lib/entities/overheadIndicator': {
      clearEntityOverheadIndicator: (entity, options) => {
        overheadCalls.push({ entity, options, type: null })
      },
      setEntityOverheadIndicator: (entity, type) => {
        overheadCalls.push({ entity, type })
      },
    },
  })
  module.__overheadCalls = overheadCalls
  module.__soundCalls = soundCalls
  module.__pendingFades = pendingFades
  return module
}

function createGrid(size) {
  return Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => ({
      i,
      j,
      spaceId: 'outside',
      category: 'Grass',
      border: false,
      waterBorder: false,
      corpses: new Set(),
      has: null,
      solid: false,
      updateVisible() {},
    }))
  )
}

function createContext() {
  const visionChangeListeners = new Set()
  const animals = []
  const grid = createGrid(5)
  const map = {
    grid,
    gaia: {
      animals,
      createAnimal(options) {
        const animal = { family: 'animal', quantity: 10, ...options }
        const cell = grid[options.i]?.[options.j]
        if (cell) {
          cell.has = animal
          cell.solid = true
        }
        animals.push(animal)
        return animal
      },
    },
    removeFromInstanceBucket(entity) {
      entity.removedFromBucket = true
    },
    random: () => 0,
    randomItem: items => items[0],
  }
  const trap = {
    context: { map },
    family: 'building',
    i: 2,
    j: 2,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    label: 'trap',
    spaceId: 'outside',
    type: 'Trap',
    zIndex: 20,
    clear() {
      this.isDestroyed = true
    },
  }
  const hero = { type: 'Hero', inventory: { equipment: [] } }
  const owner = {
    age: 0,
    config: { buildings: { Trap: { cost: { wood: 5, fiber: 2 } } } },
    buildings: [trap],
    label: 'player',
    selectedBuilding: null,
    team: 1,
    unselectAll() {},
  }
  owner.views = {
    getViewers: () => new Set([trap]),
    isVisible: () => true,
  }
  const menu = {
    isMiniMapActive: () => true,
    updatePlayerMiniMapEvt() {},
    updateResourcesMiniMap() {},
  }
  trap.owner = owner
  grid[trap.i][trap.j].has = trap
  grid[trap.i][trap.j].solid = true
  trap.context = {
    map,
    menu,
    player: owner,
  }
  return {
    context: {
      map,
      menu,
      player: owner,
      players: [owner],
      controls: { heroUnit: hero },
      notifyVisionChange(event) {
        for (const listener of visionChangeListeners) listener(event)
      },
      onVisionChange(callback) {
        visionChangeListeners.add(callback)
        return () => visionChangeListeners.delete(callback)
      },
      scheduler: {
        add() {
          throw new Error('trap indicator visibility should not be polled')
        },
      },
    },
    hero,
    trap,
  }
}

test('daily trap harvest stores prey in an empty fogged trap without spawning it or showing a marker', () => {
  const TrapHarvestSystem = loadTrapHarvestSystem()
  const { context, trap } = createContext()

  new TrapHarvestSystem.TrapHarvestSystem(context).fillTraps()

  assert.equal(trap.containedAnimalType, 'Hare')
  assert.equal(context.map.gaia.animals.length, 0)
  assert.equal(
    TrapHarvestSystem.__overheadCalls.some(call => call.type === 'question'),
    false
  )
})

test('daily trap harvest does not refill a trap that already contains prey', () => {
  const TrapHarvestSystem = loadTrapHarvestSystem()
  const { context, trap } = createContext()
  trap.containedAnimalType = 'Fox'

  new TrapHarvestSystem.TrapHarvestSystem(context).fillTraps()

  assert.equal(trap.containedAnimalType, 'Fox')
  assert.equal(context.map.gaia.animals.length, 0)
})

test('trap harvest shows the overhead marker for a filled trap visible to the same team', () => {
  const TrapHarvestSystem = loadTrapHarvestSystem()
  const { context, trap } = createContext()
  const scout = {
    family: 'unit',
    isDead: false,
    isDestroyed: false,
    label: 'scout',
  }
  trap.owner.views.getViewers = () => new Set([scout])
  trap.containedAnimalType = 'BlackGrouse'

  new TrapHarvestSystem.TrapHarvestSystem(context)

  assert.equal(TrapHarvestSystem.__overheadCalls.at(-1).type, 'question')
})

test('trap harvest updates the marker when vision changes', () => {
  const TrapHarvestSystem = loadTrapHarvestSystem()
  const { context, trap } = createContext()
  const scout = {
    family: 'unit',
    isDead: false,
    isDestroyed: false,
    label: 'scout',
  }
  trap.containedAnimalType = 'BlackGrouse'

  const system = new TrapHarvestSystem.TrapHarvestSystem(context)

  assert.equal(
    TrapHarvestSystem.__overheadCalls.some(call => call.type === 'question'),
    false
  )

  trap.owner.views.getViewers = () => new Set([scout])
  context.notifyVisionChange({ i: trap.i, j: trap.j, player: trap.owner })

  assert.equal(TrapHarvestSystem.__overheadCalls.at(-1).type, 'question')
  system.destroy()
})

test('trap harvest unsubscribes from vision changes when destroyed', () => {
  const TrapHarvestSystem = loadTrapHarvestSystem()
  const { context, trap } = createContext()
  const scout = {
    family: 'unit',
    isDead: false,
    isDestroyed: false,
    label: 'scout',
  }
  trap.containedAnimalType = 'BlackGrouse'
  const system = new TrapHarvestSystem.TrapHarvestSystem(context)

  system.destroy()
  trap.owner.views.getViewers = () => new Set([scout])
  context.notifyVisionChange({ i: trap.i, j: trap.j, player: trap.owner })

  assert.equal(
    TrapHarvestSystem.__overheadCalls.some(call => call.type === 'question'),
    false
  )
})

test('trap harvest shows the overhead marker for a visible foreign trap', () => {
  const TrapHarvestSystem = loadTrapHarvestSystem()
  const { context, trap } = createContext()
  const activePlayer = {
    buildings: [],
    label: 'active-player',
    team: 1,
    views: {
      getViewers: () =>
        new Set([
          {
            family: 'unit',
            isDead: false,
            isDestroyed: false,
            label: 'active-scout',
          },
        ]),
      isVisible: () => true,
    },
  }
  const foreignOwner = {
    age: 0,
    config: { buildings: { Trap: { cost: { wood: 5, fiber: 2 } } } },
    buildings: [trap],
    label: 'foreign-player',
    team: 2,
    views: {
      getViewers: () => new Set([trap]),
      isVisible: () => true,
    },
  }
  trap.owner = foreignOwner
  trap.context.player = activePlayer
  context.player = activePlayer
  context.players = [activePlayer, foreignOwner]
  trap.containedAnimalType = 'Hare'

  new TrapHarvestSystem.TrapHarvestSystem(context)

  assert.equal(TrapHarvestSystem.__overheadCalls.at(-1).type, 'question')
})

test('daily trap harvest skips a trap visible from another unit or building sight', () => {
  const TrapHarvestSystem = loadTrapHarvestSystem()
  const { context, trap } = createContext()
  const scout = {
    family: 'unit',
    isDead: false,
    isDestroyed: false,
    label: 'scout',
  }
  trap.owner.views.getViewers = () => new Set([trap, scout])

  new TrapHarvestSystem.TrapHarvestSystem(context).fillTraps()

  assert.equal(trap.containedAnimalType, undefined)
  assert.equal(context.map.gaia.animals.length, 0)
  assert.equal(
    TrapHarvestSystem.__overheadCalls.some(call => call.type === 'question'),
    false
  )
})

for (const filled of [false, true]) {
  test(`dismantling a ${filled ? 'filled' : 'empty'} trap consumes it once without refunds`, () => {
    const { dismantleTrapBuilding, TrapHarvestSystem, __pendingFades, __soundCalls } = loadTrapHarvestSystem({
      deferFade: true,
    })
    const { context, hero, trap } = createContext()
    if (filled) trap.containedAnimalType = 'Fox'
    hero.inventory.resources = { wood: 50 }
    // No adjacent free space is required.
    context.map.grid.flat().forEach(cell => {
      cell.solid = true
    })
    assert.equal(dismantleTrapBuilding(hero, trap), true)
    assert.equal(trap.owner.buildings.includes(trap), false)
    assert.equal(trap.isDead, true)
    assert.equal(trap.containedAnimalType, null)
    assert.deepEqual(hero.inventory, { equipment: [], resources: { wood: 50 } })
    const cell = context.map.grid[2][2]
    if (filled) {
      const animal = context.map.gaia.animals[0]
      assert.equal(animal.type, 'Fox')
      assert.equal(animal.isDead, true)
      assert.equal(animal.trapPrey, true)
      assert.equal(animal.i, trap.i)
      assert.equal(animal.j, trap.j)
      assert.equal(cell.has, animal)
    } else assert.equal(cell.has, null)
    for (let i = 0; i < 10; i++) assert.equal(dismantleTrapBuilding(hero, trap), false)
    assert.equal(__soundCalls.length, 1)
    assert.equal(__pendingFades.length, 1)
    new TrapHarvestSystem(context).fillTraps()
    assert.equal(trap.containedAnimalType, null)
    const occupant = cell.has
    __pendingFades[0]()
    assert.equal(trap.isDestroyed, true)
    assert.equal(cell.has, occupant)
    assert.equal(context.map.gaia.animals.length, filled ? 1 : 0)
  })
}

test('unavailable prey spawning keeps a filled trap intact', () => {
  const { dismantleTrapBuilding } = loadTrapHarvestSystem()
  const { context, hero, trap } = createContext()
  trap.containedAnimalType = 'Fox'
  context.map.gaia.createAnimal = undefined
  assert.equal(dismantleTrapBuilding(hero, trap), false)
  assert.equal(trap.isDead, false)
  assert.equal(trap.containedAnimalType, 'Fox')
})
