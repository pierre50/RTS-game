const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { furnishInterior, ensureInteriorDefaultBuildings } = require('./helpers/interiorFurnitureFixture.cjs')
const atlas = require('../public/assets/graphics/structures/decorations/texture.json')
const { getBuildingAsset } = loadTsModule('app/lib/graphics/assets.ts')
const { preservesInteriorPassages } = loadTsModule('app/lib/buildings/interiorFurniturePlacement.ts')

const expectedFurniture = {
  House: [
    'FireCamp',
    'CampSupplyShelf',
    'CampJarLarge',
    'CampArrowBasket',
    'CampBedroll',
    'CampAlchemyTable',
    'CampStumpStool',
    'CampTable',
    'CampBench',
    'CampSquareStool',
  ],
  TownCenter: [
    'FireCamp',
    'Chest',
    'CampBookcase',
    'CampMountedSkull',
    'CampBlueJar',
    'CampJarLarge',
    'CampFruitBowl',
    'CampBrazier',
    'CampThrone',
    'CampArrowBasket',
    'CampBench',
    'CampStumpStool',
    'CampTorchStand',
  ],
  Barracks: ['CampStumpStool', 'CampForge', 'CampBrazier', 'CampTorchStand', 'CampArrowBasket', 'CampBench'],
  Temple: ['CampMountedSkull', 'CampBench', 'CampChair', 'CampBrazier', 'CampTorchStand'],
  Granary: [
    'CampBrazier',
    'Chest',
    'CampSupplyShelf',
    'CampArrowBasket',
    'CampJarLarge',
    'CampJarSmall',
    'CampAppleBasket',
    'CampWorkbench',
    'CampBlueJar',
  ],
  StoragePit: [
    'CampBrazier',
    'Chest',
    'CampSupplyShelf',
    'CampArrowBasket',
    'CampJarLarge',
    'CampSquareStool',
    'CampTable',
    'CampBlueJar',
    'CampJarSmall',
  ],
  Stable: ['CampBucket', 'CampBrazier'],
  WatchTower: ['CampChair', 'CampTorchStand'],
}
const expectedCounts = {
  House: 11,
  TownCenter: 16,
  Barracks: 7,
  Temple: 9,
  Granary: 12,
  StoragePit: 14,
  Stable: 4,
  WatchTower: 2,
}

for (const [type, expected] of Object.entries(expectedFurniture)) {
  test(`${type} has themed furniture, usable textures, and connected passages`, () => {
    const { space, owner, context } = furnishInterior(type)
    const placed = owner.buildings.map(item => item.type)
    assert.equal(placed.length, expectedCounts[type])
    assert.deepEqual([...new Set(placed)].sort(), [...expected].sort())
    for (const item of expected) assert.ok(placed.includes(item), `${type}: missing ${item}`)
    assert.equal(new Set(owner.buildings.map(item => `${item.i}:${item.j}`)).size, owner.buildings.length)
    for (const item of owner.buildings) {
      const cell = space.grid[item.i][item.j]
      assert.ok(!cell.terrainHidden)
      assert.ok(Math.max(Math.abs(item.i - space.exitCell.i), Math.abs(item.j - space.exitCell.j)) > 1)
      const texture = getBuildingAsset(item.assetType || item.type, { age: 0 }, {}).images.final
      assert.equal(texture.sheet, 'buildings/deco')
      assert.ok(Object.values(atlas.frames)[texture.frame], `missing frame for ${item.type}`)
    }
    const free = space.walkableCells.filter(cell => !cell.solid)
    const reached = new Set([space.exitCell])
    const queue = [space.exitCell]
    for (const cell of queue) {
      for (const [di, dj] of [
        [-1, -1],
        [-1, 0],
        [-1, 1],
        [0, -1],
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
      ]) {
        const next = space.grid[cell.i + di]?.[cell.j + dj]
        if (!next || next.border || next.solid || next.terrainHidden || reached.has(next)) continue
        reached.add(next)
        queue.push(next)
      }
    }
    assert.equal(reached.size, free.length, `${type}: isolated floor behind furniture`)
    assert.ok(free.length >= 12, `${type}: insufficient space for occupants`)
    const count = owner.buildings.length
    ensureInteriorDefaultBuildings(context, space)
    assert.equal(owner.buildings.length, count, 'reopening must not duplicate furniture')
  })
}

