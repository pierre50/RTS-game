const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function setup() {
  const tasks = new Map()
  let nextId = 0
  const context = {
    controls: { heroUnit: {} },
    scheduler: {
      add(callback) { tasks.set(++nextId, callback); return nextId },
      remove(id) { tasks.delete(id) },
    },
  }
  const { createInspectionModal } = loadTsModule('app/ui/InspectionPanel.ts', { mocks: {
    '../lib': { Modal: class {
      constructor(options) { this.options = options }
      close() { this.closed = true }
    } },
    '../lib/hero/heroActionRange': { isHeroInteractionSessionInRange: (hero, target) => hero && target.near },
  } })
  return { context, tasks, createInspectionModal, tick: () => [...tasks.values()].forEach(fn => fn()) }
}

test('moving away dismisses an interaction once and removes its distance watcher', () => {
  const { context, tasks, createInspectionModal, tick } = setup()
  const target = { near: true }
  let dismissed = 0
  const modal = createInspectionModal({ proximity: { context, targets: () => [target] }, onClose: () => dismissed++ })
  tick()
  assert.equal(dismissed, 0)
  target.near = false
  tick()
  assert.equal(modal.closed, true)
  assert.equal(dismissed, 1)
  assert.equal(tasks.size, 0)
  tick()
  assert.equal(dismissed, 1)
})

test('programmatic and user dismissal both clean up watchers', () => {
  for (const userDismissal of [false, true]) {
    const { context, tasks, createInspectionModal } = setup()
    const modal = createInspectionModal({ proximity: { context, targets: () => [] }, onClose() {} })
    if (userDismissal) modal.options.onClose()
    else modal.close()
    assert.equal(tasks.size, 0)
  }
})

test('groups stay open near any participant and scripted dialogue can suspend checking', () => {
  const { context, tasks, createInspectionModal, tick } = setup()
  let enabled = false
  let targets = []
  const modal = createInspectionModal({ proximity: { context, targets: () => targets, enabled: () => enabled }, onClose() {} })
  tick()
  assert.equal(tasks.size, 1)
  enabled = true
  targets = [{ near: false }, { near: true }]
  tick()
  assert.equal(tasks.size, 1)
  context.controls.heroUnit = null
  tick()
  assert.equal(modal.closed, true)
})
