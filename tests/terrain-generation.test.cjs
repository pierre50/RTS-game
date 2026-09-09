const test = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const { createHash } = require('node:crypto')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { generateTerrainMap, createTerrainWorkerSource } = loadTsModule(
  'app/classes/map/terrain/MapTerrainGeneration.ts'
)
const { ENVIRONMENT_TERRAIN_PARAMS } = loadTsModule('app/constants/environments.ts')
const fixtures = require('./fixtures/terrain-generation.json')

for (const fixture of fixtures) {
  test(`terrain remains reproducible: ${fixture.environment}, ${fixture.size}, seed ${fixture.seed}`, () => {
    const params = ENVIRONMENT_TERRAIN_PARAMS[fixture.environment]
    const result = generateTerrainMap(fixture.size, fixture.seed, params)
    assert.equal(createHash('sha256').update(JSON.stringify(result)).digest('hex'), fixture.hash)
    let workerResult
    const self = {
      postMessage(value) {
        workerResult = value
      },
    }
    vm.runInNewContext(createTerrainWorkerSource(), { self })
    self.onmessage({ data: { gridSize: fixture.size, seed: fixture.seed, params } })
    assert.equal(JSON.stringify(workerResult), JSON.stringify(result))
  })
}

test('worker stays self-contained after the production Babel transforms', () => {
  const fs = require('node:fs')
  const path = require('node:path')
  const babel = require('@babel/core')
  const cache = new Map()
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports
    const module = { exports: {} }
    cache.set(filename, module)
    const { code } = babel.transformFileSync(filename, {
      babelrc: false,
      configFile: false,
      presets: ['@babel/preset-env', '@babel/preset-typescript'],
    })
    new Function('module', 'exports', 'require', code)(module, module.exports, request =>
      load(path.resolve(path.dirname(filename), request + '.ts'))
    )
    return module.exports
  }
  const production = load(path.resolve(__dirname, '../app/classes/map/terrain/MapTerrainGeneration.ts'))
  const source = production.createTerrainWorkerSource()
  for (const fixture of fixtures) {
    let result
    const self = {
      postMessage(value) {
        result = value
      },
    }
    vm.runInNewContext(source, { self })
    self.onmessage({
      data: {
        gridSize: fixture.size,
        seed: fixture.seed,
        params: ENVIRONMENT_TERRAIN_PARAMS[fixture.environment],
      },
    })
    assert.equal(createHash('sha256').update(JSON.stringify(result)).digest('hex'), fixture.hash)
  }
})
