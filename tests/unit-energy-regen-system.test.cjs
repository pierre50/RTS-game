const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadEnergyRegenSystem(calls) {
  return loadTsModule('app/services/UnitEnergyRegenSystem.ts', {
    mocks: {
      '../lib': {
        updateUnitEnergy: (unit, elapsedMs) => calls.push(['regen', unit.label, elapsedMs]),
      },
    },
  })
}

function createScheduler(calls) {
  return {
    elapsedMs: 0,
    nextId: 1,
    add(callback, interval, name) {
      const id = this.nextId++
      calls.push(['add', id, interval, name])
      this.callback = callback
      return id
    },
    remove(id) {
      calls.push(['remove', id])
    },
  }
}

test('passive unit energy regen updates idle and working units without active paths', () => {
  const calls = []
  const { UnitEnergyRegenSystem } = loadEnergyRegenSystem(calls)
  const idle = { label: 'idle', path: [] }
  const builder = { action: 'build', label: 'builder', path: [], sprite: { playing: true } }
  const moving = { label: 'moving', path: [{ i: 1, j: 1 }] }
  const waiting = { label: 'waiting', path: [], waitingForEnergyAction: 'build' }
  const dead = { isDead: true, label: 'dead', path: [] }
  const destroyed = { isDestroyed: true, label: 'destroyed', path: [] }
  const context = {
    players: [{ units: [idle, builder, moving] }, { units: [waiting, dead, destroyed] }],
    scheduler: createScheduler(calls),
  }
  const system = new UnitEnergyRegenSystem(context)

  system.update(500)

  assert.deepEqual(calls.filter(call => call[0] === 'regen'), [
    ['regen', 'idle', 500],
    ['regen', 'builder', 500],
  ])
})

test('passive unit energy regen unregisters its scheduler task on destroy', () => {
  const calls = []
  const { UnitEnergyRegenSystem } = loadEnergyRegenSystem(calls)
  const context = { players: [], scheduler: createScheduler(calls) }
  const system = new UnitEnergyRegenSystem(context)

  system.destroy()
  system.destroy()

  assert.deepEqual(calls, [['add', 1, 500, 'unit.energyPassiveRegen'], ['remove', 1]])
})
