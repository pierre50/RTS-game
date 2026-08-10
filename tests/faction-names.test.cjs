const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadTsModule(filename, moduleCache) {
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
      return loadTsModule(path.resolve(path.dirname(resolved), request), moduleCache)
    }
    return require(request)
  }

  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

function loadFactionsWithLang(lang) {
  global.localStorage = {
    getItem(key) {
      return key === 'lang' ? lang : null
    },
    setItem() {},
  }

  return loadTsModule(path.join(__dirname, '../app/lib/factions.ts'), new Map())
}

test.afterEach(() => {
  delete global.localStorage
})

test('faction name prefixes are translated in French', () => {
  const { createFactionName } = loadFactionsWithLang('fr')

  assert.match(createFactionName('Greek', 'seed2'), /^Maison /)
})

test('faction name prefixes are translated in English', () => {
  const { createFactionName } = loadFactionsWithLang('en')
  const name = createFactionName('Greek', 'seed2')

  assert.match(name, /^House /)
  assert.doesNotMatch(name, /^Maison /)
})
