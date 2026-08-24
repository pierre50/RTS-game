const fs = require('node:fs')
const path = require('node:path')
const babel = require('@babel/core')

function ensureBrowserTestGlobals() {
  global.window = global.window || {}
  global.window.innerWidth = global.window.innerWidth || 1024
  global.window.innerHeight = global.window.innerHeight || 768
  global.window.matchMedia = global.window.matchMedia || (() => ({ matches: false }))
  global.window.addEventListener = global.window.addEventListener || (() => {})
  global.window.removeEventListener = global.window.removeEventListener || (() => {})
  global.window.setTimeout = global.window.setTimeout || setTimeout
  global.window.clearTimeout = global.window.clearTimeout || clearTimeout
  global.localStorage =
    global.localStorage ||
    {
      getItem: () => null,
      removeItem: () => {},
      setItem: () => {},
    }
}

function resolveLocalModule(request, parentFilename) {
  if (!request.startsWith('.')) return require.resolve(request)

  const base = path.resolve(path.dirname(parentFilename), request)
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.js`,
    `${base}.json`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.js'),
  ]
  const filename = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
  if (!filename) return require.resolve(request)
  return filename
}

function loadTsModule(relativePath, { baseDir = path.join(__dirname, '..', '..'), mocks = {}, moduleCache = new Map() } = {}) {
  ensureBrowserTestGlobals()
  const filename = path.isAbsolute(relativePath) ? relativePath : path.join(baseDir, relativePath)
  if (moduleCache.has(filename)) return moduleCache.get(filename).exports

  if (filename.includes(`${path.sep}node_modules${path.sep}`)) return require(filename)
  if (filename.endsWith('.json')) return require(filename)
  if (!filename.endsWith('.ts') && !filename.endsWith('.js') && !filename.endsWith('.cjs')) return require(filename)

  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  moduleCache.set(filename, module)

  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    const resolved = resolveLocalModule(request, filename)
    if (Object.hasOwn(mocks, resolved)) return mocks[resolved]
    if (resolved.endsWith('.ts') || resolved.endsWith('.js') || resolved.endsWith('.cjs')) {
      return loadTsModule(resolved, { baseDir, mocks, moduleCache })
    }
    return require(resolved)
  }

  try {
    new Function('module', 'exports', 'require', '__dirname', '__filename', code)(
      module,
      module.exports,
      localRequire,
      path.dirname(filename),
      filename
    )
  } catch (error) {
    if (error && typeof error.message === 'string') {
      error.message = `${error.message} while loading ${path.relative(baseDir, filename)}`
    }
    throw error
  }
  return module.exports
}

module.exports = { loadTsModule }
