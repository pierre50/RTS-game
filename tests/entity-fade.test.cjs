const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadModule(relativePath, mocks = {}) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('fadeOutThenClear fades entity and detached shadow before clearing', () => {
  const callbacks = []
  const removed = []
  const { fadeOutThenClear } = loadModule('app/lib/entityFade.ts')
  const entity = {
    alpha: 0.8,
    shadow: { alpha: 0.5, destroyed: false },
    context: {
      scheduler: {
        add(callback) {
          callbacks.push(callback)
          return callbacks.length
        },
        remove(taskId) {
          removed.push(taskId)
        },
      },
    },
    cleared: false,
    clear() {
      this.cleared = true
    },
  }

  fadeOutThenClear(entity, 80)
  callbacks[0]()

  assert.equal(entity.alpha, 0.4)
  assert.equal(entity.shadow.alpha, 0.25)
  assert.equal(entity.cleared, false)

  callbacks[0]()

  assert.equal(entity.alpha, 0)
  assert.equal(entity.shadow.alpha, 0)
  assert.equal(entity.cleared, true)
  assert.deepEqual(removed, [1])
})

test('fadeOutThenClear clears immediately without a scheduler', () => {
  const { fadeOutThenClear } = loadModule('app/lib/entityFade.ts')
  const entity = {
    cleared: false,
    clear() {
      this.cleared = true
    },
  }

  fadeOutThenClear(entity, 80)

  assert.equal(entity.cleared, true)
})

test('fadeIn fades entity and detached shadow to their original alpha', () => {
  const callbacks = []
  const removed = []
  const { fadeIn } = loadModule('app/lib/entityFade.ts')
  const entity = {
    alpha: 0.8,
    shadow: { alpha: 0.5, destroyed: false },
    context: {
      scheduler: {
        add(callback) {
          callbacks.push(callback)
          return callbacks.length
        },
        remove(taskId) {
          removed.push(taskId)
        },
      },
    },
  }

  fadeIn(entity, 80)

  assert.equal(entity.alpha, 0)
  assert.equal(entity.shadow.alpha, 0)

  callbacks[0]()

  assert.equal(entity.alpha, 0.4)
  assert.equal(entity.shadow.alpha, 0.25)

  callbacks[0]()

  assert.equal(entity.alpha, 0.8)
  assert.equal(entity.shadow.alpha, 0.5)
  assert.deepEqual(removed, [1])
})

test('fadeIn restores final alpha immediately without a scheduler', () => {
  const { fadeIn } = loadModule('app/lib/entityFade.ts')
  const entity = {
    alpha: 0.8,
    shadow: { alpha: 0.5, destroyed: false },
  }

  fadeIn(entity, 80)

  assert.equal(entity.alpha, 0.8)
  assert.equal(entity.shadow.alpha, 0.5)
})

test('fadeIn cancels a pending fadeOut for the same entity', () => {
  const callbacks = []
  const removed = []
  const { fadeIn, fadeOut } = loadModule('app/lib/entityFade.ts')
  const entity = {
    alpha: 1,
    context: {
      scheduler: {
        add(callback) {
          callbacks.push(callback)
          return callbacks.length
        },
        remove(taskId) {
          removed.push(taskId)
        },
      },
    },
  }
  let completed = false

  fadeOut(entity, 80, () => {
    completed = true
  })
  fadeIn(entity, 80)

  assert.deepEqual(removed, [1])

  callbacks[0]()
  assert.equal(completed, false)

  callbacks[1]()
  callbacks[1]()
  assert.equal(entity.alpha, 1)
  assert.equal(completed, false)
  assert.deepEqual(removed, [1, 2])
})
