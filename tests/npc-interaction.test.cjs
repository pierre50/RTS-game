const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadModule(relativePath, mocks) {
  const defaultMocks = {
    './graphics/selection': {
      createIsoSelectionMarker: options => ({ ...options, label: options.label, position: { y: 0 } }),
      drawCellBlinkingSelection: () => {},
      drawInstanceBlinkingSelection: () => {},
      getSelectionMarkerOffset: () => 0,
    },
    './audio/sound': {
      playAudibleSoundCue: () => {},
      playSelectionSound: () => {},
      playSoundCue: () => {},
    },
    './combat/combat': {
      isValidCondition: () => true,
    },
    './lang': {
      t: key => key,
    },
    '../entities/overheadIndicator': {
      clearUnitOverheadIndicator: unit => unit.context?.calls?.push(['clearIndicator', unit.label]),
      setUnitOverheadIndicator: (unit, type) => unit.context?.calls?.push(['indicator', unit.label, type]),
    },
    '../units/villagerSchedule': {
      isVillagerSleepTime: context => {
        const hour = context?.dayNight?.state?.hour ?? 12
        return hour >= 18 || hour < 8
      },
      shouldVillagerRestBeforeBed: unit => {
        const hour = unit?.context?.dayNight?.state?.hour ?? 12
        return hour >= 18 && hour < 22
      },
    },
    '../../services/rest/UnitRestRules': {
      delayUnitRestAfterActivity: unit => {
        const hour = unit.context?.dayNight?.state?.hour ?? 12
        if (hour < 18 && hour >= 8) return false
        const now = unit.context?.scheduler?.elapsedMs ?? 0
        unit.restWakeLockUntilMs = Math.max(unit.restWakeLockUntilMs ?? 0, now + 12000)
        unit.restAlertTargetLabel = null
        return true
      },
      isSleepTime: context => {
        const hour = context?.dayNight?.state?.hour ?? 12
        return hour >= 18 || hour < 8
      },
    },
    '../grid/movement': {
      getFreeLandCellAroundInstance: (instance, grid, pick) => {
        const cells = [
          grid[instance.i - 1]?.[instance.j],
          grid[instance.i]?.[instance.j - 1],
          grid[instance.i + 1]?.[instance.j],
          grid[instance.i]?.[instance.j + 1],
        ].filter(Boolean)
        return pick(cells)
      },
    },
    './units/unitCrouchPose': {
      applyUnitCrouchPose: () => {},
      resetUnitCrouchPose: () => {},
    },
  }
  return loadTsModule(relativePath, { mocks: { ...defaultMocks, ...mocks } })
}

const constants = {
  ACTION_TYPES: {
    attack: 'attack',
    build: 'build',
    captureHorse: 'captureHorse',
    chopwood: 'chopwood',
    convert: 'convert',
    farm: 'farm',
    forageberry: 'forageberry',
    heal: 'heal',
    hunt: 'hunt',
    minegold: 'minegold',
    minestone: 'minestone',
    takemeat: 'takemeat',
    train: 'train',
  },
  FAMILY_TYPES: {
    animal: 'animal',
    building: 'building',
    resource: 'resource',
    unit: 'unit',
  },
  BUILDING_TYPES: {
    temple: 'Temple',
  },
  RESOURCE_TYPES: {
    berrybush: 'Berrybush',
    fiberPlant: 'FiberPlant',
    gold: 'Gold',
    medicinalHerb: 'MedicinalHerb',
    stone: 'Stone',
    toxicHerb: 'ToxicHerb',
    tree: 'Tree',
    wheat: 'Wheat',
  },
  TYPE_ACTION: {
    Berrybush: 'forageberry',
    FiberPlant: 'forageberry',
    Gold: 'minegold',
    MedicinalHerb: 'forageberry',
    Stone: 'minestone',
    ToxicHerb: 'forageberry',
    Tree: 'chopwood',
    Wheat: 'farm',
  },
  COLOR_WHITE: 0xffffff,
  CELL_WIDTH: 64,
  LABEL_TYPES: {
    commSelection: 'commSelection',
    shadow: 'shadow',
  },
  SHEET_TYPES: {
    standing: 'standing',
  },
  SOUND_CUES: {
    unit: { militaryCommand: 'militaryCommand' },
    villager: { command: 'villagerCommand' },
  },
  PLAYER_TYPES: {
    ai: 'AI',
  },
  UNIT_TYPES: {
    bowman: 'Bowman',
    infantry: 'Fantassin',
    priest: 'Priest',
    villager: 'Villager',
  },
  WORK_TYPES: {
    farmer: 'farmer',
    forager: 'forager',
    hunter: 'hunter',
    woodcutter: 'woodcutter',
  },
}

function angleDelta(a, b) {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

function loadNpcInteraction(target, overrides = {}) {
  return loadModule('app/lib/npc/npcInteraction.ts', {
    '../constants': constants,
    './grid/visibility': {
      findInstancesInSight: () => (target ? [target] : []),
    },
    './maths': {
      angleDelta,
      getInstanceDegree: () => 0,
    },
    ...overrides,
  })
}

function createNpcTestGrid(size, spaceId = undefined) {
  return Array.from({ length: size + 1 }, (_, i) =>
    Array.from({ length: size + 1 }, (_, j) => ({
      category: null,
      corpses: new Set(),
      has: null,
      i,
      j,
      solid: false,
      spaceId,
      x: i,
      y: j,
    }))
  )
}

test('"aller vers" sends villagers to attack an enemy under the cursor', () => {
  const enemyOwner = { label: 'enemy' }
  const target = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    i: 5,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner: enemyOwner,
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const calls = []
  const npc = {
    context: { map: { grid: [] } },
    getActionCondition: orderTarget => orderTarget === target,
    i: 1,
    j: 1,
    owner: { isEnemy: owner => owner === enemyOwner },
    sendToAttack: orderTarget => calls.push(['attack', orderTarget]),
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['attack', target]])
})

