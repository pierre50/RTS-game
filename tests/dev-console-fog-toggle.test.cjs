const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadMapActions() {
  const filename = path.join(__dirname, '../app/dev-console/actions/map.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })

  const module = { exports: {} }
  const localRequire = request => {
    if (request === '../../lib') {
      return { drawInstanceBlinkingSelection: () => {}, getGaiaAnimals: gaia => gaia?.animals ?? gaia?.units ?? [] }
    }
    if (request === './shared') {
      return {
        getInstancesByCategory: () => [],
        normalize: value => String(value).trim().toLowerCase(),
        normalizeToggle: value => value === 'on',
      }
    }
    return require(request)
  }

  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('fog off refreshes camera minimap immediately', () => {
  const { toggleFog } = loadMapActions()
  let cameraUpdates = 0
  let resourceUpdates = 0
  let terrainRevealCalls = 0
  let terrainRebuildCalls = 0
  let fogQueueClears = 0
  let pendingFogClears = 0

  const context = {
    map: {
      revealEverything: false,
      fogLayer: { visible: true },
      _fogQueue: { clear: () => fogQueueClears++ },
      _pendingFogChunkUpdates: { clear: () => pendingFogClears++ },
      terrainChunkManager: { invalidateAll: () => {} },
      resources: [],
      gaia: { units: [] },
      grid: [],
    },
    menu: {
      revealTerrainMinimap: () => terrainRevealCalls++,
      rebuildTerrainMiniMapFromViews: () => terrainRebuildCalls++,
      updateResourcesMiniMapEvt: () => resourceUpdates++,
      updatePlayerMiniMapEvt: () => {},
      updateCameraMiniMapEvt: () => cameraUpdates++,
    },
    players: [],
    player: { views: { isViewed: () => false } },
    controls: {
      cameraController: { visibleCells: { clear: () => {} } },
      updateVisibleCells: () => {},
    },
  }

  const result = toggleFog(context, 'off')

  assert.deepEqual(result, { ok: true, message: 'Fog of war: off' })
  assert.equal(context.map.revealEverything, true)
  assert.equal(context.map.fogLayer.visible, false)
  assert.equal(terrainRevealCalls, 1)
  assert.equal(terrainRebuildCalls, 0)
  assert.equal(resourceUpdates, 1)
  assert.equal(cameraUpdates, 1)
  assert.equal(fogQueueClears, 1)
  assert.equal(pendingFogClears, 1)
})

test('fog on rebuilds terrain minimap from explored cells', () => {
  const { toggleFog } = loadMapActions()
  let terrainRevealCalls = 0
  let terrainRebuildCalls = 0

  const context = {
    map: {
      revealEverything: true,
      fogLayer: { visible: false },
      mapFog: {
        viewportRenderer: {
          invalidate: () => {},
          update: () => {},
        },
      },
      terrainChunkManager: { invalidateAll: () => {} },
      resources: [],
      gaia: { units: [] },
      grid: [],
    },
    menu: {
      revealTerrainMinimap: () => terrainRevealCalls++,
      rebuildTerrainMiniMapFromViews: () => terrainRebuildCalls++,
      updateResourcesMiniMapEvt: () => {},
      updatePlayerMiniMapEvt: () => {},
      updateCameraMiniMapEvt: () => {},
    },
    players: [],
    player: { views: { isViewed: () => false } },
    controls: {
      cameraController: {
        getViewportRect: () => ({}),
        visibleCells: { clear: () => {} },
      },
      updateVisibleCells: () => {},
    },
  }

  const result = toggleFog(context, 'on')

  assert.deepEqual(result, { ok: true, message: 'Fog of war: on' })
  assert.equal(context.map.revealEverything, false)
  assert.equal(context.map.fogLayer.visible, true)
  assert.equal(terrainRevealCalls, 0)
  assert.equal(terrainRebuildCalls, 1)
})
