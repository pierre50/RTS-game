const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadSaveSerializer() {
  const filename = path.join(__dirname, '../app/serialization/SaveSerializer.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mockRequire = id => {
    if (id === '../lib') {
      return {
        filterObject(sourceObject, keys) {
          return keys.reduce((result, key) => {
            if (sourceObject[key] !== undefined) result[key] = sourceObject[key]
            return result
          }, {})
        },
        getGaiaAnimals: gaia => gaia?.animals ?? gaia?.units ?? [],
      }
    }
    if (id === '../lib/units/villagerAssignments') {
      return {
        summarizeVillagerAssignments(units = []) {
          const assigned = { wood: 0, food: 0, stone: 0, gold: 0, copper: 0, iron: 0 }
          let total = 0
          for (const unit of units) {
            if (unit.type !== 'Villager' || unit.isDead || unit.isDestroyed) continue
            total++
            if (unit.work === 'woodcutter') assigned.wood++
            if (unit.work === 'farmer' || unit.work === 'forager' || unit.work === 'hunter') assigned.food++
          }
          return {
            total,
            assigned,
            construction: 0,
            horseCapture: 0,
            idle: total - assigned.wood - assigned.food,
            sleeping: 0,
            moving: 0,
          }
        },
      }
    }
    return require(id)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, mockRequire)
  return module.exports
}

function makeContext(mapOverrides = {}) {
  return {
    scheduler: { elapsedMs: 123 },
    controls: { camera: { x: 10, y: 20 } },
    players: [
      {
        label: 'player-1',
        type: 'Human',
        isPlayed: true,
        buildings: [],
        units: [],
        corpses: [],
        views: { toJSON: () => [[{}]] },
      },
    ],
    map: {
      seed: 42,
      size: 144,
      mapType: 'continent',
      positionsCount: 2,
      pregeneratedBlueprintId: null,
      resources: new Set(),
      gaia: { units: [] },
      grid: [[{ type: 'Grass', z: 0, fogSprites: [] }]],
      ...mapOverrides,
    },
  }
}

const { serializeGame } = loadSaveSerializer()

test('seeded saves omit the full map grid', () => {
  const save = serializeGame(makeContext())

  assert.equal(save.version, 2)
  assert.equal(save.world.seed, 42)
  assert.equal(save.world.size, 144)
  assert.equal(save.world.mapType, 'continent')
  assert.equal(Object.hasOwn(save, 'map'), false)
})

test('saves without a seed do not write a legacy map fallback', () => {
  const save = serializeGame(makeContext({ seed: null }))

  assert.equal(save.version, 2)
  assert.equal(Object.hasOwn(save, 'map'), false)
})

test('serializes resources with remaining quantity, size, health and stable texture names', () => {
  const save = serializeGame(
    makeContext({
      resources: new Set([
        {
          label: 'portal-1',
          family: 'resource',
          type: 'Portal',
          i: 4,
          j: 5,
          quantity: 1,
          hitPoints: 12,
          size: 3,
          textureName: 'resources/portal.png',
        },
      ]),
    })
  )

  assert.deepEqual(save.resources[0], {
    label: 'portal-1',
    i: 4,
    j: 5,
    type: 'Portal',
    quantity: 1,
    size: 3,
    hitPoints: 12,
    textureName: 'resources/portal',
  })
})

test('serializes animal movement and corpse state while skipping destroyed animals', () => {
  const save = serializeGame(
    makeContext({
      gaia: {
        animals: [
          {
            label: 'gazelle-1',
            family: 'animal',
            type: 'Gazelle',
            i: 6,
            j: 7,
            x: 100,
            y: 50,
            z: 2,
            hitPoints: 4,
            tamingStatus: 'tamed',
            quantity: 20,
            work: 'hunter',
            action: 'takemeat',
            degree: 180,
            direction: 2,
            currentSheet: 'walking',
            inactif: false,
            isFleeing: true,
            dest: { i: 8, j: 9, label: 'tree-1' },
            previousDest: { i: 5, j: 5 },
            realDest: { i: 8, j: 9, x: 120, y: 60, label: 'tree-1' },
            path: [
              { i: 6, j: 8 },
              { i: 7, j: 8 },
            ],
            sprite: { currentFrame: 3, loop: false },
          },
          {
            label: 'gazelle-2',
            family: 'animal',
            type: 'Gazelle',
            i: 1,
            j: 1,
            isDestroyed: true,
          },
        ],
      },
    })
  )

  assert.equal(save.animals.length, 1)
  assert.deepEqual(save.animals[0].dest, [8, 9, 'tree-1'])
  assert.deepEqual(save.animals[0].previousDest, [5, 5, undefined])
  assert.deepEqual(save.animals[0].path, [
    { i: 6, j: 8 },
    { i: 7, j: 8 },
  ])
  assert.deepEqual(save.animals[0].realDest, { i: 8, j: 9, x: 120, y: 60, label: 'tree-1' })
  assert.equal(save.animals[0].currentFrame, 3)
  assert.equal(save.animals[0].loop, false)
  assert.equal(save.animals[0].isFleeing, true)
  assert.equal(save.animals[0].tamingStatus, 'tamed')
})