test('"aller vers" keeps empty go-to targets inside the clicked runtime map space', () => {
  const outsideGrid = createNpcTestGrid(6)
  const interiorGrid = createNpcTestGrid(6, 'interior:house')
  const interiorCell = interiorGrid[4][4]
  const outsideCellAtSameCoords = outsideGrid[4][4]
  const map = {
    grid: outsideGrid,
    size: 6,
    spaces: new Map([
      [
        'interior:house',
        {
          container: {},
          grid: interiorGrid,
          id: 'interior:house',
          kind: 'interior',
          origin: { x: 100, y: 50 },
          size: 6,
        },
      ],
    ]),
  }
  const calls = []
  const npc = {
    context: { map },
    i: 2,
    j: 2,
    owner: {},
    sendTo: orderCell => calls.push(orderCell),
    spaceId: 'interior:house',
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(null)

  sendNpcGroupToTarget([npc], interiorCell, { x: 4, y: 4 })

  assert.deepEqual(calls, [interiorCell])
  assert.notEqual(calls[0], outsideCellAtSameCoords)
})

test('"aller vers" on a building entry routes the npc inside instead of stopping on the door', () => {
  const grid = createNpcTestGrid(6)
  const entryCell = grid[4][4]
  const calls = []
  const npc = {
    context: {
      map: { grid },
      getBuildingInteriorEntryTargetForCell: cell => {
        calls.push(['resolve-entry', cell])
        return { label: 'house-1' }
      },
      routeUnitIntoBuildingInterior: (unit, building) => {
        calls.push(['enter', unit.label, building.label])
        return true
      },
    },
    i: 2,
    j: 2,
    label: 'npc-1',
    owner: {},
    sendTo: orderCell => calls.push(['move', orderCell]),
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(null)

  sendNpcGroupToTarget([npc], entryCell, { x: 4, y: 4 })

  assert.deepEqual(calls, [
    ['resolve-entry', entryCell],
    ['enter', 'npc-1', 'house-1'],
  ])
})

test('"aller vers" on a building entry blinks the entry cell', () => {
  const grid = createNpcTestGrid(6)
  const entryCell = grid[4][4]
  const blinkCalls = []
  const npc = {
    context: {
      map: { grid },
      getBuildingInteriorEntryTargetForCell: () => ({ label: 'house-1' }),
      routeUnitIntoBuildingInterior: () => true,
    },
    i: 2,
    j: 2,
    label: 'npc-1',
    owner: {},
    sendTo: () => {},
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(null, {
    './graphics/selection': {
      createIsoSelectionMarker: options => ({ ...options, label: options.label, position: { y: 0 } }),
      drawCellBlinkingSelection: cell => blinkCalls.push(cell),
      drawInstanceBlinkingSelection: () => {},
      getSelectionMarkerOffset: () => 0,
    },
  })

  sendNpcGroupToTarget([npc], entryCell, { x: 4, y: 4 })

  assert.deepEqual(blinkCalls, [entryCell])
})

test('"aller vers" on a building entry does not blink when no selected npc can enter', () => {
  const grid = createNpcTestGrid(6)
  const entryCell = grid[4][4]
  const blinkCalls = []
  const moveCalls = []
  const npc = {
    context: {
      map: { grid },
      getBuildingInteriorEntryTargetForCell: () => ({ label: 'house-1' }),
      routeUnitIntoBuildingInterior: () => false,
    },
    i: 2,
    j: 2,
    label: 'npc-1',
    owner: {},
    sendTo: cell => moveCalls.push(cell),
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(null, {
    './graphics/selection': {
      createIsoSelectionMarker: options => ({ ...options, label: options.label, position: { y: 0 } }),
      drawCellBlinkingSelection: cell => blinkCalls.push(cell),
      drawInstanceBlinkingSelection: () => {},
      getSelectionMarkerOffset: () => 0,
    },
  })

  sendNpcGroupToTarget([npc], entryCell, { x: 4, y: 4 })

  assert.deepEqual(moveCalls, [entryCell])
  assert.deepEqual(blinkCalls, [])
})

test('"aller vers" does not reset npc activity before knowing the cell is a building entry', () => {
  const grid = createNpcTestGrid(6)
  const targetCell = grid[4][4]
  const calls = []
  const npc = {
    context: {
      dayNight: { state: { hour: 23 } },
      getBuildingInteriorEntryTargetForCell: cell => {
        calls.push(['resolve-entry', cell])
        return null
      },
      map: { grid },
      routeUnitIntoBuildingInterior: () => {
        calls.push(['enter'])
        return true
      },
      scheduler: { elapsedMs: 2000 },
    },
    i: 2,
    j: 2,
    owner: {},
    sendTo: orderCell => calls.push(['move', orderCell]),
    type: constants.UNIT_TYPES.villager,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(null)

  sendNpcGroupToTarget([npc], targetCell, { x: 4, y: 4 })

  assert.deepEqual(calls, [
    ['resolve-entry', targetCell],
    ['move', targetCell],
  ])
  assert.equal(npc.restWakeLockUntilMs, 14000)
})

test('"aller vers" delays night rest after an empty go-to order', () => {
  const grid = createNpcTestGrid(6)
  const targetCell = grid[4][4]
  const calls = []
  const npc = {
    context: {
      dayNight: { state: { hour: 23 } },
      map: { grid },
      scheduler: { elapsedMs: 2000 },
    },
    i: 2,
    j: 2,
    owner: {},
    sendTo: orderCell => calls.push(orderCell),
    type: constants.UNIT_TYPES.villager,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(null)

  sendNpcGroupToTarget([npc], targetCell, { x: 4, y: 4 })

  assert.deepEqual(calls, [targetCell])
  assert.equal(npc.restWakeLockUntilMs, 14000)
})

test('"aller vers" blinks the target once when any communicated NPC has a targeted action', () => {
  const enemyOwner = { label: 'enemy' }
  const target = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    i: 5,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner: enemyOwner,
    x: 100,
    y: 100,
  }
  const blinkCalls = []
  const { sendNpcGroupToTarget } = loadNpcInteraction(target, {
    './graphics/selection': {
      createIsoSelectionMarker: options => ({ ...options, label: options.label, position: { y: 0 } }),
      drawInstanceBlinkingSelection: instance => blinkCalls.push(instance),
    },
  })
  const calls = []
  const owner = { isEnemy: owner => owner === enemyOwner }
  const attacker = {
    context: { map: { grid: [] } },
    getActionCondition: (orderTarget, action) => orderTarget === target && action === constants.ACTION_TYPES.attack,
    i: 1,
    j: 1,
    owner,
    sendToAttack: orderTarget => calls.push(['attack', orderTarget]),
  }
  const mover = {
    context: { map: { grid: [] } },
    getActionCondition: () => false,
    i: 2,
    j: 2,
    owner,
    sendTo: orderCell => calls.push(['move', orderCell]),
  }

  sendNpcGroupToTarget([attacker, mover], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [
    ['attack', target],
    ['move', { i: 5, j: 5, has: target }],
  ])
  assert.deepEqual(blinkCalls, [target])
})

test('"aller vers" does not blink a target when selected npcs only move toward it', () => {
  const grid = createNpcTestGrid(6)
  const targetCell = grid[4][4]
  const target = {
    family: constants.FAMILY_TYPES.resource,
    i: 4,
    isDead: false,
    isDestroyed: false,
    j: 4,
    type: constants.RESOURCE_TYPES.tree,
    x: 100,
    y: 100,
  }
  targetCell.has = target
  const blinkCalls = []
  const moveCalls = []
  const { sendNpcGroupToTarget } = loadNpcInteraction(target, {
    './graphics/selection': {
      createIsoSelectionMarker: options => ({ ...options, label: options.label, position: { y: 0 } }),
      drawCellBlinkingSelection: () => {},
      drawInstanceBlinkingSelection: instance => blinkCalls.push(instance),
      getSelectionMarkerOffset: () => 0,
    },
  })
  const infantry = {
    context: { map: { grid } },
    getActionCondition: () => false,
    i: 2,
    j: 2,
    owner: {},
    sendTo: cell => moveCalls.push(cell),
    type: constants.UNIT_TYPES.infantry,
  }

  sendNpcGroupToTarget([infantry], targetCell, { x: 100, y: 100 })

  assert.deepEqual(moveCalls, [targetCell])
  assert.deepEqual(blinkCalls, [])
})

test('"aller vers" sends villagers to hunt a live animal under the cursor', () => {
  const target = {
    family: constants.FAMILY_TYPES.animal,
    hitPoints: 8,
    i: 5,
    isDead: false,
    isDestroyed: false,
    j: 5,
    quantity: 100,
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const calls = []
  const npc = {
    context: { map: { grid: [] } },
    getActionCondition: (orderTarget, action) => orderTarget === target && action === constants.ACTION_TYPES.hunt,
    i: 1,
    j: 1,
    owner: { isEnemy: () => false },
    sendToHunt: orderTarget => calls.push(['hunt', orderTarget]),
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['hunt', target]])
})

test('"aller vers" sends a communicated villager to a training building without starting training', () => {
  const owner = {
    config: {
      units: {
        Fantassin: { category: 'Fantassin' },
      },
    },
  }
  const target = {
    family: constants.FAMILY_TYPES.building,
    i: 5,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner,
    type: 'Barracks',
    units: ['Fantassin'],
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const calls = []
  const npc = {
    context: { map: { grid: [] } },
    i: 1,
    j: 1,
    owner,
    sendToEvt(orderTarget, action, options) {
      calls.push(['move', orderTarget, action, options])
    },
    type: constants.UNIT_TYPES.villager,
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.equal(npc.trainingTargetType, undefined)
  assert.deepEqual(calls, [['move', target, null, { allowPassageStop: true }]])
})

test('"aller vers" sends a resource-carrying villager beside a storage building without delivering', () => {
  const owner = { label: 'player' }
  const target = {
    family: constants.FAMILY_TYPES.building,
    i: 5,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner,
    type: 'StoragePit',
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const calls = []
  const npc = {
    context: { map: { grid: [] } },
    getActionCondition: (orderTarget, action) => orderTarget === target && action === constants.ACTION_TYPES.delivery,
    i: 1,
    inventory: { resources: { wood: 5 } },
    j: 1,
    owner,
    sendToDelivery: orderTarget => calls.push(['delivery', orderTarget]),
    sendToEvt(orderTarget, action, options) {
      npc.dest = orderTarget
      npc.action = action
      calls.push(['move', orderTarget, action, options])
    },
    type: constants.UNIT_TYPES.villager,
    work: 'woodcutter',
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.equal(npc.action, null)
  assert.equal(npc.dest, target)
  assert.deepEqual(calls, [['move', target, null, { allowPassageStop: true }]])
})

test('"aller vers" sends a communicated villager to harvest wheat', () => {
  const owner = { label: 'player' }
  const target = {
    family: constants.FAMILY_TYPES.resource,
    i: 5,
    isDead: false,
    isDestroyed: false,
    isUsedBy: null,
    j: 5,
    quantity: 10,
    type: constants.RESOURCE_TYPES.wheat,
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const calls = []
  const npc = {
    context: { map: { grid: [] } },
    getActionCondition: (orderTarget, action) => orderTarget === target && action === constants.ACTION_TYPES.farm,
    i: 1,
    j: 1,
    label: 'villager-1',
    owner,
    sendToFarm: orderTarget => calls.push(['farm', orderTarget]),
    type: constants.UNIT_TYPES.villager,
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['farm', target]])
})

test('"aller vers" sends a communicated villager to harvest wildgrass plants', () => {
  const owner = { label: 'player' }
  const target = {
    family: constants.FAMILY_TYPES.resource,
    i: 5,
    isDead: false,
    isDestroyed: false,
    j: 5,
    quantity: 2,
    type: constants.RESOURCE_TYPES.medicinalHerb,
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const calls = []
  const npc = {
    context: { map: { grid: [] } },
    getActionCondition: (orderTarget, action) =>
      orderTarget === target && action === constants.ACTION_TYPES.forageberry,
    i: 1,
    j: 1,
    label: 'villager-1',
    owner,
    sendToBerrybush: orderTarget => calls.push(['forage', orderTarget]),
    type: constants.UNIT_TYPES.villager,
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['forage', target]])
})

test('"aller vers" refuses night resource work without moving villagers', () => {
  const owner = { label: 'player' }
  const grid = createNpcTestGrid(6)
  const target = {
    family: constants.FAMILY_TYPES.resource,
    i: 5,
    isDead: false,
    isDestroyed: false,
    j: 5,
    label: 'wheat-1',
    quantity: 10,
    type: constants.RESOURCE_TYPES.wheat,
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const calls = []
  const npc = {
    context: {
      calls,
      dayNight: { state: { hour: 23 } },
      map: { grid },
      scheduler: {
        elapsedMs: 3000,
        add(callback, interval, name) {
          calls.push(['schedule', interval, name])
          callback()
          return 1
        },
      },
    },
    getActionCondition: (orderTarget, action) => orderTarget === target && action === constants.ACTION_TYPES.farm,
    i: 1,
    j: 1,
    label: 'villager-1',
    owner,
    sendTo: orderCell => calls.push(['move', orderCell]),
    sendToFarm: orderTarget => calls.push(['farm', orderTarget]),
    type: constants.UNIT_TYPES.villager,
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.equal(npc.restWakeLockUntilMs, 15000)
  assert.deepEqual(calls, [
    ['indicator', 'villager-1', 'sleep'],
    ['schedule', 1200, 'npc.nightWorkRefusal'],
    ['clearIndicator', 'villager-1'],
  ])
})

test('"aller vers" still lets villagers attack enemies at night', () => {
  const enemyOwner = { label: 'enemy' }
  const target = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    i: 5,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner: enemyOwner,
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const calls = []
  const npc = {
    context: {
      calls,
      dayNight: { state: { hour: 23 } },
      map: { grid: [] },
      scheduler: { elapsedMs: 4000 },
    },
    getActionCondition: (orderTarget, action) => orderTarget === target && action === constants.ACTION_TYPES.attack,
    i: 1,
    j: 1,
    owner: { isEnemy: owner => owner === enemyOwner },
    sendToAttack: orderTarget => calls.push(['attack', orderTarget]),
    type: constants.UNIT_TYPES.villager,
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.equal(npc.restWakeLockUntilMs, 16000)
  assert.deepEqual(calls, [['attack', target]])
})

test('"aller vers" sends a communicated villager to a temple instead of training', () => {
  const owner = {
    config: {
      units: {
        Priest: { category: 'Civilian' },
      },
    },
  }
  const target = {
    family: constants.FAMILY_TYPES.building,
    i: 5,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner,
    type: constants.BUILDING_TYPES.temple,
    units: [constants.UNIT_TYPES.priest],
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const calls = []
  const npc = {
    context: { map: { grid: [] } },
    i: 1,
    j: 1,
    owner,
    sendToEvt(orderTarget, action, options) {
      calls.push(['move', orderTarget, action, options])
    },
    type: constants.UNIT_TYPES.villager,
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['move', target, null, { allowPassageStop: true }]])
})

test('"aller vers" sends a villager to an incompatible own building', () => {
  const calls = []
  const owner = {
    config: {
      units: {},
    },
  }
  const target = {
    family: constants.FAMILY_TYPES.building,
    i: 5,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner,
    type: 'Stable',
    units: ['Fantassin'],
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const npc = {
    context: {
      map: { grid: [] },
      menu: {
        showMessage(message, type) {
          calls.push(['message', message, type])
        },
      },
    },
    i: 1,
    j: 1,
    owner,
    sendToEvt(orderTarget, action, options) {
      calls.push(['move', orderTarget, action, options])
    },
    type: constants.UNIT_TYPES.villager,
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['move', target, null, { allowPassageStop: true }]])
})

test('"aller vers" recognizes restored owner labels for own building goto', () => {
  const calls = []
  const owner = { label: 'player' }
  const target = {
    family: constants.FAMILY_TYPES.building,
    i: 5,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner: { label: 'player' },
    type: 'Barracks',
    units: ['Fantassin'],
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const npc = {
    context: { map: { grid: [] } },
    i: 1,
    j: 1,
    owner,
    sendToEvt(orderTarget, action, options) {
      calls.push(['move', orderTarget, action, options])
    },
    type: constants.UNIT_TYPES.villager,
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['move', target, null, { allowPassageStop: true }]])
})

test('"aller vers" sends specialized infantry to barracks when no upgrade is available', () => {
  const calls = []
  const owner = {
    config: {
      units: {
        Fantassin: { category: 'Fantassin' },
      },
    },
  }
  const target = {
    family: constants.FAMILY_TYPES.building,
    i: 5,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner,
    type: 'Barracks',
    units: ['Fantassin'],
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const npc = {
    context: {
      map: { grid: [] },
      menu: {
        showMessage(message, type) {
          calls.push(['message', message, type])
        },
      },
    },
    i: 1,
    j: 1,
    owner,
    sendToEvt(orderTarget, action, options) {
      calls.push(['move', orderTarget, action, options])
    },
    type: 'Fantassin',
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['move', target, null, { allowPassageStop: true }]])
})

test('"aller vers" sends a soldier to an empty stable', () => {
  const calls = []
  const owner = {
    config: {
      units: {
        Fantassin: { category: 'Fantassin' },
      },
    },
  }
  const target = {
    family: constants.FAMILY_TYPES.building,
    i: 5,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner,
    type: 'Stable',
    units: ['Fantassin'],
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const npc = {
    context: {
      map: { grid: [] },
      menu: {
        showMessage(message, type) {
          calls.push(['message', message, type])
        },
      },
    },
    i: 1,
    j: 1,
    owner,
    sendToEvt(orderTarget, action, options) {
      calls.push(['move', orderTarget, action, options])
    },
    type: 'Fantassin',
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['move', target, null, { allowPassageStop: true }]])
})

test('"aller vers" sends a bowman to the stable instead of mounting', () => {
  const calls = []
  const owner = {
    config: {
      units: {
        Bowman: { category: 'Bowman' },
      },
    },
  }
  const target = {
    family: constants.FAMILY_TYPES.building,
    i: 5,
    isBuilt: true,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner,
    type: 'Stable',
    units: ['Bowman'],
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const npc = {
    context: {
      map: { grid: [] },
      menu: {
        showMessage(message, type) {
          calls.push(['message', message, type])
        },
      },
    },
    i: 1,
    j: 1,
    owner,
    sendToEvt(orderTarget, action, options) {
      calls.push(['move', orderTarget, action, options])
    },
    type: 'Bowman',
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['move', target, null, { allowPassageStop: true }]])
})

test('closing communication resumes a pending training order', () => {
  const calls = []
  const barracks = {
    family: constants.FAMILY_TYPES.building,
    isDestroyed: false,
    type: 'Barracks',
  }
  const npc = {
    lookingAtHero: true,
    previousDest: barracks,
    trainingTargetType: 'Fantassin',
    getChildByLabel: () => null,
    sendTo(dest, action) {
      calls.push(['sendTo', dest, action])
    },
  }
  const { releaseIfStillLooking } = loadNpcInteraction(null)

  releaseIfStillLooking([npc])

  assert.equal(npc.lookingAtHero, false)
  assert.equal(npc.previousDest, null)
  assert.equal(npc.trainingTargetType, 'Fantassin')
  assert.deepEqual(calls, [['sendTo', barracks, constants.ACTION_TYPES.train]])
})

test('talking to your own sleeping unit wakes it for real, like their chief would', () => {
  const calls = []
  const owner = {}
  const target = {
    family: constants.FAMILY_TYPES.unit,
    getChildByLabel: () => null,
    addChildAt: () => {},
    context: {
      unitRest: {
        wakeSleepingUnitForOrder: unit => {
          calls.push(['wakeForOrder', unit.label])
          return true
        },
      },
    },
    i: 1,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'sleepy-villager',
    owner,
    shelterState: { status: 'outside', reason: 'sleep', location: 'outside' },
    sleepVisualState: 'sleeping',
    x: 32,
    y: 0,
  }
  const hero = {
    degree: 0,
    i: 0,
    j: 0,
    owner,
    x: 0,
    y: 0,
  }
  const { resolveCommGroup } = loadNpcInteraction(target)

  const group = resolveCommGroup(hero, 0, { precisionOnly: true })

  assert.deepEqual(group, [target])
  assert.equal(target.lookingAtHero, true)
  assert.deepEqual(calls, [['wakeForOrder', 'sleepy-villager']])
})

test('closing without an order after a real wake does not resume the old day job', () => {
  const calls = []
  const npc = {
    lookingAtHero: true,
    // Left over from before bedtime — sleep never clears this — and shelterState is already null
    // because the talk interaction already woke the unit for real.
    autonomousJob: 'wood',
    previousDest: null,
    shelterState: null,
    getChildByLabel: () => null,
    context: {
      unitRest: {
        isRestWakeLockActive: () => true,
      },
    },
    affectNewDest() {
      calls.push(['affectNewDest'])
    },
    goBackToPrevious() {
      calls.push(['goBackToPrevious'])
    },
  }
  const { releaseIfStillLooking } = loadNpcInteraction(null)

  releaseIfStillLooking([npc])

  assert.equal(npc.lookingAtHero, false)
  assert.equal(npc.previousDest, null)
  assert.deepEqual(calls, [])
})

test('"aller vers" cursor shows combat feedback only when a selected npc can attack the target', () => {
  const classes = new Set()
  global.document = {
    body: {
      classList: {
        add: className => classes.add(className),
        remove: (...classNames) => classNames.forEach(className => classes.delete(className)),
      },
      appendChild: () => {},
    },
    createElement: () => ({ classList: { add: () => {}, remove: () => {}, toggle: () => {} }, style: {} }),
  }

  try {
    const { resetHeroCursor, updateHeroCursor } = loadModule('app/lib/hero/heroCursor.ts', {
      '../constants': constants,
    })
    const { resolveNpcGoToCursorState } = loadModule('app/lib/npc/npcGoToCursor.ts', {
      '../constants': constants,
    })
    const target = { family: constants.FAMILY_TYPES.unit, hitPoints: 10, owner: { label: 'enemy' } }
    const npc = {
      getActionCondition: (candidate, action) => candidate === target && action === constants.ACTION_TYPES.attack,
    }

    updateHeroCursor(null, resolveNpcGoToCursorState([npc], target, null, null))

    assert.equal(classes.has('hero-cursor-combat'), true)
    resetHeroCursor()
  } finally {
    delete global.document
  }
})

test('"aller vers" cursor shows the resource hand over actionable building work', () => {
  const classes = new Set()
  global.document = {
    body: {
      classList: {
        add: className => classes.add(className),
        remove: (...classNames) => classNames.forEach(className => classes.delete(className)),
      },
      appendChild: () => {},
    },
    createElement: () => ({ classList: { add: () => {}, remove: () => {}, toggle: () => {} }, style: {} }),
  }

  try {
    const { resetHeroCursor, updateHeroCursor } = loadModule('app/lib/hero/heroCursor.ts', {
      '../constants': constants,
    })
    const { resolveNpcGoToCursorState } = loadModule('app/lib/npc/npcGoToCursor.ts', {
      '../constants': constants,
    })
    const target = { family: constants.FAMILY_TYPES.building, hitPoints: 25, isBuilt: false, owner: { label: 'own' } }
    const npc = {
      getActionCondition: (candidate, action) => candidate === target && action === constants.ACTION_TYPES.build,
    }

    updateHeroCursor(null, resolveNpcGoToCursorState([npc], target, null, null))

    assert.equal(classes.has('hero-cursor-resource'), true)
    resetHeroCursor()
  } finally {
    delete global.document
  }
})

test('"aller vers" cursor shows enter feedback over building interior entry cells', () => {
  const classes = new Set()
  const entryCell = { i: 4, j: 4 }
  global.document = {
    body: {
      classList: {
        add: className => classes.add(className),
        remove: (...classNames) => classNames.forEach(className => classes.delete(className)),
      },
      appendChild: () => {},
    },
    createElement: () => ({ classList: { add: () => {}, remove: () => {}, toggle: () => {} }, style: {} }),
  }

  try {
    const { resetHeroCursor, updateHeroCursor } = loadModule('app/lib/hero/heroCursor.ts', {
      '../constants': constants,
    })
    const { resolveNpcGoToCursorState } = loadModule('app/lib/npc/npcGoToCursor.ts', {
      '../constants': constants,
    })

    updateHeroCursor(
      null,
      resolveNpcGoToCursorState(
        [{ owner: { label: 'own' } }],
        { family: constants.FAMILY_TYPES.building, label: 'house-1' },
        entryCell,
        { getBuildingInteriorEntryTargetForCell: cell => (cell === entryCell ? { label: 'house-1' } : null) }
      )
    )

    assert.equal(classes.has('hero-cursor-enter'), true)
    resetHeroCursor()
  } finally {
    delete global.document
  }
})

test('"aller vers" cursor shows movement over empty go-to targets', () => {
  const classes = new Set()
  global.document = {
    body: {
      classList: {
        add: className => classes.add(className),
        remove: (...classNames) => classNames.forEach(className => classes.delete(className)),
      },
      appendChild: () => {},
    },
    createElement: () => ({ classList: { add: () => {}, remove: () => {}, toggle: () => {} }, style: {} }),
  }

  try {
    const { resetHeroCursor, updateHeroCursor } = loadModule('app/lib/hero/heroCursor.ts', {
      '../constants': constants,
    })
    const { resolveNpcGoToCursorState } = loadModule('app/lib/npc/npcGoToCursor.ts', {
      '../constants': constants,
    })
    updateHeroCursor(null)
    assert.equal(classes.has('hero-cursor-pointer'), false)

    updateHeroCursor(null, resolveNpcGoToCursorState([{}], null, { i: 4, j: 4 }, null))
    assert.equal(classes.has('hero-cursor-move'), true)
    resetHeroCursor()
  } finally {
    delete global.document
  }
})

test('"aller vers" cursor shows movement, not resource, when selected npcs cannot gather a resource', () => {
  const classes = new Set()
  global.document = {
    body: {
      classList: {
        add: className => classes.add(className),
        remove: (...classNames) => classNames.forEach(className => classes.delete(className)),
      },
      appendChild: () => {},
    },
    createElement: () => ({ classList: { add: () => {}, remove: () => {}, toggle: () => {} }, style: {} }),
  }

  try {
    const { resetHeroCursor, updateHeroCursor } = loadModule('app/lib/hero/heroCursor.ts', {
      '../constants': constants,
    })
    const { resolveNpcGoToCursorState } = loadModule('app/lib/npc/npcGoToCursor.ts', {
      '../constants': constants,
    })
    const tree = { family: constants.FAMILY_TYPES.resource, type: constants.RESOURCE_TYPES.tree }
    const infantry = {
      getActionCondition: () => false,
      type: constants.UNIT_TYPES.infantry,
    }

    updateHeroCursor(null, resolveNpcGoToCursorState([infantry], tree, null, null))

    assert.equal(classes.has('hero-cursor-resource'), false)
    assert.equal(classes.has('hero-cursor-move'), true)
    resetHeroCursor()
  } finally {
    delete global.document
  }
})

test('"aller vers" cursor shows the resource hand when a selected npc can gather a resource', () => {
  const classes = new Set()
  global.document = {
    body: {
      classList: {
        add: className => classes.add(className),
        remove: (...classNames) => classNames.forEach(className => classes.delete(className)),
      },
      appendChild: () => {},
    },
    createElement: () => ({ classList: { add: () => {}, remove: () => {}, toggle: () => {} }, style: {} }),
  }

  try {
    const { resetHeroCursor, updateHeroCursor } = loadModule('app/lib/hero/heroCursor.ts', {
      '../constants': constants,
    })
    const { resolveNpcGoToCursorState } = loadModule('app/lib/npc/npcGoToCursor.ts', {
      '../constants': constants,
    })
    const tree = { family: constants.FAMILY_TYPES.resource, type: constants.RESOURCE_TYPES.tree }
    const villager = {
      getActionCondition: (candidate, action) => candidate === tree && action === constants.ACTION_TYPES.chopwood,
      type: constants.UNIT_TYPES.villager,
    }

    updateHeroCursor(null, resolveNpcGoToCursorState([villager], tree, null, null))

    assert.equal(classes.has('hero-cursor-resource'), true)
    resetHeroCursor()
  } finally {
    delete global.document
  }
})

function loadCommModule(instances, getInstanceDegree) {
  return loadModule('app/lib/npc/npcInteraction.ts', {
    '../constants': constants,
    './grid/visibility': {
      findInstancesInSight: (instance, condition) => instances.filter(condition),
    },
    './maths': {
      angleDelta,
      getInstanceDegree,
    },
  })
}

function makeCommAlly(props) {
  return {
    family: constants.FAMILY_TYPES.unit,
    isDead: false,
    isDestroyed: false,
    action: null,
    addChildAt: () => {},
    getChildByLabel: () => null,
    setTextures: () => {},
    ...props,
  }
}

test('hero can talk to a non-hostile AI unit without owning it', () => {
  const player = { label: 'player', isEnemy: owner => owner.relation === 'hostile' }
  const hero = { owner: player }
  const neutralOwner = { label: 'neutral-ai', type: constants.PLAYER_TYPES.ai, relation: 'neutral' }
  const villager = makeCommAlly({ owner: neutralOwner })
  const { isTalkableNpc } = loadNpcInteraction(null)

  assert.equal(isTalkableNpc(hero, villager), true)
})

test('hero cannot talk to a hostile AI unit', () => {
  const player = { label: 'player', isEnemy: owner => owner.relation === 'hostile' }
  const hero = { owner: player }
  const hostileOwner = { label: 'hostile-ai', type: constants.PLAYER_TYPES.ai, relation: 'hostile' }
  const soldier = makeCommAlly({ owner: hostileOwner })
  const { isTalkableNpc } = loadNpcInteraction(null)

  assert.equal(isTalkableNpc(hero, soldier), false)
})

test('communication radius still ignores non-owned neutral AI units', () => {
  const owner = { label: 'player' }
  const neutralOwner = { label: 'neutral-ai', type: constants.PLAYER_TYPES.ai }
  const hero = { owner, degree: 0, x: 0, y: 0, i: 0, j: 0 }
  const neutralVillager = makeCommAlly({ owner: neutralOwner, i: 1, j: 0, x: 10, y: 0 })
  const { resolveCommGroup } = loadCommModule([neutralVillager], () => 0)

  assert.deepEqual(resolveCommGroup(hero, 0), [])
})

test('a quick tap (radius 0) resolves to the ally the hero is facing, ignoring one to the side', () => {
  const owner = { label: 'player' }
  const hero = { owner, degree: 0, x: 0, y: 0, i: 0, j: 0 }
  const facingAlly = makeCommAlly({ owner, i: 1, j: 0, x: 10, y: 0 })
  const sideAlly = makeCommAlly({ owner, i: 0, j: 1, x: 0, y: 10 })
  const getInstanceDegree = (_instance, x) => (x === facingAlly.x ? 0 : 150)
  const { resolveCommGroup } = loadCommModule([facingAlly, sideAlly], getInstanceDegree)

  const group = resolveCommGroup(hero, 0)

  assert.deepEqual(group, [facingAlly])
})

test('a quick tap does not resolve to a faced ally beyond one adjacent cell', () => {
  const owner = { label: 'player' }
  const hero = { owner, degree: 0, x: 0, y: 0, i: 0, j: 0 }
  const farFacingAlly = makeCommAlly({ owner, i: 2, j: 0, x: 20, y: 0 })
  const { resolveCommGroup } = loadCommModule([farFacingAlly], () => 0)

  const group = resolveCommGroup(hero, 0)

  assert.deepEqual(group, [])
})

test('a quick tap does not resolve to a visually distant faced ally even when grid cells are adjacent', () => {
  const owner = { label: 'player' }
  const hero = { owner, degree: 0, x: 0, y: 0, i: 0, j: 0 }
  const distantFacingAlly = makeCommAlly({ owner, i: 1, j: 0, x: 96, y: 0 })
  const { resolveCommGroup } = loadCommModule([distantFacingAlly], () => 0)

  const group = resolveCommGroup(hero, 0)

  assert.deepEqual(group, [])
})

test('a quick tap finds nothing when no ally is within the facing cone', () => {
  const owner = { label: 'player' }
  const hero = { owner, degree: 0, x: 0, y: 0, i: 0, j: 0 }
  const sideAlly = makeCommAlly({ owner, i: 0, j: 1, x: 0, y: 10 })
  const getInstanceDegree = () => 150
  const { resolveCommGroup } = loadCommModule([sideAlly], getInstanceDegree)

  const group = resolveCommGroup(hero, 0)

  assert.deepEqual(group, [])
})

test('communication radius grows exponentially while staying capped at max range', () => {
  const { getCommRadiusForHold } = loadNpcInteraction(null)
  const commChargeMs = 2200
  const commMaxRange = 7

  assert.equal(getCommRadiusForHold(-100), 0)
  assert.equal(getCommRadiusForHold(0), 0)
  assert.ok(getCommRadiusForHold(250) < 1)
  assert.ok(getCommRadiusForHold(commChargeMs / 2) < commMaxRange / 2)
  assert.equal(getCommRadiusForHold(commChargeMs), commMaxRange)
  assert.equal(getCommRadiusForHold(commChargeMs * 2), commMaxRange)
})

test('holding past the precision zone nets every eligible ally in the charged radius', () => {
  const owner = { label: 'player' }
  const hero = { owner, degree: 0, x: 0, y: 0, i: 0, j: 0 }
  const facingAlly = makeCommAlly({ owner, i: 1, j: 0, x: 10, y: 0 })
  const sideAlly = makeCommAlly({ owner, i: 0, j: 1, x: 0, y: 10 })
  const getInstanceDegree = (_instance, x) => (x === facingAlly.x ? 0 : 150)
  const { resolveCommGroup } = loadCommModule([facingAlly, sideAlly], getInstanceDegree)

  const group = resolveCommGroup(hero, 7)

  assert.deepEqual(group, [facingAlly, sideAlly])
})

test('communication indicator cells use the same grid radius as group selection', () => {
  const owner = { label: 'player' }
  const grid = Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) => ({ i, j })))
  const hero = { owner, degree: 0, x: 0, y: 0, i: 2, j: 2, context: { map: { grid } } }
  const inside = makeCommAlly({ owner, i: 4, j: 2, x: 64, y: 32 })
  const diagonalOutside = makeCommAlly({ owner, i: 4, j: 4, x: 0, y: 64 })
  const { getCommCellsInRadius, resolveCommGroup } = loadCommModule([inside, diagonalOutside], () => 0)

  const group = resolveCommGroup(hero, 2)
  const cells = getCommCellsInRadius(hero, 2).map(cell => `${cell.i}:${cell.j}`)

  assert.deepEqual(group, [inside])
  assert.ok(cells.includes('4:2'))
  assert.equal(cells.includes('4:4'), false)
})

test('communication indicator cells use the hero runtime map space grid', () => {
  const owner = { label: 'player' }
  const outsideGrid = createNpcTestGrid(5)
  const interiorGrid = createNpcTestGrid(5, 'interior:house')
  const hero = {
    context: {
      map: {
        grid: outsideGrid,
        size: 5,
        spaces: new Map([
          [
            'interior:house',
            {
              container: {},
              grid: interiorGrid,
              id: 'interior:house',
              kind: 'interior',
              origin: { x: 100, y: 50 },
              size: 5,
            },
          ],
        ]),
      },
    },
    degree: 0,
    i: 2,
    j: 2,
    owner,
    spaceId: 'interior:house',
    x: 0,
    y: 0,
  }
  const { getCommCellsInRadius } = loadCommModule([], () => 0)

  const cells = getCommCellsInRadius(hero, 1)

  assert.ok(cells.length > 0)
  assert.equal(
    cells.every(cell => cell.spaceId === 'interior:house'),
    true
  )
})

test('hidden communication release only takes the ally in front of the hero even with a charged radius', () => {
  const owner = { label: 'player' }
  const hero = { owner, degree: 0, x: 0, y: 0, i: 0, j: 0 }
  const facingAlly = makeCommAlly({ owner, i: 1, j: 0, x: 10, y: 0 })
  const sideAlly = makeCommAlly({ owner, i: 0, j: 1, x: 0, y: 10 })
  const getInstanceDegree = (_instance, x) => (x === facingAlly.x ? 0 : 150)
  const { resolveCommGroup } = loadCommModule([facingAlly, sideAlly], getInstanceDegree)

  const group = resolveCommGroup(hero, 7, { precisionOnly: true })

  assert.deepEqual(group, [facingAlly])
})

test('hidden communication release finds nothing when no ally is in front of the hero', () => {
  const owner = { label: 'player' }
  const hero = { owner, degree: 0, x: 0, y: 0, i: 0, j: 0 }
  const sideAlly = makeCommAlly({ owner, i: 0, j: 1, x: 0, y: 10 })
  const getInstanceDegree = () => 150
  const { resolveCommGroup } = loadCommModule([sideAlly], getInstanceDegree)

  const group = resolveCommGroup(hero, 7, { precisionOnly: true })

  assert.deepEqual(group, [])
})

function loadNpcFollowModule(instances) {
  return loadModule('app/lib/npc/npcInteraction.ts', {
    '../constants': constants,
    './grid/visibility': {
      findInstancesInSight: (instance, condition) => instances.filter(condition),
    },
    './grid/movement': {
      getInstanceClosestFreeCellPath: (_unit, target) => target.path ?? [{ i: target.i, j: target.j }],
    },
    './combat': {
      isWheatMature: target => target?.mature !== false,
    },
    './maths': {
      angleDelta,
      getInstanceDegree: () => 0,
      isometricToCartesian: () => [0, 0],
    },
  })
}

function makeEscortWorld(followerProps) {
  const heroCell = { i: 0, j: 0, has: null, corpses: [] }
  const owner = { label: 'player', units: [] }
  owner.isEnemy = other => Boolean(other) && other !== owner
  const hero = { i: 0, j: 0, owner, context: { map: { grid: [[heroCell]] } } }
  const calls = []
  const follower = {
    followingHero: true,
    isDead: false,
    isDestroyed: false,
    owner,
    sendTo: dest => calls.push(['move', dest]),
    sendToAttack: target => calls.push(['attack', target]),
    ...followerProps,
  }
  owner.units = [hero, follower]
  return { hero, follower, heroCell, calls }
}

test('followers engage an enemy unit passing near the hero', () => {
  const enemyOwner = { label: 'enemy' }
  const enemy = { family: 'unit', owner: enemyOwner, hitPoints: 20, isDead: false, isDestroyed: false, i: 3, j: 0 }
  const { updateNpcFollow } = loadNpcFollowModule([enemy])
  const { hero, calls } = makeEscortWorld({
    i: 1,
    j: 0,
    getActionCondition: (target, action) => target === enemy && action === constants.ACTION_TYPES.attack,
  })

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['attack', enemy]])
})

test('followers ignore idle animals and keep trailing the hero', () => {
  const gaia = { label: 'gaia' }
  const gazelle = {
    family: constants.FAMILY_TYPES.animal,
    owner: gaia,
    hitPoints: 8,
    isDead: false,
    isDestroyed: false,
    action: null,
    dest: null,
    i: 2,
    j: 0,
  }
  const { updateNpcFollow } = loadNpcFollowModule([gazelle])
  const { hero, heroCell, calls } = makeEscortWorld({
    i: 4,
    j: 0,
    getActionCondition: () => true,
  })

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['move', heroCell]])
})

test('followers match the hero walking pace while following', () => {
  const { updateNpcFollow } = loadNpcFollowModule([])
  const { hero, follower, heroCell, calls } = makeEscortWorld({
    i: 4,
    j: 0,
    requestedMoveSpeedFactor: undefined,
    getActionCondition: () => true,
  })

  updateNpcFollow(hero, { matchHeroWalk: true })

  assert.deepEqual(calls, [['move', heroCell]])
  assert.equal(follower.requestedMoveSpeedFactor, 0.5)

  updateNpcFollow(hero, { matchHeroWalk: false })

  assert.equal(follower.requestedMoveSpeedFactor, undefined)
})

test('stationary followers copy the hero crouch pose without needing to move', () => {
  const { updateNpcFollow } = loadModule('app/lib/npc/npcInteraction.ts', {
    '../constants': constants,
    './grid/visibility': {
      findInstancesInSight: () => [],
    },
    './maths': {
      angleDelta,
      getInstanceDegree: () => 0,
      isometricToCartesian: () => [0, 0],
    },
    './units/unitCrouchPose': {
      applyUnitCrouchPose: (unit, active) => {
        unit.isCrouching = active
      },
      resetUnitCrouchPose: () => {},
    },
  })
  const { hero, follower, calls } = makeEscortWorld({
    i: 0,
    j: 0,
    getActionCondition: () => true,
  })
  hero.isCrouching = true

  updateNpcFollow(hero)

  assert.deepEqual(calls, [])
  assert.equal(follower.isCrouching, true)

  hero.isCrouching = false
  updateNpcFollow(hero)

  assert.equal(follower.isCrouching, false)
})

test('followers defend the hero from an attacking predator', () => {
  const gaia = { label: 'gaia' }
  const lion = {
    family: constants.FAMILY_TYPES.animal,
    owner: gaia,
    hitPoints: 30,
    isDead: false,
    isDestroyed: false,
    action: constants.ACTION_TYPES.attack,
    dest: null,
    i: 2,
    j: 0,
  }
  const { updateNpcFollow } = loadNpcFollowModule([lion])
  const { hero, calls } = makeEscortWorld({
    i: 1,
    j: 0,
    getActionCondition: (target, action) => target === lion && action === constants.ACTION_TYPES.attack,
  })
  lion.dest = hero

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['attack', lion]])
})

test('followers prefer an active attacker over a closer passer-by', () => {
  const enemyOwner = { label: 'enemy' }
  const passing = { family: 'unit', owner: enemyOwner, hitPoints: 20, isDead: false, isDestroyed: false, i: 1, j: 0 }
  const attacker = {
    family: 'unit',
    owner: enemyOwner,
    hitPoints: 20,
    isDead: false,
    isDestroyed: false,
    action: constants.ACTION_TYPES.attack,
    dest: null,
    i: 3,
    j: 0,
  }
  const { updateNpcFollow } = loadNpcFollowModule([passing, attacker])
  const { hero, calls } = makeEscortWorld({
    i: 0,
    j: 1,
    getActionCondition: (target, action) => action === constants.ACTION_TYPES.attack,
  })
  attacker.dest = hero

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['attack', attacker]])
})

test('a fighting follower is left alone inside the leash', () => {
  const enemyOwner = { label: 'enemy' }
  const enemy = { family: 'unit', owner: enemyOwner, hitPoints: 20, isDead: false, isDestroyed: false, i: 6, j: 0 }
  const { updateNpcFollow } = loadNpcFollowModule([enemy])
  const { hero, follower, calls } = makeEscortWorld({
    i: 5,
    j: 0,
    action: constants.ACTION_TYPES.attack,
    getActionCondition: () => true,
  })
  follower.dest = enemy

  updateNpcFollow(hero)

  assert.deepEqual(calls, [])
})

test('a follower dragged past the leash breaks off and returns to the hero', () => {
  const enemyOwner = { label: 'enemy' }
  const enemy = { family: 'unit', owner: enemyOwner, hitPoints: 20, isDead: false, isDestroyed: false, i: 21, j: 0 }
  const { updateNpcFollow } = loadNpcFollowModule([enemy])
  const { hero, follower, heroCell, calls } = makeEscortWorld({
    i: 20,
    j: 0,
    action: constants.ACTION_TYPES.attack,
    getActionCondition: () => true,
  })
  follower.dest = enemy

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['move', heroCell]])
})