test('furniture cannot sever a narrow corridor', () => {
  const grid = Array.from({ length: 5 }, (_, i) =>
    Array.from({ length: 5 }, (_, j) => ({
      i,
      j,
      solid: j !== 2,
      border: false,
      category: 'Dirt',
      has: null,
    }))
  )
  assert.equal(preservesInteriorPassages(grid, grid[2][2]), false)
  assert.equal(preservesInteriorPassages(grid, grid[0][2]), true)
})

test('house beds are inside the room and its reversed shelf survives saving in both orientations', () => {
  for (const mirrored of [false, true]) {
    const { owner, space } = furnishInterior('House', undefined, mirrored)
    const beds = owner.buildings.filter(item => item.type === 'CampBedroll')
    assert.equal(beds.length, 2)
    const wallBed = beds.find(item => item.label.endsWith(':bedroll-1'))
    const backBed = beds.find(item => item.label.endsWith(':bedroll-2'))
    assert.deepEqual([wallBed.i, wallBed.j], mirrored ? [11, 6] : [6, 11])
    assert.deepEqual([backBed.i, backBed.j], mirrored ? [8, 6] : [6, 8])
    const { canPlaceBuildingAt } = loadTsModule('app/lib/grid/placement.ts')
    const placementGrid = space.grid.map(row =>
      row.map(cell => ({
        ...cell,
        has: cell.has === wallBed ? null : cell.has,
        solid: cell.has === wallBed ? false : cell.solid,
      }))
    )
    assert.equal(
      canPlaceBuildingAt(placementGrid, wallBed.i, wallBed.j, { type: 'CampBedroll', size: 2 }, { allowBorder: true }),
      true
    )
    for (const bed of beds) {
      assert.equal(space.grid[bed.i][bed.j].terrainHidden, false)
      assert.ok(
        [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ].some(([di, dj]) => {
          const cell = space.grid[bed.i + di]?.[bed.j + dj]
          return cell && !cell.solid && !cell.border && !cell.terrainHidden
        }),
        'a sleeper must have an open approach to each bed'
      )
    }
    const saved = JSON.parse(JSON.stringify(owner.buildings))
    const restored = furnishInterior('House', saved, mirrored)
    const shelf = restored.owner.buildings.find(item => item.type === 'CampSupplyShelf')
    assert.equal(getBuildingAsset(shelf.assetType, {}, {}).mirrored, true)
    assert.equal(shelf.placementMirrored, mirrored)
    assert.equal(restored.owner.buildings.filter(item => item.type === 'CampBedroll').length, 2)
  }
})

test('saved automatic house beds return to the back wall without moving a manual bed', () => {
  for (const mirrored of [false, true]) {
    const fresh = furnishInterior('House', undefined, mirrored)
    const saved = JSON.parse(JSON.stringify(fresh.owner.buildings))
    const second = saved.find(item => item.label.endsWith(':bedroll-2'))
    Object.assign(second, mirrored ? { i: 8, j: 12 } : { i: 12, j: 8 })
    second.hitPoints = 17
    saved.push({ type: 'CampBedroll', label: 'manual-bed', i: 11, j: 11, placementMirrored: !mirrored })
    const restored = furnishInterior('House', saved, mirrored)
    const beds = restored.owner.buildings.filter(item => item.type === 'CampBedroll')
    assert.equal(beds.length, 3)
    const moved = beds.find(item => item.label === second.label)
    assert.deepEqual([moved.i, moved.j], mirrored ? [8, 6] : [6, 8])
    assert.equal(moved.hitPoints, 17)
    const manual = beds.find(item => item.label === 'manual-bed')
    assert.deepEqual([manual.i, manual.j, manual.placementMirrored], [11, 11, !mirrored])
    ensureInteriorDefaultBuildings(restored.context, restored.space)
    assert.equal(restored.owner.buildings.filter(item => item.type === 'CampBedroll').length, 3)
  }
})

