const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('pending and consumed rescue thanks survive save and travel state copying', () => {
  const { applyPortableUnitState } = loadTsModule('app/screens/game/GameStateHelpers.ts')
  for (const pending of [true, false]) {
    const context = makeContext()
    context.players[0].units = [{ type: 'Villager', i: 1, j: 1, pendingRescueThanks: pending }]
    const saved = JSON.parse(JSON.stringify(loadSaveSerializer().serializeGame(context))).players[0].units[0]
    assert.equal(saved.pendingRescueThanks, pending)
    const target = {}
    applyPortableUnitState(target, saved)
    assert.equal(target.pendingRescueThanks, pending)
  }
})

test('saving preserves the selected hero tool separately from inventory', () => {
  const context = makeContext()
  for (const item of ['interact', 'sword', 'bow', null]) {
    context.controls.equippedItem = item
    const saved = loadSaveSerializer().serializeGame(context)
    assert.equal(JSON.parse(JSON.stringify(saved)).runtime.heroEquippedItem, item)
  }
})

function loadSaveSerializer() {
  const filename = path.join(__dirname, '../app/serialization/SaveSerializer.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mockRequire = id => {
    if (id.endsWith('/playerTargetKnowledge')) return { exportTargetKnowledge: () => [] }
    if (id === './InteriorBuildingSave') return loadTsModule('app/serialization/InteriorBuildingSave.ts')
    if (id === '../lib/definedProperties' || id === './TrainingSave') {
      const dependency = path.join(
        __dirname,
        id === './TrainingSave' ? '../app/serialization/TrainingSave.ts' : '../app/lib/definedProperties.ts'
      )
      const transformed = babel.transformSync(fs.readFileSync(dependency, 'utf8'), {
        filename: dependency,
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }],
          '@babel/preset-typescript',
        ],
      })
      const loaded = { exports: {} }
      new Function('module', 'exports', 'require', transformed.code)(loaded, loaded.exports, mockRequire)
      return loaded.exports
    }
    if (id === '../lib') {
      return {
        filterObject(sourceObject, keys) {
          return keys.reduce((result, key) => {
            if (sourceObject[key] !== undefined) result[key] = sourceObject[key]
            return result
          }, {})
        },
        getEntityMapSpace: entity => entity.context?.map?.spaces?.get(entity.spaceId),
        getCellMapPoint: cell => ({ x: cell.x, y: cell.y }),
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

test('pending world pursuers are included in the runtime save', () => {
  const { serializeGame } = loadSaveSerializer()
  const context = makeContext()
  const entries = [
    {
      entity: { label: 'wolf', type: 'Wolf', i: 1, j: 2 },
      arrival: { i: 1, j: 2 },
      targetLabel: 'hero',
      remainingMs: 1200,
    },
  ]
  context.worldPursuit = { serializeState: () => structuredClone(entries) }
  assert.deepEqual(serializeGame(context).runtime.worldPursuers, entries)
})

test('harvested and growing wheat saves its exact growth frame and original planted position', () => {
  const { serializeGame } = loadSaveSerializer()
  for (const frame of [0, 1, 3]) {
    const crop = {
      type: 'Wheat',
      label: 'farm-plot',
      i: 0,
      j: 0,
      quantity: 12,
      totalQuantity: 12,
      isNaturalResource: false,
      sprite: { currentFrame: frame },
    }
    const saved = serializeGame(makeContext({ resources: new Set([crop]) })).resources[0]
    assert.equal(saved.currentFrame, frame)
    assert.equal(saved.quantity, 12)
    assert.equal(saved.isNaturalResource, false)
    assert.deepEqual([saved.i, saved.j], [0, 0])
  }
})

test('autonomous exploration remains distinguishable from manual movement after saving', () => {
  const { serializeGame } = loadSaveSerializer()
  const context = makeContext()
  context.players[0].units = [
    {
      label: 'food-explorer',
      type: 'Villager',
      i: 1,
      j: 1,
      autonomousJob: 'food',
      exploringForAutonomy: true,
      dest: { i: 2, j: 2 },
      action: null,
      path: [{ i: 2, j: 2 }],
    },
  ]
  const saved = serializeGame(context).players[0].units[0]
  assert.equal(saved.autonomousJob, 'food')
  assert.equal(saved.exploringForAutonomy, true)
  assert.equal(saved.action, null)
})

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
      mapType: 'world-region',
      pregeneratedBlueprintId: null,
      resources: new Set(),
      gaia: { units: [] },
      grid: [[{ type: 'Grass', z: 0, fogSprites: [] }]],
      ...mapOverrides,
    },
  }
}