test('villager followers mirror the hero chopping nearby trees without keeping a permanent wood job', () => {
  const tree = {
    family: constants.FAMILY_TYPES.resource,
    hitPoints: 10,
    i: 1,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'tree-1',
    path: [{ i: 1, j: 1 }],
    quantity: 40,
    type: constants.RESOURCE_TYPES.tree,
  }
  const { updateNpcFollow } = loadNpcFollowModule([tree])
  const { hero, follower, calls } = makeEscortWorld({
    i: 2,
    j: 0,
    type: constants.UNIT_TYPES.villager,
    autonomousJob: null,
    getActionCondition: (target, action) => target === tree && action === constants.ACTION_TYPES.chopwood,
    sendToTree(target) {
      calls.push(['chopwood', target])
      this.dest = target
      this.action = constants.ACTION_TYPES.chopwood
      this.work = constants.WORK_TYPES.woodcutter
      this.autonomousJob = 'wood'
    },
  })
  hero.action = constants.ACTION_TYPES.chopwood
  hero.dest = tree

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['chopwood', tree]])
  assert.deepEqual(follower.followAssist, { action: constants.ACTION_TYPES.chopwood, targetLabel: 'tree-1' })
  assert.equal(follower.autonomousJob, null)
})

test('villager followers do not mirror hero resource work at night', () => {
  const tree = {
    family: constants.FAMILY_TYPES.resource,
    hitPoints: 10,
    i: 1,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'tree-1',
    path: [{ i: 1, j: 1 }],
    quantity: 40,
    type: constants.RESOURCE_TYPES.tree,
  }
  const { updateNpcFollow } = loadNpcFollowModule([tree])
  const { hero, follower, heroCell, calls } = makeEscortWorld({
    i: 2,
    j: 0,
    type: constants.UNIT_TYPES.villager,
    getActionCondition: (target, action) => target === tree && action === constants.ACTION_TYPES.chopwood,
    sendToTree(target) {
      calls.push(['chopwood', target])
    },
  })
  hero.context.dayNight = { state: { hour: 23 } }
  hero.action = constants.ACTION_TYPES.chopwood
  hero.dest = tree

  updateNpcFollow(hero)

  assert.deepEqual(calls, [])
  assert.equal(follower.followAssist, undefined)
})

