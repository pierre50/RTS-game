const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const moduleCache = new Map()
const options = { moduleCache, mocks: { '../../lib/mapSpaces': { getActiveMapSpace: map => map.space } } }
const { MinimapGeometry } = loadTsModule('app/ui/minimap/MinimapGeometry.ts', options)
const { changeMinimapZoom } = loadTsModule('app/ui/minimap/MinimapZoom.ts', options)

for (const rectangular of [false, true]) {
  test(`zoom preserves map center and aligns terrain with markers (${rectangular ? 'rectangle' : 'diamond'})`, () => {
    const context = {
      map: {
        space: {
          id: 'outside',
          size: 32,
          grid: [],
          origin: { x: 0, y: 0 },
          localGridLayout: rectangular ? { columns: 9, rows: 33 } : undefined,
        },
      },
    }
    const geometry = new MinimapGeometry({ context, minimapMap: {} }, () => 1.284 * 4)
    const before = geometry.getMinimapTransform()
    const center = {
      x: before.offsetX + (before.canvasWidth / 2 - 2 * before.translate) * before.factor,
      y: before.offsetY + (before.canvasHeight / 2) * before.factor,
    }
    changeMinimapZoom(context, 1)
    const after = geometry.getMinimapTransform()
    assert.equal(after.factor, before.factor / 1.5)
    assert.notEqual(after.layoutKey, before.layoutKey)
    const cell = { x: center.x + 10, y: center.y + 10 }
    const point = geometry.cellToMinimapPoint(cell, after)
    assert.deepEqual(geometry.instanceToMinimapPoint({ position: cell }, after), point)
    assert.ok(Math.abs(geometry.toMinimapX(center.x, after) + after.translate - after.canvasWidth / 2) < 1e-8)
    assert.ok(Math.abs(geometry.toMinimapY(center.y, after) - after.canvasHeight / 2) < 1e-8)
    if (rectangular) {
      const rect = { left: 0, top: 0, width: 300, height: 300 }
      const result = geometry.getMinimapWorldPoint(
        (point.x / after.canvasWidth) * 324 - 12,
        (point.y / after.canvasHeight) * 328 - 14,
        rect
      )
      assert.ok(Math.abs(result.x - cell.x) < 1e-8)
      assert.ok(Math.abs(result.y - cell.y) < 1e-8)
    }
    changeMinimapZoom(context, -1)
    assert.deepEqual(geometry.getMinimapTransform(), before)
  })
}

for (const rectangular of [false, true]) {
  test(`zoom targets an off-center hero and preserves click coordinates (${rectangular ? 'rectangle' : 'diamond'})`, () => {
    const hero = { position: { x: -100, y: 200 }, spaceId: 'outside' }
    const context = {
      controls: { heroUnit: hero },
      map: {
        space: {
          id: 'outside',
          size: 32,
          grid: [],
          origin: { x: 0, y: 0 },
          localGridLayout: rectangular ? { columns: 9, rows: 33 } : undefined,
        },
      },
    }
    const geometry = new MinimapGeometry({ context, minimapMap: {} }, () => 1.284 * 4)
    const before = geometry.getMinimapTransform()
    const originalHeroPoint = geometry.instanceToMinimapPoint(hero, before)
    for (let step = 0; step < 4; step++) {
      changeMinimapZoom(context, 1)
      const transform = geometry.getMinimapTransform()
      const heroPoint = geometry.instanceToMinimapPoint(hero, transform)
      assert.ok(Math.abs(heroPoint.x - originalHeroPoint.x) < 1e-8)
      assert.ok(Math.abs(heroPoint.y - originalHeroPoint.y) < 1e-8)
      assert.deepEqual(heroPoint, geometry.cellToMinimapPoint(hero.position, transform))
      if (rectangular) {
        const point = geometry.getMinimapWorldPoint(
          (heroPoint.x / transform.canvasWidth) * 324 - 12,
          (heroPoint.y / transform.canvasHeight) * 328 - 14,
          { left: 0, top: 0, width: 300, height: 300 }
        )
        assert.ok(Math.abs(point.x - hero.position.x) < 1e-8)
        assert.ok(Math.abs(point.y - hero.position.y) < 1e-8)
      }
    }
    const previous = geometry.getMinimapTransform()
    hero.position.x += 50
    assert.deepEqual(geometry.getMinimapTransform(), previous, 'movement must not desynchronize terrain and markers')
    geometry.resetZoomAnchor()
    assert.notEqual(
      geometry.getMinimapTransform().layoutKey,
      previous.layoutKey,
      'reopening targets the new hero position'
    )
    hero.spaceId = 'interior:other'
    geometry.resetZoomAnchor()
    const foreignHero = geometry.getMinimapTransform()
    context.controls.heroUnit = null
    geometry.resetZoomAnchor()
    assert.deepEqual(geometry.getMinimapTransform(), foreignHero)
  })
}

test('minimap zoom and filters survive a JSON round trip through player state', () => {
  const { loadTsModule } = require('./helpers/loadTsModule.cjs')
  const options = { moduleCache: new Map() }
  const { getMinimapZoom, changeMinimapZoom } = loadTsModule('app/ui/minimap/MinimapZoom.ts', options)
  const { toggleMinimapMarker, isMinimapMarkerHidden } = loadTsModule('app/ui/minimap/MinimapFilters.ts', options)
  const context = { player: {} }
  changeMinimapZoom(context, 1)
  toggleMinimapMarker(context, 'enemy')
  const restored = JSON.parse(JSON.stringify(context))
  assert.equal(getMinimapZoom(restored), 1.5)
  assert.equal(isMinimapMarkerHidden(restored, 'enemy'), true)
  assert.equal(getMinimapZoom({ player: {} }), 1)
  assert.equal(isMinimapMarkerHidden({ player: {} }, 'enemy'), false)
})
