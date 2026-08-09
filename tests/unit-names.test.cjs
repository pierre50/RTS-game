const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

const moduleCache = new Map()

function loadTsModule(filename) {
  const resolved = filename.endsWith('.ts') ? filename : `${filename}.ts`
  if (moduleCache.has(resolved)) return moduleCache.get(resolved).exports

  const source = fs.readFileSync(resolved, 'utf8')
  const { code } = babel.transformSync(source, {
    filename: resolved,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })

  const module = { exports: {} }
  moduleCache.set(resolved, module)

  const localRequire = request => {
    if (request.startsWith('.')) {
      return loadTsModule(path.resolve(path.dirname(resolved), request))
    }
    return require(request)
  }

  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('Roman unit names use female pool when gender is female', () => {
  const { getRandomUnitName } = loadTsModule(path.join(__dirname, '../app/config/name/index.ts'))

  assert.equal(getRandomUnitName('Roman', 'male', () => 0.74), 'Rufus')
  assert.equal(getRandomUnitName('Roman', 'female', () => 0), 'Aelia')
})