test('villager followers mirror hero farming while skipping occupied wheat', () => {
  const occupiedWheat = {
    family: constants.FAMILY_TYPES.resource,
    hitPoints: 10,
    i: 1,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'wheat-1',
    path: [{ i: 1, j: 1 }],
    quantity: 20,
    type: constants.RESOURCE_TYPES.wheat,
  }
  const freeWheat = {
    ...occupiedWheat,
    i: 2,
    label: 'wheat-2',
    path: [{ i: 2, j: 1 }],
  }
  const { updateNpcFollow } = loadNpcFollowModule([occupiedWheat, freeWheat])
  const { hero, follower, calls } = makeEscortWorld({
    i: 3,
    j: 0,
    type: constants.UNIT_TYPES.villager,
    getActionCondition: (_target, action) => action === constants.ACTION_TYPES.farm,
    sendToFarm(target) {
      calls.push(['farm', target])
      this.dest = target
      this.action = constants.ACTION_TYPES.farm
      this.work = constants.WORK_TYPES.farmer
    },
  })
  const busyFarmer = {
    type: constants.UNIT_TYPES.villager,
    work: constants.WORK_TYPES.farmer,
    action: constants.ACTION_TYPES.farm,
    dest: occupiedWheat,
    owner: hero.owner,
  }
  hero.owner.units.push(busyFarmer)
  hero.action = constants.ACTION_TYPES.farm
  hero.dest = occupiedWheat

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['farm', freeWheat]])
  assert.deepEqual(follower.followAssist, { action: constants.ACTION_TYPES.farm, targetLabel: 'wheat-2' })
})

