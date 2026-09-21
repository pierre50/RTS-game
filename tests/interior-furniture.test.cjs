const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { furnishInterior, ensureInteriorDefaultBuildings } = require('./helpers/interiorFurnitureFixture.cjs')
const atlas = require('../public/assets/graphics/buildings/deco/texture.json')
const { getBuildingAsset } = loadTsModule('app/lib/graphics/assets.ts')
const { preservesInteriorPassages } = loadTsModule('app/lib/buildings/interiorFurniturePlacement.ts')

const expectedFurniture = {
  House: ['FireCamp', 'CampBookcase', 'CampJarLarge', 'CampAlchemyTable', 'CampSquareStool', 'CampTable', 'CampBench'],
  TownCenter: [
    'FireCamp',
    'Chest',
    'CampSupplyShelf',
    'CampThrone',
    'CampTorchStand',
    'CampSquareStool',
    'CampBench',
    'CampBlueJar',
  ],
  Barracks: ['CampStumpStool', 'CampForge', 'CampBrazier', 'CampTorchStand', 'CampArrowBasket', 'CampBench'],
  ArcheryRange: ['CampBookcase', 'CampArrowBasket', 'CampWeavingTable', 'CampJarLarge'],
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
  House: 7,
  TownCenter: 10,
  Barracks: 7,
  ArcheryRange: 5,
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
      const texture = getBuildingAsset(item.type, { age: 0 }, {}).images.final
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

test('reference furniture stays on its intended edge cells without being scattered inward', () => {
  const checks = {
    House: [
      ['CampBookcase', 5, 10],
      ['CampTable', 8, 12],
      ['CampAlchemyTable', 6, 5],
    ],
    TownCenter: [
      ['FireCamp', 10, 10],
      ['Chest', 6, 7],
      ['CampThrone', 10, 6],
    ],
    ArcheryRange: [
      ['CampBookcase', 5, 9],
      ['CampBookcase', 5, 10],
      ['CampWeavingTable', 10, 8],
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
    TownCenter: 6,
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