test('serializes unit work orders, equipment state and build queues', () => {
  const context = makeContext()
  context.players[0].units = [
    {
      label: 'villager-1',
      name: 'Ada',
      family: 'unit',
      type: 'Villager',
      gender: 'female',
      appearanceVariants: { gender: 'female' },
      i: 10,
      j: 11,
      x: 320,
      y: 160,
      z: 1,
      hitPoints: 18,
      work: 'woodcutter',
      autonomousJob: 'wood',
      previousWork: 'builder',
      action: 'chopwood',
      degree: 90,
      direction: 1,
      currentSheet: 'action',
      currentFrame: 2,
      mountedOnHorse: true,
      companionHorseColor: 'dark',
      followingHero: true,
      assetCiv: 'franks',
      assetAge: 2,
      experience: { woodcutting: 15 },
      inventory: {
        equipment: ['round_shield_ceramic_slash'],
        equipped: { helmet: 'helmet_barbarian_ceramic' },
        equippedCounts: { arrow: 12 },
        activeWeapons: { melee: 'sword_ceramic' },
      },
      lootEquipment: ['helmet_barbarian_ceramic'],
      dest: { i: 12, j: 13, label: 'tree-1' },
      previousDest: { i: 9, j: 9, label: 'tc-1' },
      realDest: { i: 12, j: 13, x: 350, y: 175, label: 'tree-1' },
      path: [{ i: 11, j: 12 }],
      buildQueue: [{ label: 'house-1' }, { label: 'barracks-1' }],
      blockedGatherApproach: {
        target: { i: 12, j: 13, label: 'tree-1' },
        action: 'chopwood',
      },
      sprite: { currentFrame: 4, loop: true },
    },
  ]

  const save = serializeGame(context)

  assert.deepEqual(save.players[0].units[0].dest, [12, 13, 'tree-1'])
  assert.deepEqual(save.players[0].units[0].previousDest, [9, 9, 'tc-1'])
  assert.deepEqual(save.players[0].units[0].buildQueue, ['house-1', 'barracks-1'])
  assert.deepEqual(save.players[0].units[0].blockedGatherApproach, {
    target: [12, 13, 'tree-1'],
    action: 'chopwood',
  })
  assert.equal(save.players[0].units[0].autonomousJob, 'wood')
  assert.deepEqual(save.players[0].villagerAssignments, {
    total: 1,
    assigned: { wood: 1, food: 0, stone: 0, gold: 0, copper: 0, iron: 0 },
    construction: 0,
    horseCapture: 0,
    idle: 0,
    sleeping: 0,
    moving: 0,
  })
  assert.equal(save.players[0].units[0].mountedOnHorse, true)
  assert.equal(save.players[0].units[0].companionHorseColor, 'dark')
  assert.equal(save.players[0].units[0].gender, 'female')
  assert.deepEqual(save.players[0].units[0].appearanceVariants, { gender: 'female' })
  assert.deepEqual(save.players[0].units[0].experience, { woodcutting: 15 })
  assert.deepEqual(save.players[0].units[0].inventory, {
    equipment: ['round_shield_ceramic_slash'],
    equipped: { helmet: 'helmet_barbarian_ceramic' },
    equippedCounts: { arrow: 12 },
    activeWeapons: { melee: 'sword_ceramic' },
  })
  assert.deepEqual(save.players[0].units[0].lootEquipment, ['helmet_barbarian_ceramic'])
})

test('serializes building production, research, rally points and active user links', () => {
  const context = makeContext()
  context.players[0].buildings = [
    {
      label: 'tc-1',
      family: 'building',
      type: 'TownCenter',
      i: 20,
      j: 21,
      queue: ['Villager'],
      technology: { type: 'Loom', config: { cost: { food: 50 } } },
      loading: 42,
      trainingStartedDay: 3,
      trainingCompleteDay: 5,
      isBuilt: true,
      hitPoints: 500,
      quantity: 3,
      horseAmount: 2,
      stableHorses: [
        { horseColor: 'dark', tamingStatus: 'tamed' },
        { horseColor: 'light', tamingStatus: 'tamed' },
      ],
      rallyPoint: { i: 22, j: 23, direction: 1 },
      assetCiv: 'greek',
      assetAge: 1,
      assetType: 'TownCenter',
      inventory: { equipment: ['trap'], resources: { wood: 5 } },
      isUsedBy: { label: 'villager-1' },
    },
  ]

  const save = serializeGame(context)

  assert.deepEqual(save.players[0].buildings[0], {
    label: 'tc-1',
    i: 20,
    j: 21,
    type: 'TownCenter',
    queue: ['Villager'],
    technology: { type: 'Loom', config: { cost: { food: 50 } } },
    loading: 42,
    trainingStartedDay: 3,
    trainingCompleteDay: 5,
    isBuilt: true,
    hitPoints: 500,
    quantity: 3,
    horseAmount: 2,
    stableHorses: [
      { horseColor: 'dark', tamingStatus: 'tamed' },
      { horseColor: 'light', tamingStatus: 'tamed' },
    ],
    rallyPoint: { i: 22, j: 23, direction: 1 },
    assetCiv: 'greek',
    assetAge: 1,
    assetType: 'TownCenter',
    inventory: { equipment: ['trap'], resources: { wood: 5 } },
    isUsedBy: 'villager-1',
  })
})
