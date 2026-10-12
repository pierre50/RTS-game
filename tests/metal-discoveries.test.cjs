const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { createInventoryContainer, moveInventoryResource } = loadTsModule('app/lib/inventory/inventoryContainers.ts')

for (const resource of ['bronzeIngot', 'ironIngot']) {
  test(`receiving ${resource} transfers the ingot without a global upgrade or discovery alert`, () => {
    const messages = []
    const player = {
      forgeUpgrades: { axes: 2 },
      context: { menu: { showMessage: (...args) => messages.push(args) } },
      units: [],
    }
    const hero = { owner: player, inventory: { resources: {} } }
    player.units.push(hero)
    const source = createInventoryContainer(
      { inventory: { resources: { [resource]: 1 } } },
      {
        id: 'loot',
        labelKey: 'loot',
      }
    )
    const received = []
    const target = createInventoryContainer(hero, {
      id: 'hero',
      labelKey: 'hero',
      onReceiveResource: (...args) => received.push(args),
    })
    assert.equal(moveInventoryResource(source, target, resource), 1)
    assert.equal(hero.inventory.resources[resource], 1)
    assert.deepEqual(player.forgeUpgrades, { axes: 2 })
    assert.deepEqual(messages, [])
    assert.deepEqual(received, [[resource, 1]])
  })
}