test('real placement rules keep generated house beds separated along the back wall with complete floor support', () => {
  const { ensureInteriorDefaultBuildings: furnish } = loadTsModule(
    'engine/services/BuildingInteriorSpaceDecorations.ts'
  )
  const { getBuildingFootprintCells } = loadTsModule('app/lib/grid/cells.ts')
  const { getInteriorRoomCenter } = loadTsModule('app/lib/buildings/interiorFurniturePlacement.ts')
  for (const mirrored of [false, true]) {
    const { owner, space, context } = furnishInterior('House', undefined, mirrored)
    owner.buildings = []
    for (const cell of space.grid.flat()) {
      cell.has = null
      cell.solid = cell.terrainHidden
    }
    space.defaultBuildingsPlaced = false
    furnish(context, space)
    const beds = owner.buildings.filter(item => item.type === 'CampBedroll')
    assert.equal(beds.length, 2)
    const center = getInteriorRoomCenter(space)
    const axis = mirrored ? 'j' : 'i'
    assert.equal(beds[0][axis], center[axis] - 3)
    assert.equal(beds[1][axis], center[axis] - 3)
    const alongWall = mirrored ? 'i' : 'j'
    assert.equal(beds[0][alongWall], center[alongWall] + 2)
    assert.equal(beds[1][alongWall], center[alongWall] - 1)
    const footprints = beds.map(bed => getBuildingFootprintCells(bed.i, bed.j, space.grid, 2, undefined, bed.type))
    for (let index = 0; index < beds.length; index++) {
      assert.equal(footprints[index].length, 4)
      assert.ok(footprints[index].every(cell => !cell.terrainHidden && cell.has === beds[index]))
    }
    assert.ok(footprints[0].every(cell => !footprints[1].includes(cell)))
  }
})

test('furniture groups follow the new straight walls and keep the door approach clear', () => {
  const checks = {
    House: [
      ['CampSupplyShelf', 8, 5],
      ['CampTable', 12, 9],
      ['CampAlchemyTable', 10, 5],
    ],
    TownCenter: [
      ['FireCamp', 11, 11],
      ['Chest', 6, 11],
      ['CampThrone', 11, 6],
    ],
    Stable: [
      ['CampBucket', 7, 8],
      ['CampBucket', 15, 10],
    ],
  }
  for (const [type, expected] of Object.entries(checks)) {
    const { owner } = furnishInterior(type)
    for (const [furniture, i, j] of expected) {
      assert.ok(
        owner.buildings.some(item => item.type === furniture && item.i === i && item.j === j),
        `${type}: ${furniture} at ${i},${j}`
      )
    }
  }
})