test('followers mirror the hero attacking a live target', () => {
  const target = {
    family: constants.FAMILY_TYPES.animal,
    hitPoints: 12,
    i: 2,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'boar-1',
  }
  const { updateNpcFollow } = loadNpcFollowModule([target])
  const { hero, follower, calls } = makeEscortWorld({
    i: 1,
    j: 0,
    getActionCondition: (orderTarget, action) => orderTarget === target && action === constants.ACTION_TYPES.attack,
    sendToAttack(orderTarget) {
      calls.push(['attack', orderTarget])
      this.dest = orderTarget
      this.action = constants.ACTION_TYPES.attack
    },
  })
  hero.action = constants.ACTION_TYPES.attack
  hero.dest = target

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['attack', target]])
  assert.deepEqual(follower.followAssist, { action: constants.ACTION_TYPES.attack, targetLabel: 'boar-1' })
})

test('villager followers treat a hero bow intent at a deer as a hunt order for that deer', () => {
  const deer = {
    family: constants.FAMILY_TYPES.animal,
    hitPoints: 8,
    i: 2,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'deer-1',
    path: [{ i: 2, j: 1 }],
    quantity: 80,
    type: 'Deer',
  }
  const { updateNpcFollow } = loadNpcFollowModule([])
  const { hero, follower, calls } = makeEscortWorld({
    i: 1,
    j: 0,
    type: constants.UNIT_TYPES.villager,
    getActionCondition: (target, action) => target === deer && action === constants.ACTION_TYPES.hunt,
    isUnitAtDest: (action, target) => action === constants.ACTION_TYPES.hunt && target === deer,
    sendToHunt(target) {
      calls.push(['hunt', target])
      this.dest = target
      this.action = constants.ACTION_TYPES.hunt
      this.work = constants.WORK_TYPES.hunter
    },
  })
  hero.action = null
  hero.dest = null
  hero.followAssistIntent = { action: constants.ACTION_TYPES.hunt, target: deer, targetLabel: 'deer-1' }

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['hunt', deer]])
  assert.deepEqual(follower.followAssist, { action: constants.ACTION_TYPES.hunt, targetLabel: 'deer-1' })
})

