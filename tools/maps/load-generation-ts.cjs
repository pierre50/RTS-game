const path = require('node:path')
const babel = require('@babel/core')
const cache = new Map()

// Only pure generation modules belong here; no browser or graphics mocks.
function loadGenerationTs(filename) {
  filename = path.resolve(__dirname, '../..', filename)
  if (cache.has(filename)) return cache.get(filename).exports
  const module = { exports: {} }
  cache.set(filename, module)
  const { code } = babel.transformFileSync(filename, {
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const localRequire = request =>
    request.startsWith('.') ? loadGenerationTs(path.resolve(path.dirname(filename), request + '.ts')) : require(request)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}
module.exports = { loadGenerationTs }