test('hides and rugs render on the floor without occupying cells or intercepting input', () => {
  const { addInteriorFloorDecorations } = loadTsModule('app/lib/graphics/interiorFloorDecorations.ts', {
    mocks: {
      'pixi.js': {
        Assets: {},
        Sprite: class {
          constructor(texture) {
            this.texture = texture
            this.scale = { x: 1, y: 1 }
            this.anchor = {
              set: (x, y) => {
                this.anchor.x = x
                this.anchor.y = y
              },
            }
          }
        },
      },
      './textures': {
        getTextureByFrame: (sheet, frame) => ({
          sheet,
          frame,
          defaultAnchor: Object.values(atlas.frames)[frame].anchor,
        }),
      },
    },
  })
  for (const [type, expectedCount] of Object.entries({
    House: 0,
    TownCenter: 5,
    Barracks: 1,
    Temple: 3,
    WatchTower: 1,
    Stable: 0,
    Granary: 0,
  })) {
    const { space } = furnishInterior(type)
    const heroChildren = []
    addInteriorFloorDecorations(furnishInterior(type, undefined, false, { type: 'Human' }).space, {
      addChild: child => heroChildren.push(child),
    })
    assert.equal(heroChildren.length, 0, `${type}: hero rooms have no preset rugs`)
    const before = space.grid.flat().map(cell => ({ has: cell.has, solid: cell.solid }))
    const children = []
    addInteriorFloorDecorations(space, { addChild: child => children.push(child) })
    assert.equal(children.length, expectedCount, type)
    const reflected = []
    addInteriorFloorDecorations(furnishInterior(type, undefined, true).space, {
      addChild: child => reflected.push(child),
    })
    assert.ok(children.every(child => child.scale.x === 1))
    assert.ok(reflected.every(child => child.scale.x === -1))
    assert.deepEqual(
      reflected.map(child => [child.texture.frame, child.x, child.y]),
      children.map(child => [child.texture.frame, -child.x || 0, child.y]),
      `${type}: reflected floor decorations`
    )
    assert.deepEqual(
      space.grid.flat().map(cell => ({ has: cell.has, solid: cell.solid })),
      before
    )
    for (const child of children) {
      assert.equal(child.eventMode, 'none')
      assert.equal(child.label, 'interior-floor-decoration')
      assert.ok(child.zIndex > space.size * 2)
      assert.ok([17, 18, 41].includes(child.texture.frame))
    }
  }
})

test('saved furniture outside the new room or at its doorway is relocated with its inventory', () => {
  const saved = [
    { type: 'Chest', label: 'saved-chest', i: 5, j: 5, inventory: { resources: { wood: 37 } } },
    { type: 'CampBench', label: 'saved-bench', i: 9, j: 13 },
  ]
  const { owner, space } = furnishInterior('House', saved)
  assert.equal(owner.buildings.length, 2)
  assert.deepEqual(owner.buildings[0].inventory, saved[0].inventory)
  for (const item of owner.buildings) {
    assert.equal(space.grid[item.i][item.j].terrainHidden, false)
    assert.ok(Math.max(Math.abs(item.i - space.exitCell.i), Math.abs(item.j - space.exitCell.j)) > 1)
  }
  assert.equal(space.exitCell.solid, false)
  assert.equal(space.building.interiorBuildings, undefined)
})

test('only the TownCenter chest uses the mirrored asset and retains it on restore', () => {
  const { owner } = furnishInterior('TownCenter')
  const chest = owner.buildings.find(item => item.type === 'Chest')
  assert.equal(chest.assetType, 'InteriorMirroredChest')
  assert.equal(getBuildingAsset(chest.assetType, { age: 0 }, {}).mirrored, true)
  const saved = [{ ...chest, inventory: { resources: { wood: 37 } } }]
  const restored = furnishInterior('TownCenter', saved).owner.buildings[0]
  assert.equal(restored.type, 'Chest')
  assert.equal(restored.assetType, chest.assetType)
  assert.deepEqual(restored.inventory, saved[0].inventory)
  for (const type of ['Granary', 'StoragePit']) {
    const ordinary = furnishInterior(type).owner.buildings.find(item => item.type === 'Chest')
    assert.equal(ordinary.assetType, undefined)
    assert.notEqual(getBuildingAsset(ordinary.type, { age: 0 }, {}).mirrored, true)
  }
})