test('villager followers do not walk toward a deer for a hero bow-shot intent', () => {
  const deer = {
    family: constants.FAMILY_TYPES.animal,
    hitPoints: 8,
    i: 2,
    isDead: false,
    isDestroyed: false,
    j: 0,
    label: 'deer-1',
    path: [{ i: 2, j: 1 }],
    quantity: 80,
    type: 'Deer',
  }
  const { updateNpcFollow } = loadNpcFollowModule([])
  const { hero, follower, heroCell, calls } = makeEscortWorld({
    i: 4,
    j: 0,
    type: constants.UNIT_TYPES.villager,
    action: constants.ACTION_TYPES.hunt,
    dest: deer,
    followAssist: { action: constants.ACTION_TYPES.hunt, targetLabel: 'deer-1' },
    getActionCondition: (target, action) => target === deer && action === constants.ACTION_TYPES.hunt,
    isUnitAtDest: () => false,
    sendToHunt(target) {
      calls.push(['hunt', target])
    },
    stop() {
      calls.push(['stop'])
      this.action = null
      this.dest = null
    },
  })
  hero.action = null
  hero.dest = null
  hero.followAssistIntent = { action: constants.ACTION_TYPES.hunt, target: deer, targetLabel: 'deer-1' }

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['stop'], ['move', heroCell]])
  assert.equal(follower.followAssist, null)
})

