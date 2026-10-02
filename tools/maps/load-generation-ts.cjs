const path = require('node:path')
const fs = require('node:fs')
const babel = require('@babel/core')
const cache = new Map()
const sources = new Set()

// Only pure generation modules belong here; no browser or graphics mocks.
function loadGenerationTs(filename) {
  filename = path.resolve(__dirname, '../..', filename)
  filename =
    [filename, `${filename}.ts`, `${filename}.json`, path.join(filename, 'index.ts')].find(
      candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
    ) ?? filename
  sources.add(filename)
  if (filename.endsWith('.json')) return require(filename)
  if (cache.has(filename)) return cache.get(filename).exports
  const module = { exports: {} }
  cache.set(filename, module)
  const { code } = babel.transformFileSync(filename, {
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const localRequire = request =>
    request.startsWith('.') ? loadGenerationTs(path.resolve(path.dirname(filename), request)) : require(request)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}
module.exports = { loadGenerationTs, generationSources: () => [...sources].sort() }