test('mirrored rooms reflect furniture placement and restore saved positions without a second reflection', () => {
  for (const type of Object.keys(expectedFurniture)) {
    const normal = furnishInterior(type)
    const mirrored = furnishInterior(type, undefined, true)
    assert.deepEqual(
      mirrored.owner.buildings.map(({ type, i, j }) => ({ type, i, j })),
      normal.owner.buildings.map(({ type, i, j }) => ({ type, i: j, j: i })),
      type
    )
    assert.ok(
      normal.owner.buildings.every(item => item.placementMirrored === false),
      type
    )
    assert.ok(
      mirrored.owner.buildings.every(item => item.placementMirrored === true),
      type
    )
    const saved = JSON.parse(JSON.stringify(mirrored.owner.buildings))
    // Reproduce saves made before sprites inherited the room mirror.
    saved.forEach(item => {
      delete item.placementMirrored
    })
    const restored = furnishInterior(type, saved, true)
    assert.ok(
      restored.owner.buildings.every(item => item.placementMirrored === true),
      type
    )
    const reloaded = furnishInterior(type, JSON.parse(JSON.stringify(restored.owner.buildings)), true)
    assert.ok(
      reloaded.owner.buildings.every(item => item.placementMirrored === true),
      type
    )
    assert.deepEqual(
      restored.owner.buildings.map(({ type, i, j }) => ({ type, i, j })),
      mirrored.owner.buildings.map(({ type, i, j }) => ({ type, i, j })),
      `${type}: restored furniture`
    )
  }
})

test('restoring a mirrored interior retains the orientation of manually placed furniture', () => {
  const saved = [{ type: 'CampTable', label: 'player-table', i: 9, j: 9, placementMirrored: false }]
  const { owner } = furnishInterior('House', saved, true)
  assert.equal(owner.buildings[0].placementMirrored, false)
})

test('depots and stables have separated lights in both orientations and retrofit old rooms without duplication', () => {
  for (const [type, prefix, count] of [
    ['Granary', 'depot-light-', 3],
    ['StoragePit', 'depot-light-', 3],
    ['Stable', 'stable-light-', 2],
  ])
    for (const mirrored of [false, true]) {
      const fresh = furnishInterior(type, undefined, mirrored)
      const lights = fresh.owner.buildings.filter(item => item.label.includes(`:default:${prefix}`))
      assert.equal(lights.length, count)
      for (let a = 0; a < lights.length; a++)
        for (let b = a + 1; b < lights.length; b++)
          assert.ok(Math.hypot(lights[a].i - lights[b].i, lights[a].j - lights[b].j) >= 3)
      const saved = fresh.owner.buildings
        .filter(item => !item.label.includes(`:default:${prefix}`))
        .map(item => ({ ...item }))
      const restored = furnishInterior(type, saved, mirrored)
      assert.equal(restored.owner.buildings.filter(item => item.label.includes(`:default:${prefix}`)).length, count)
      ensureInteriorDefaultBuildings(restored.context, restored.space)
      assert.equal(restored.owner.buildings.length, fresh.owner.buildings.length)
      const reloaded = furnishInterior(type, JSON.parse(JSON.stringify(restored.owner.buildings)), mirrored)
      assert.equal(reloaded.owner.buildings.length, fresh.owner.buildings.length)
    }
})

for (const type of Object.keys(expectedFurniture)) {
  test(`${type}: hero interiors provide basic furnishings without extra decoration`, () => {
    const fresh = furnishInterior(type, undefined, false, { type: 'Human', isPlayed: true })
    const expected =
      type === 'House'
        ? ['FireCamp', 'CampBedroll', 'CampBedroll']
        : type === 'TownCenter'
          ? ['FireCamp']
          : ['Granary', 'StoragePit'].includes(type)
            ? ['Chest']
            : []
    assert.deepEqual(
      fresh.owner.buildings.map(item => item.type),
      expected
    )
    const saved = fresh.owner.buildings.map(item => ({ ...item }))
    const reloaded = furnishInterior(type, saved, false, { type: 'Human', isPlayed: true })
    assert.deepEqual(
      reloaded.owner.buildings.map(item => item.type),
      expected
    )
  })
}