test('faction expedition origin and phase survive serialization without shared live references', () => {
  const context = makeContext()
  const expedition = {
    raidId: 'raid-1',
    factionId: 'civ-hellas',
    regionId: 'home',
    playerLabel: 'ai',
    original: { type: 'Fantassin', label: 'soldier', i: 3, j: 4, hitPoints: 20 },
    phase: 'hostile',
    tribute: { gold: 50 },
  }
  context.players[0].units.push({ type: 'Fantassin', label: 'soldier', i: 0, j: 0, factionExpedition: expedition })
  const saved = serializeGame(context)
  assert.deepEqual(saved.players[0].units[0].factionExpedition, expedition)
  expedition.phase = 'leaving'
  assert.equal(saved.players[0].units[0].factionExpedition.phase, 'hostile')
})

test('building saves include concurrent recruits and pending unit training orders without live references', () => {
  const { serializeGame } = loadSaveSerializer()
  const context = makeContext()
  const trainee = { type: 'Villager', label: 'recruit', i: 0, j: 0, name: 'Aline' }
  trainee.owner = context.players[0]
  context.players[0].buildings.push({
    type: 'Barracks',
    label: 'barracks',
    i: 0,
    j: 0,
    queue: ['Fantassin'],
    trainingQueue: [
      {
        type: 'Fantassin',
        trainee,
        cost: { food: 35 },
        trainingStartedDay: 3,
        trainingCompleteDay: 13,
        extra: { name: 'Aline' },
        trainingDayChangeUnsubscribe() {},
      },
    ],
  })
  context.players[0].units.push({
    type: 'Villager',
    label: 'incoming',
    i: 0,
    j: 0,
    trainingTargetType: 'Fantassin',
    action: 'train',
    dest: context.players[0].buildings[0],
  })
  const save = JSON.parse(JSON.stringify(serializeGame(context)))
  assert.equal(save.players[0].units[0].trainingTargetType, 'Fantassin')
  const saved = save.players[0].buildings[0].trainingQueue[0]
  assert.equal(saved.trainee.label, 'recruit')
  assert.equal(saved.trainee.owner, undefined)
  assert.equal(saved.trainingCompleteDay, 13)
  assert.deepEqual(saved.cost, { food: 35 })
})

const { serializeGame } = loadSaveSerializer()

test('new saves keep objectives but discard legacy technology and research state', () => {
  const context = makeContext({ allTechnologies: true })
  Object.assign(context.players[0], {
    completedObjectives: ['huntAnimal'],
    discoveredEquipment: ['catchingPole'],
    technologies: ['Alchemy', 'Woodworking'],
    researchTechnology: { type: 'Toolworking' },
    researchLoading: 50,
  })
  context.players[0].buildings.push({
    type: 'Granary',
    i: 0,
    j: 0,
    label: 'granary',
    technology: { type: 'UpgradeFortification' },
  })
  const save = serializeGame(context)
  assert.deepEqual(save.players[0].completedObjectives, ['huntAnimal'])
  for (const key of ['discoveredEquipment', 'technologies', 'researchTechnology', 'researchLoading']) {
    assert.equal(Object.hasOwn(save.players[0], key), false)
  }
  assert.equal(Object.hasOwn(save.players[0].buildings[0], 'technology'), false)
})

test('sleeping villagers retain their work assignment and fractional offline progress in saves', () => {
  const context = makeContext()
  context.players[0].units.push({
    type: 'Villager',
    label: 'sleeper',
    i: 1,
    j: 1,
    work: null,
    autonomousJob: null,
    shelterState: { previousWork: 'woodcutter', previousAutonomousJob: 'wood' },
    offlineWork: { target: 'woodcutter:tree', milliseconds: 250 },
  })
  const unit = serializeGame(context).players[0].units[0]
  assert.equal(unit.work, 'woodcutter')
  assert.equal(unit.autonomousJob, 'wood')
  assert.deepEqual(unit.offlineWork, { target: 'woodcutter:tree', milliseconds: 250 })
})