test('followers stop temporary follow-assist work when the hero stops that work', () => {
  const { updateNpcFollow } = loadNpcFollowModule([])
  const { hero, follower, heroCell, calls } = makeEscortWorld({
    i: 4,
    j: 0,
    action: constants.ACTION_TYPES.chopwood,
    dest: { label: 'tree-1' },
    followAssist: { action: constants.ACTION_TYPES.chopwood, targetLabel: 'tree-1' },
    stop() {
      calls.push(['stop'])
      this.action = null
      this.dest = null
    },
  })
  hero.action = null
  hero.dest = null

  updateNpcFollow(hero)

  assert.deepEqual(calls, [['stop'], ['move', heroCell]])
  assert.equal(follower.followAssist, null)
})

test('assisted hunters stop when their hunted animal dies instead of switching to meat gathering', () => {
  const calls = []
  const deer = {
    family: constants.FAMILY_TYPES.animal,
    hitPoints: 0,
    isDead: true,
    isDestroyed: false,
    quantity: 80,
  }
  const { UnitDirectedActions } = loadTsModule('app/classes/unit/UnitDirectedActions.ts', {
    mocks: {
      '../../constants': {
        ...constants,
        LOADING_TYPES: { meat: 'meat' },
        SHEET_TYPES: { action: 'action' },
        SOUND_CUES: { villager: { takeMeat: 'takeMeat' } },
      },
      '../../lib': {
        BOW_SHOOT_RELEASE_FRAME: 7,
        HUNTING_PROJECTILE: 'Arrow',
        onSpriteLoopAtFrame: () => {},
        playerCanSeeInstance: () => true,
        showHealingFeedback: () => {},
        syncMovedActionTarget: () => {},
      },
      '../../lib/entities/entityHealthDisplay': {
        syncEntityHealthDisplay: () => {},
      },
      '../../lib/lang': {
        t: key => key,
      },
      '../../lib/lpc': {
        refreshBakedLpcUnitAssets: () => {},
      },
      '../../lib/units/unitExperience': {
        getHealingXpBonus: () => 0,
        grantUnitXp: () => {},
        XP_CATEGORIES: { healing: 'healing' },
      },
      '../../lib/units/unitControl': {
        isHeroControlled: () => false,
      },
      '../../lib/units/unitEnergy': {
        spendOrWaitForEnergy: () => true,
      },
      '../Projectile': {
        Projectile: class {},
      },
      './UnitManualHeroWork': {
        stopManualHeroAction: () => {},
      },
    },
  })
  const unit = {
    action: constants.ACTION_TYPES.hunt,
    dest: deer,
    followAssist: { action: constants.ACTION_TYPES.hunt, targetLabel: 'deer-1' },
    getActionCondition: () => true,
    sendToTakeMeat: target => calls.push(['takemeat', target]),
    sprite: {},
    stop() {
      calls.push(['stop'])
      this.action = null
      this.dest = null
    },
  }

  new UnitDirectedActions(unit, () => {}).handleHuntAction()

  assert.deepEqual(calls, [['stop']])
  assert.equal(unit.followAssist, null)
})
