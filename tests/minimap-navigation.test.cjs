const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const options = {
  moduleCache: new Map(),
  mocks: {
    '../../lib/lang': { t: key => key },
    './MinimapTeleport': {
      teleportHeroFromMinimap: (menu, point) => {
        menu.context.travelPoint = point
      },
    },
    '../../lib/ui/Modal': { Modal: class {} },
  },
}
const { MinimapNavigation } = loadTsModule('app/ui/minimap/MinimapNavigation.ts', options)
const { getMinimapZoom } = loadTsModule('app/ui/minimap/MinimapZoom.ts', options)
const { getWindowInteraction, registerWindowInteraction } = loadTsModule('app/lib/ui/GameWindowInteraction.ts', options)

function navigation() {
  const controller = Object.create(MinimapNavigation.prototype)
  controller.menu = { context: { player: {} } }
  controller.blockedTriggers = new Set()
  controller.pan = (x, y) => {
    controller.lastPan = [x, y]
  }
  controller.zoomChanged = () => {
    controller.zoomChanges = (controller.zoomChanges ?? 0) + 1
  }
  return controller
}
function pad() {
  return { index: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })) }
}

test('stick movement is proportional to elapsed time and ignores drift', () => {
  const controller = navigation()
  const input = pad()
  input.axes = [0.1, -0.19, 0, 0]
  controller.gamepad(input, 30)
  assert.deepEqual(controller.lastPan, [0, 0])
  input.axes = [1, -1, 0, 0]
  controller.gamepad(input, 30)
  assert.deepEqual(controller.lastPan, [0.02, -0.02])
  controller.gamepad(input, 15)
  assert.deepEqual(controller.lastPan, [0.01, -0.01])
})

test('held triggers zoom smoothly but an opening press must first be released', () => {
  const controller = navigation()
  const input = pad()
  input.buttons[6] = { value: 1, pressed: true }
  controller.blockedTriggers.add(6)
  controller.gamepad(input, 30)
  assert.equal(getMinimapZoom(controller.menu.context), 4)
  input.buttons[6] = { value: 0, pressed: false }
  controller.gamepad(input, 30)
  input.buttons[6] = { value: 1, pressed: true }
  controller.gamepad(input, 30)
  assert.equal(getMinimapZoom(controller.menu.context), 3.96)
  controller.gamepad(input, 30)
  assert.equal(getMinimapZoom(controller.menu.context), 3.92)
  input.buttons[7] = { value: 1, pressed: true }
  controller.gamepad(input, 30)
  assert.equal(getMinimapZoom(controller.menu.context), 3.92, 'opposite triggers cancel')
})

test('map navigation stops intercepting commands as soon as its tab is hidden', () => {
  let hidden = false
  const element = { dataset: {}, closest: () => (hidden ? {} : null) }
  const interaction = { commands: () => [], move() {}, gamepad() {} }
  const panel = { querySelectorAll: () => [element] }
  registerWindowInteraction(element, interaction)
  assert.equal(getWindowInteraction(panel), interaction)
  hidden = true
  assert.equal(getWindowInteraction(panel), undefined)
})

test('fast travel stays enabled without a place and targets the map cursor', () => {
  const controller = navigation()
  const rect = { left: 20, top: 30, width: 200, height: 100 }
  controller.rect = () => rect
  controller.menu.minimapManager = {
    getPlaceAt: () => undefined,
    getMinimapWorldPoint: (x, y, bounds) => {
      assert.equal(bounds, rect)
      return { x: x * 2, y: y * 3 }
    },
  }
  const commands = controller.commands()
  assert.equal(
    commands.some(command => command.id === 'map-details'),
    false
  )
  const travel = commands.find(command => command.id === 'map-fast-travel')
  assert.equal(travel.label, 'minimapFastTravel')
  assert.ok(!travel.disabled)
  assert.equal(travel.key, 'Enter')
  assert.equal(travel.pad, 0)
  travel.run()
  assert.deepEqual(controller.menu.context.travelPoint, { x: 240, y: 240 })
  controller.fastTravel(45, 60)
  assert.deepEqual(controller.menu.context.travelPoint, { x: 90, y: 180 })
})
