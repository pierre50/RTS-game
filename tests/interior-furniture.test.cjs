const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { furnishInterior, ensureInteriorDefaultBuildings } = require('./helpers/interiorFurnitureFixture.cjs')
const atlas = require('../public/assets/graphics/buildings/deco/texture.json')
const { getBuildingAsset } = loadTsModule('app/lib/graphics/assets.ts')
const { preservesInteriorPassages } = loadTsModule('app/lib/buildings/interiorFurniturePlacement.ts')

const expectedFurniture = {
  House: [
    'FireCamp',
    'CampSupplyShelf',
    'CampJarLarge',
    'CampArrowBasket',
    'CampScreen',
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
    'Chest',
    'CampSupplyShelf',
    'CampArrowBasket',
    'CampJarLarge',
    'CampSquareStool',
    'CampTable',
    'CampBlueJar',
    'CampJarSmall',
  ],
  Stable: ['CampBucket'],
  WatchTower: ['CampChair', 'CampTorchStand'],
}
const expectedCounts = {
  House: 10,
  TownCenter: 16,
  Barracks: 7,
  Temple: 9,
  Granary: 9,
  StoragePit: 11,
  Stable: 2,
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

test('furniture groups follow the new straight walls and keep the door approach clear', () => {
  const checks = {
    House: [
      ['CampSupplyShelf', 5, 8],
      ['CampTable', 5, 10],
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
    House: 4,
    TownCenter: 5,
    Barracks: 1,
    Temple: 3,
    WatchTower: 1,
    Stable: 0,
    Granary: 0,
  })) {
    const { space } = furnishInterior(type)
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
