const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadTrapHarvestSystem() {
  const filename = path.join(__dirname, '../app/services/world/TrapHarvestSystem.ts')
  const overheadCalls = []
  const module = requireFromTsFile(filename, filename, {
    '../constants': {
      BUILDING_TYPES: { trap: 'Trap' },
      SHEET_TYPES: { corpse: 'corpse' },
    },
    '../lib': {
      updateInstanceVisibility: animal => {
        animal.visibilityUpdated = true
      },
    },
    '../lib/equipment/equipmentLoot': {
      addHeroInventoryItem: (hero, item) => {
        hero.inventory = hero.inventory ?? { equipment: [] }
        hero.inventory.equipment = hero.inventory.equipment ?? []
        hero.inventory.equipment.push(item)
        return true
      },
    },
    '../lib/entities/entityFade': {
      fadeOut: (_entity, _duration, onComplete) => onComplete?.(),
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
  const hero = { inventory: { equipment: [] } }
  const owner = {
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

test('recovering a filled trap returns the trap and spawns a gatherable dead prey', () => {
  const { recoverTrapBuilding } = loadTrapHarvestSystem()
  const { context, hero, trap } = createContext()
  trap.containedAnimalType = 'Fox'

  assert.equal(recoverTrapBuilding(hero, trap), true)

  const trapCell = context.map.grid[trap.i][trap.j]
  assert.equal(hero.inventory.equipment.includes('trap'), true)
  assert.equal(trap.owner.buildings.includes(trap), false)
  assert.equal(trap.isDestroyed, true)
  assert.equal(trapCell.solid, true)
  assert.equal(context.map.gaia.animals.length, 1)
  const animal = context.map.gaia.animals[0]
  assert.equal(animal.currentSheet, 'corpse')
  assert.equal(animal.family, 'animal')
  assert.equal(animal.hitPoints, 0)
  assert.equal(animal.i, 2)
  assert.equal(animal.isDead, true)
  assert.equal(animal.j, 2)
  assert.equal(animal.quantity, 10)
  assert.equal(animal.spaceId, 'outside')
  assert.equal(animal.trapPrey, true)
  assert.equal(animal.type, 'Fox')
  assert.equal(animal.visibilityUpdated, true)
  assert.equal(trapCell.has, animal)
})