test('seeded saves omit the full map grid', () => {
  const save = serializeGame(makeContext())

  assert.equal(save.version, 2)
  assert.equal(save.world.seed, 42)
  assert.equal(save.world.size, 144)
  assert.equal(save.world.mapType, 'world-region')
  assert.equal(Object.hasOwn(save, 'map'), false)
})

test('sparse local saves retain independent layout metadata and the source blueprint size', () => {
  const layout = { columns: 74, rows: 293 }
  const save = serializeGame(
    makeContext({
      localGridLayout: layout,
      size: 219,
      worldRegionId: 'r0-0',
      worldManifest: { maps: [{ id: 'r0-0', size: 144 }] },
    })
  )
  assert.deepEqual(save.world.localGridLayout, layout)
  assert.deepEqual(save.config.localGridLayout, layout)
  assert.equal(save.world.sourceSize, 144)
  assert.equal(save.config.size, 144)
  assert.equal(save.world.size, 219)
  layout.columns = 2
  assert.equal(save.world.localGridLayout.columns, 74)
  assert.equal(save.config.localGridLayout.columns, 74)
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
          label: 'stone-1',
          family: 'resource',
          type: 'Stone',
          i: 4,
          j: 5,
          quantity: 1,
          hitPoints: 12,
          size: 3,
          textureName: 'resources/minerals/stone.png',
        },
      ]),
    })
  )

  assert.deepEqual(save.resources[0], {
    label: 'stone-1',
    i: 4,
    j: 5,
    type: 'Stone',
    quantity: 1,
    size: 3,
    hitPoints: 12,
    textureName: 'resources/minerals/stone',
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

test('dead wildlife respawn slots survive saves without accessing destroyed graphics or reviving captured animals', () => {
  const slot = {
    type: 'Hare',
    label: 'hare-slot',
    i: 1,
    j: 2,
    isDead: true,
    isDestroyed: true,
    totalHitPoints: 8,
    totalQuantity: 12,
  }
  Object.defineProperty(slot, 'sprite', {
    get() {
      assert.fail('destroyed graphics must not be accessed')
    },
  })
  const context = makeContext({
    gaia: {
      animals: [slot, { ...slot, label: 'trapped', trapPrey: true }, { ...slot, label: 'captured', isDead: false }],
    },
  })
  const save = serializeGame(context)
  assert.equal(save.animals.length, 1)
  assert.equal(save.animals[0].label, 'hare-slot')
  assert.equal(save.animals[0].isDead, true)
  assert.equal(save.animals[0].totalQuantity, 12)
  assert.equal(save.animals[0].quantity, 0)
})

test('serializer nests interior buildings under the exterior parent and preserves every chest inventory', () => {
  const context = makeContext()
  const owner = context.players[0]
  owner.buildings = [
    { type: 'TownCenter', label: 'center', i: 40, j: 40, inventory: { resources: {} } },
    {
      type: 'Chest',
      label: 'interior:player-1:center:default:storage-chest',
      spaceId: 'interior:player-1:center',
      i: 11,
      j: 11,
      inventory: { resources: { wheat: 30, wood: 5 }, equipment: ['hammer'] },
    },
  ]
  const save = serializeGame(context)
  assert.equal(save.players[0].buildings.length, 1)
  const inside = save.players[0].buildings[0].interiorBuildings[0]
  assert.equal(inside.i, 11)
  assert.equal(inside.spaceId, undefined)
  assert.equal(inside.inventory.resources.wheat, 30)
  assert.deepEqual(inside.inventory.equipment, ['hammer'])
  assert.equal(owner.buildings.length, 2)
  assert.equal(owner.buildings[1].spaceId, 'interior:player-1:center')
})

test('captured interiors retain their identity and contents across a save round trip', () => {
  const context = makeContext()
  const owner = context.players[0]
  const oldOwner = 'economy:world-4242-r1-2-temperate:civ-hellas'
  const label = `${oldOwner}:center`
  const interiorPortalId = `${oldOwner}:${label}`
  owner.buildings = [
    { type: 'TownCenter', label, interiorPortalId, i: 40, j: 40 },
    {
      type: 'Chest',
      label: 'captured-chest',
      spaceId: `interior:${interiorPortalId}`,
      i: 11,
      j: 11,
      inventory: { resources: { gold: 42 } },
    },
  ]
  const saved = JSON.parse(JSON.stringify(serializeGame(context)))
  const parent = saved.players[0].buildings[0]
  assert.equal(saved.players[0].buildings.length, 1)
  assert.equal(parent.interiorPortalId, interiorPortalId)
  assert.equal(parent.interiorBuildings[0].inventory.resources.gold, 42)
  const { getBuildingInteriorPortalId } = loadTsModule('app/lib/buildings/interiors.ts')
  assert.equal(getBuildingInteriorPortalId({ ...parent, owner }), interiorPortalId)
  const { normalizeSavedInteriorBuildings } = loadTsModule('app/serialization/InteriorBuildingSave.ts')
  normalizeSavedInteriorBuildings(saved.players[0])
  assert.equal(saved.players[0].buildings[0].interiorBuildings.length, 1)
})

test('stable display horses are saved only as stable stock, not duplicated as outdoor animals', () => {
  const context = makeContext({
    gaia: {
      animals: [
        { type: 'Horse', label: 'interior:player-1:stable:stable-horse:0', i: 11, j: 11 },
        { type: 'Horse', label: 'wild-horse', i: 8, j: 9 },
      ],
    },
  })
  context.players[0].buildings = [
    { type: 'Stable', label: 'stable', i: 40, j: 40, stableHorses: [{ horseColor: 'black' }] },
  ]
  const save = serializeGame(context)
  assert.equal(save.animals.length, 1)
  assert.equal(save.animals[0].label, 'wild-horse')
  assert.deepEqual(save.players[0].buildings[0].stableHorses, [{ horseColor: 'black' }])
})

test('an opened room with no remaining decorations is persisted as empty', () => {
  const context = makeContext()
  context.map.spaces = new Map([['interior:player-1:center', {}]])
  context.players[0].buildings = [{ type: 'TownCenter', label: 'center', i: 40, j: 40, context }]
  const saved = serializeGame(context).players[0].buildings[0]
  assert.deepEqual(saved.interiorBuildings, [])
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

test('serializes production without obsolete research', () => {
  const context = makeContext()
  context.players[0].buildings = [
    {
      label: 'tc-1',
      family: 'building',
      type: 'TownCenter',
      i: 20,
      j: 21,
      queue: ['Villager'],
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
      assetCiv: 'hellas',
      assetAge: 1,
      buildingAge: 0,
      totalHitPoints: 600,
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
    assetCiv: 'hellas',
    assetAge: 1,
    buildingAge: 0,
    totalHitPoints: 600,
    assetType: 'TownCenter',
    inventory: { equipment: ['trap'], resources: { wood: 5 } },
    isUsedBy: 'villager-1',
  })
})

test('saving an unseen static resource does not materialize its sprite', () => {
  const resource = {
    label: 'unseen-tree',
    type: 'Tree',
    i: 1,
    j: 1,
    textureName: 'tree_0',
    quantity: 10,
    deferredSpriteBounds: {},
  }
  Object.defineProperty(resource, 'sprite', { get: () => assert.fail('save should not create visuals') })
  const save = serializeGame(makeContext({ resources: new Set([resource]) }))
  assert.equal(save.resources[0].textureName, 'tree_0')
})

test('cave identity, interior chest state and occupant positions survive serialization', () => {
  const context = makeContext()
  const owner = context.players[0]
  const cave = { id: 'region:cave-1', blueprintId: 'cave-large-loop', tier: 'large', seed: 42 }
  const building = { type: 'Cave', cave, label: 'cave', i: 40, j: 40, context }
  const spaceId = 'interior:player-1:cave'
  context.map.spaces = new Map([
    [spaceId, { kind: 'interior', building, exteriorEntryCell: { i: 41, j: 42, x: 1, y: 2, z: 0 } }],
  ])
  owner.buildings = [
    building,
    { type: 'Chest', label: 'loot', spaceId, i: 30, j: 35, inventory: { equipment: [], resources: { gold: 3 } } },
  ]
  owner.units = [
    {
      type: 'Hero',
      label: 'hero',
      i: 25,
      j: 28,
      spaceId,
      context,
      dest: { i: 26, j: 28 },
      path: [{ i: 26, j: 28 }],
      action: null,
    },
  ]
  const saved = loadSaveSerializer().serializeGame(context)
  assert.deepEqual(saved.players[0].buildings[0].cave, cave)
  assert.equal(saved.players[0].buildings[0].interiorBuildings[0].inventory.resources.gold, 3)
  assert.deepEqual(saved.players[0].units[0].cavePosition, { caveId: cave.id, i: 25, j: 28 })
  assert.equal(saved.players[0].units[0].i, 41)
  assert.equal(owner.units[0].i, 25)
  assert.deepEqual(saved.players[0].units[0].caveOrders.path, [{ i: 26, j: 28 }])
  assert.deepEqual(saved.players[0].units[0].caveOrders.dest.slice(0, 2), [26, 28])
  assert.equal(saved.players[0].units[0].dest, null)
})

test('delivery saves retain job intent using references and omit runtime task ids', () => {
  const context = makeContext()
  const building = { i: 1, j: 2, label: 'store', context }
  const tree = { i: 3, j: 4, label: 'tree', context }
  context.players[0].units = [
    {
      type: 'Villager',
      i: 0,
      j: 0,
      resourceDeliveryState: {
        building,
        phase: 'entering',
        taskId: 123,
        returnTask: { dest: tree, action: 'chopwood', work: 'woodcutter', autonomousJob: 'wood' },
      },
    },
  ]
  const saved = JSON.parse(JSON.stringify(loadSaveSerializer().serializeGame(context)))
  assert.deepEqual(saved.players[0].units[0].resourceDelivery, {
    building: [1, 2, 'store'],
    returnTask: {
      dest: [3, 4, 'tree'],
      action: 'chopwood',
      work: 'woodcutter',
      autonomousJob: 'wood',
    },
  })
})

test('individual daily schedules survive saving and travel without sharing state', () => {
  const { applyPortableUnitState } = loadTsModule('app/screens/game/GameStateHelpers.ts')
  const context = makeContext()
  const dailySchedule = { wakeMinute: 370, workStartMinute: 430, workEndMinute: 1090, bedMinute: 1330 }
  context.players[0].units = [{ type: 'Villager', i: 1, j: 1, dailySchedule }]
  const saved = JSON.parse(JSON.stringify(loadSaveSerializer().serializeGame(context))).players[0].units[0]
  assert.deepEqual(saved.dailySchedule, dailySchedule)
  const target = {}
  applyPortableUnitState(target, saved)
  assert.deepEqual(target.dailySchedule, dailySchedule)
  assert.notEqual(target.dailySchedule, saved.dailySchedule)
})

test('chest villager delivery preference survives serialization including explicit false', () => {
  for (const blocked of [true, false]) {
    const context = makeContext()
    context.players[0].buildings = [{ type: 'Chest', i: 1, j: 1, isBuilt: true, villagerDeliveriesBlocked: blocked }]
    const saved = JSON.parse(JSON.stringify(loadSaveSerializer().serializeGame(context)))
    assert.equal(saved.players[0].buildings[0].villagerDeliveriesBlocked, blocked)
  }
})

test('building placement orientation survives JSON serialization and legacy saves omit it', () => {
  for (const placementMirrored of [true, false, undefined]) {
    const context = makeContext()
    context.players[0].buildings = [{ type: 'Chest', i: 1, j: 1, placementMirrored }]
    const saved = JSON.parse(JSON.stringify(loadSaveSerializer().serializeGame(context)))
    assert.equal(saved.players[0].buildings[0].placementMirrored, placementMirrored)
    const { restorePlayerEntitiesFromSave } = loadTsModule('app/classes/map/MapSaveRestore.ts', {
      mocks: {
        '../../lib/units/playerTargetKnowledge': { restoreTargetKnowledge() {}, restoreLegacyStaticKnowledge() {} },
        '../../lib/resources/playerResourceTotals': { syncPlayerResourceFieldsFromChests() {} },
        './generation/CaveSaveRestore': {},
        './MapSaveReferences': {},
        './MapSaveAI': {},
        '../../../engine/services/BuildingInteriorSpaceSystemRuntime': {},
      },
    })
    const restored = { createBuilding: options => ({ ...options }) }
    restorePlayerEntitiesFromSave(restored, { buildings: saved.players[0].buildings }, true)
    assert.equal(restored.buildings[0].placementMirrored, placementMirrored)
  }
})