test('hero house beds and fires use the AI positions in both building orientations', () => {
  for (const type of ['House', 'TownCenter']) {
    for (const mirrored of [false, true]) {
      const ai = furnishInterior(type, undefined, mirrored)
      const human = furnishInterior(type, undefined, mirrored, { type: 'Human', isPlayed: true })
      for (const item of human.owner.buildings) {
        const reference = ai.owner.buildings.find(building => building.label === item.label)
        assert.ok(reference)
        assert.deepEqual(
          [item.i, item.j, item.placementMirrored],
          [reference.i, reference.j, reference.placementMirrored]
        )
      }
      const count = human.owner.buildings.length
      ensureInteriorDefaultBuildings(human.context, human.space)
      assert.equal(human.owner.buildings.length, count)
    }
  }
})

test('hero rooms preserve manually placed furniture and chest contents on reload', () => {
  const saved = [
    { type: 'CampTable', label: 'table', i: 9, j: 9, placementMirrored: true },
    { type: 'Chest', label: 'chest', i: 7, j: 7, inventory: { resources: { wood: 37 } } },
  ]
  const restored = furnishInterior('House', saved, false, { type: 'Human', isPlayed: true })
  assert.equal(restored.owner.buildings.length, 2)
  assert.equal(restored.owner.buildings[0].placementMirrored, true)
  assert.deepEqual(restored.owner.buildings[1].inventory, saved[1].inventory)
})

test('catalogue covers every preset furnishing and all floor decoration frames', () => {
  const { INTERIOR_FURNITURE_TYPES } = loadTsModule('app/lib/buildings/interiorFurnitureCatalog.ts')
  const { getBuildingInteriorDecorationLayout } = loadTsModule('app/lib/buildings/interiorDecorations.ts')
  const { getInteriorFloorDecorations } = loadTsModule('app/lib/buildings/interiorFloorDecorations.ts')
  for (const type of Object.keys(expectedFurniture)) {
    for (const item of getBuildingInteriorDecorationLayout({ type }))
      assert.ok(INTERIOR_FURNITURE_TYPES.includes(item.type))
    for (const item of getInteriorFloorDecorations(type)) {
      assert.ok(
        INTERIOR_FURNITURE_TYPES.some(type => getBuildingAsset(type, { age: 0 }, {}).images.final.frame === item.frame)
      )
    }
  }
})

test('interior preset policy persists independently from current ownership', () => {
  const { usesInteriorPreset } = loadTsModule('app/lib/buildings/interiorFurnitureCatalog.ts')
  assert.equal(usesInteriorPreset({ interiorUnfurnished: true, owner: { type: 'AI' } }), false)
  assert.equal(usesInteriorPreset({ interiorUnfurnished: false, owner: { type: 'Human' } }), true)
})

test('customized interiors do not regenerate removed furniture when reloaded', () => {
  for (const type of ['StoragePit', 'Granary', 'Stable', 'House', 'TownCenter']) {
    const fresh = furnishInterior(type)
    const removed = fresh.owner.buildings.find(item => item.type !== 'Chest')
    assert.ok(removed, type)
    const saved = JSON.parse(JSON.stringify(fresh.owner.buildings.filter(item => item !== removed)))
    const restored = furnishInterior(type, saved, false, {}, { interiorUnfurnished: true })
    assert.deepEqual(
      restored.owner.buildings.map(item => item.label).sort(),
      saved.map(item => item.label).sort(),
      type
    )
    assert.equal(
      restored.owner.buildings.some(item => item.label === removed.label),
      false
    )
  }
})

test('prepared house beds materialize with their assigned IDs after changing to a human owner', () => {
  const ids = ['interior:House:default:bedroll-1', 'interior:House:default:bedroll-2']
  for (const mirrored of [false, true]) {
    const { owner, space } = furnishInterior(
      'House',
      undefined,
      mirrored,
      { type: 'Human', isPlayed: true },
      { plannedBedLabels: ids }
    )
    assert.deepEqual(
      owner.buildings
        .filter(b => b.type === 'CampBedroll')
        .map(b => b.label)
        .sort(),
      ids
    )
    assert.equal(space.building.plannedBedLabels, undefined)
  }
})
