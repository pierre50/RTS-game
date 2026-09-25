const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const calls = []
const { teleportHeroFromMinimap } = loadTsModule('app/ui/minimap/MinimapTeleport.ts', {
  mocks: {
    '../../lib/mapSpaces': {
      getActiveMapSpace: map => map.space,
      getEntitySpaceId: hero => hero.spaceId,
    },
    '../../lib/maths': { isometricToCartesian: (x, y) => [x, y] },
    '../../lib/grid/visibility': { updateInstanceVisibility: () => calls.push('vision') },
    '../../lib/units/unitPlacement': {
      teleportRuntimeUnitToCell: (_map, hero, cell) => {
        calls.push(cell)
        hero.x = cell.i
        hero.y = cell.j
      },
    },
  },
})
function fixture() {
  calls.length = 0
  const grid = Array.from({ length: 5 }, (_, i) => Array.from({ length: 5 }, (_, j) => ({ i, j })))
  const hero = { spaceId: 'inside', stop: () => calls.push('stop') }
  return {
    context: {
      menu: { closeInventory: () => calls.push('close') },
      map: { space: { id: 'inside', grid, size: 4, origin: { x: 100, y: 200 } } },
      controls: { heroUnit: hero, setCamera: (x, y) => calls.push([x, y]) },
    },
    minimapManager: { refreshMiniMap: () => calls.push('minimap') },
  }
}
test('teleport uses active-space coordinates and refreshes hero vision, camera and minimap, then closes the menu', () => {
  const menu = fixture()
  teleportHeroFromMinimap(menu, { x: 102, y: 203 })
  assert.deepEqual(calls, ['stop', menu.context.map.space.grid[2][3], 'vision', [102, 203], 'minimap', 'close'])
})
test('blocked destination chooses nearby land', () => {
  const menu = fixture()
  menu.context.map.space.grid[2][3].solid = true
  teleportHeroFromMinimap(menu, { x: 102, y: 203 })
  assert.notEqual(calls[1], menu.context.map.space.grid[2][3])
  assert.equal(calls[1].solid, undefined)
})
test('invalid space, dead hero, outside clicks and all-water destinations do not teleport', () => {
  for (const change of [
    menu => {
      menu.context.controls.heroUnit.spaceId = 'outside'
    },
    menu => {
      menu.context.controls.heroUnit.isDead = true
    },
    menu => {
      menu.context.map.space.grid.flat().forEach(cell => {
        cell.category = 'Water'
      })
    },
  ]) {
    const menu = fixture()
    change(menu)
    teleportHeroFromMinimap(menu, { x: 102, y: 203 })
    assert.deepEqual(calls, [])
  }
  const menu = fixture()
  teleportHeroFromMinimap(menu, { x: -100, y: 203 })
  assert.deepEqual(calls, [])
})
