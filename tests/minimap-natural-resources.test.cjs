const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const moduleCache = new Map()
const { CompactResourceSet } = loadTsModule('app/classes/resources/CompactResourceSet.ts', { moduleCache })
const { MinimapNaturalResources } = loadTsModule('app/ui/minimap/MinimapNaturalResources.ts', { moduleCache })

test('zoomed natural resource markers respect discovery and space without materializing compact resources', () => {
  const resources = new CompactResourceSet(
    10,
    10,
    'test',
    () => ({}),
    () => assert.fail('resource materialized'),
    {}
  )
  resources.addState({ i: 1, j: 1, type: 'Tree', textureName: 'tree_0' })
  resources.addState({ i: 4, j: 1, type: 'Gold', textureName: 'gold_0' })
  let seen = false
  const menu = {
    context: {
      map: { resources, revealEverything: false },
      player: {
        minimapPreferences: { zoom: 1, hiddenMarkers: [] },
        views: { isViewed: () => seen, isVisible: () => false },
      },
    },
  }
  const geometry = { toMinimapX: x => x + 100, toMinimapY: y => y }
  const transform = { layoutKey: 'one', translate: 0, canvasWidth: 500, canvasHeight: 500 }
  const dots = []
  const ctx = {
    save() {},
    restore() {},
    fillRect() {
      dots.push([this.fillStyle, this.globalAlpha])
    },
  }
  new MinimapNaturalResources().draw(menu, geometry, transform, 'outside', ctx)
  assert.deepEqual(dots, [])
  menu.context.player.minimapPreferences.zoom = 3
  new MinimapNaturalResources().draw(menu, geometry, transform, 'outside', ctx)
  assert.deepEqual(dots, [])
  seen = true
  new MinimapNaturalResources().draw(menu, geometry, transform, 'outside', ctx)
  assert.deepEqual(dots, [
    ['#448c45', 0.45],
    ['#e5bb45', 0.45],
  ])
  dots.length = 0
  menu.context.map.revealEverything = true
  new MinimapNaturalResources().draw(menu, geometry, transform, 'outside', ctx)
  assert.deepEqual(dots, [
    ['#448c45', 0.9],
    ['#e5bb45', 0.9],
  ])
  dots.length = 0
  new MinimapNaturalResources().draw(menu, geometry, transform, 'interior:test', ctx)
  assert.deepEqual(dots, [])
})
