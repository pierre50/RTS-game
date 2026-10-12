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
      player: { minimapPreferences: { zoom: 1, hiddenMarkers: [] } },
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
    assert.ok(Math.abs(originalHeroPoint.x + before.translate - before.canvasWidth / 2) < 1e-8)
    assert.ok(Math.abs(originalHeroPoint.y - before.canvasHeight / 2) < 1e-8)
    changeMinimapZoom(context, -1)
    changeMinimapZoom(context, -1)
    changeMinimapZoom(context, -1)
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
  changeMinimapZoom(context, -1)
  toggleMinimapMarker(context, 'enemy')
  const restored = JSON.parse(JSON.stringify(context))
  assert.equal(getMinimapZoom(restored), 3)
  assert.equal(isMinimapMarkerHidden(restored, 'enemy'), true)
  assert.equal(getMinimapZoom({ player: {} }), 4)
  assert.equal(isMinimapMarkerHidden({ player: {} }, 'enemy'), false)
})

for (const rectangular of [false, true]) {
  test(`panning preserves the cursor center across smooth zoom and recenters on request (${rectangular})`, () => {
    const { setMinimapZoom } = loadTsModule('app/ui/minimap/MinimapZoom.ts', options)
    const hero = { position: { x: 0, y: 1000 }, spaceId: 'outside' }
    const context = {
      player: {},
      controls: { heroUnit: hero },
      map: {
        space: {
          id: 'outside',
          size: 100,
          grid: [],
          origin: { x: 125, y: -60 },
          localGridLayout: rectangular ? { columns: 30, rows: 100 } : undefined,
        },
      },
    }
    const geometry = new MinimapGeometry({ context, minimapMap: {} }, () => 1.284 * 4)
    const rect = { left: 15, top: 30, width: 450, height: rectangular ? 450 : 225 }
    const center = () => geometry.getMinimapWorldPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, rect)
    assert.deepEqual(center(), { x: 125, y: 940 })
    geometry.pan(0.1, 0.1)
    const moved = center()
    assert.ok(moved.x > 125 && moved.y > 940)
    setMinimapZoom(context, 2.375)
    const zoomed = center()
    assert.ok(Math.abs(moved.x - zoomed.x) < 1e-8)
    assert.ok(Math.abs(moved.y - zoomed.y) < 1e-8)
    geometry.pan(1e8, 1e8)
    const edge = center()
    geometry.pan(1, 1)
    assert.deepEqual(center(), edge, 'panning is bounded')
    geometry.resetZoomAnchor()
    assert.deepEqual(center(), { x: 125, y: 940 })
  })
}

test('continuous trigger zoom stays bounded, steps correctly, and remains saveable', () => {
  const { setMinimapZoom, getMinimapZoom, changeMinimapZoom } = loadTsModule('app/ui/minimap/MinimapZoom.ts', options)
  const { validateMinimapPreferences } = loadTsModule('app/serialization/validation/MinimapMemoryValidation.ts')
  const context = { player: {} }
  setMinimapZoom(context, 2.375)
  validateMinimapPreferences(JSON.parse(JSON.stringify(context.player.minimapPreferences)))
  assert.equal(changeMinimapZoom(context, 1), 3)
  setMinimapZoom(context, 2.375)
  assert.equal(changeMinimapZoom(context, -1), 2)
  assert.equal(setMinimapZoom(context, 100), 4)
  assert.equal(setMinimapZoom(context, -100), 1)
  assert.equal(getMinimapZoom(context), 1)
})
