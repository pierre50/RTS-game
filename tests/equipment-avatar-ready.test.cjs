const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

for (const connected of [true, false]) {
  test(`lazy avatar refreshes its detail sheet only while connected (${connected})`, async () => {
    let finishLoading
    let loaded = false
    let draws = 0
    const events = []
    const { renderEquipmentAvatarLazy } = loadTsModule('app/ui/equipment/EquipmentAvatar.ts', {
      mocks: {
        '../../lib/avatar': {
          renderEquipmentAvatar: () => {
            draws++
            return loaded
          },
        },
        '../../lib/lpc/equipment': { dynamicEquipmentVisualKey: () => 'sword' },
        '../../lib/lpc/lazyEquipmentAssets': {
          loadDynamicEquipmentAssetQueued: () =>
            new Promise(resolve => {
              finishLoading = resolve
            }),
        },
      },
    })
    const canvas = { isConnected: connected, dispatchEvent: event => events.push(event) }
    assert.equal(renderEquipmentAvatarLazy({}, 'sword', canvas), false)
    loaded = true
    finishLoading()
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(draws, connected ? 2 : 1)
    assert.equal(events.length, connected ? 1 : 0)
    if (connected) {
      assert.equal(events[0].type, 'equipmentavatarready')
      assert.equal(events[0].bubbles, true)
    }
  })
}
