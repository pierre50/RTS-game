const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadMinimapInputController(teleportHeroFromMinimap = () => {}) {
  const filename = path.join(__dirname, '../app/ui/minimap/MinimapInputController.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    './MinimapTeleport': { teleportHeroFromMinimap },
    '../constants': {
      LONG_CLICK_DURATION: 400,
      MINIMAP_DRAG_THRESHOLD: 4,
    },
  }
  const localRequire = request =>
    Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.MinimapInputController
}

function createController({ editor = false } = {}) {
  const MinimapInputController = loadMinimapInputController()
  const minimapElement = {
    addEventListener() {},
    removeEventListener() {},
  }
  const menu = {
    context: { controls: {} },
    minimapMap: editor ? undefined : minimapElement,
    editorPanelMap: editor ? minimapElement : undefined,
    minimapManager: {
      getMinimapFactor: () => 2,
    },
  }
  return new MinimapInputController(menu)
}

function pointerEvent() {
  return {
    clientX: 20,
    clientY: 30,
    target: {
      getBoundingClientRect: () => ({ left: 10, top: 10, width: 20, height: 20 }),
    },
  }
}

test('minimap camera movement is ignored during normal hero camera mode', () => {
  const controller = createController()
  const calls = []
  controller.moveCameraFromMinimap(pointerEvent(), {
    setCamera: (x, y) => calls.push([x, y]),
  })
  assert.deepEqual(calls, [])
})

test('minimap camera movement remains enabled for the map editor', () => {
  const controller = createController({ editor: true })
  const calls = []
  controller.moveCameraFromMinimap(pointerEvent(), {
    setCamera: (x, y) => calls.push([x, y]),
  })
  assert.deepEqual(calls, [[0, 34]])
})

test('minimap input binding is idempotent and removable', () => {
  const MinimapInputController = loadMinimapInputController()
  const listeners = []
  const removed = []
  const minimapElement = {
    addEventListener: (type, handler) => listeners.push([type, handler]),
    removeEventListener: (type, handler) => removed.push([type, handler]),
  }
  const controller = new MinimapInputController({
    context: { controls: {} },
    minimapMap: minimapElement,
    minimapManager: { getMinimapFactor: () => 2 },
  })

  controller.bind()
  controller.bind()
  controller.unbind()
  controller.unbind()

  assert.deepEqual(
    listeners.map(([type]) => type),
    ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']
  )
  assert.deepEqual(
    removed.map(([type]) => type),
    ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']
  )
})

test('left click teleports in hero camera mode, dragging and right click do not', () => {
  const calls = []
  const Controller = loadMinimapInputController((_menu, point) => calls.push(point))
  const controller = new Controller({ context: { controls: {} }, minimapManager: { getMinimapFactor: () => 2 } })
  const event = { ...pointerEvent(), button: 0, pointerId: 1 }
  controller.onPointerDown(event)
  controller.onPointerUp(event)
  assert.deepEqual(calls, [{ x: 0, y: 34 }])
  controller.onPointerDown(event)
  controller.onPointerMove({ ...event, clientX: 100 })
  controller.onPointerUp(event)
  controller.onPointerDown({ ...event, button: 2 })
  controller.onPointerUp({ ...event, button: 2 })
  assert.equal(calls.length, 1)
})
