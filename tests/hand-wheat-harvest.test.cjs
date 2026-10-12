const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const moduleCache = new Map()
const load = file => loadTsModule(file, { moduleCache })
const { getActionCondition } = load('app/lib/combat/combatActionConditions.ts')
const { getGatherAmount } = load('app/classes/unit/UnitResourceGathering.ts')
const { gatherOffline } = load('app/services/world/work/OfflineWorkImpacts.ts')
const { canAutonomouslyWork } = load('app/lib/equipment/workTools.ts')

for (const type of ['Hero', 'Villager']) {
  test(`${type} harvests mature wheat by hand with no usable scythe, preserving stock and other tools`, () => {
    for (const tool of [undefined, 'axe_iron', 'scythe_iron~condition:0', 'scythe_iron']) {
      const unit = {
        type,
        work: 'farmer',
        action: 'farm',
        hitPoints: 20,
        experience: { farming: 10000 },
        gatherAmount: { farmer: 1 },
        inventory: { toolsStowed: tool === 'scythe_iron', activeWeapons: { tool }, resources: {} },
      }
      const target = {
        type: 'Wheat',
        family: 'resource',
        quantity: 20,
        sprite: { currentFrame: 5, textures: Array(6).fill({}) },
      }
      assert.equal(getActionCondition(unit, target, 'farm'), true)
      assert.equal(canAutonomouslyWork(unit, 'wheat'), true)
      assert.equal(getGatherAmount(unit), 1)
      const before = structuredClone(unit.inventory.activeWeapons)
      const report = { gathered: {} }
      gatherOffline(
        {
          unit,
          target,
          player: {},
          report,
          work: 'farmer',
          stored: 'wheat',
          cycle: 100,
          config: { gatherAmount: unit.gatherAmount },
        },
        200
      )
      assert.equal(unit.inventory.resources.wheat, 1)
      assert.equal(target.quantity, 19)
      assert.deepEqual(unit.inventory.activeWeapons, before)
      assert.equal(report.gathered.wheat, 1)
      target.sprite.currentFrame = 4
      assert.equal(getActionCondition(unit, target, 'farm'), false)
    }
  })
}

test('stone scythe yields two wheat, then a broken scythe falls back to hand harvesting', () => {
  const unit = {
    type: 'Villager',
    work: 'farmer',
    action: 'farm',
    gatherAmount: { farmer: 1 },
    inventory: { activeWeapons: { tool: 'scythe_ceramic~uses:2' }, resources: {} },
  }
  const target = { type: 'Wheat', quantity: 20 }
  const step = {
    unit,
    target,
    player: {},
    report: { gathered: {} },
    work: 'farmer',
    stored: 'wheat',
    cycle: 100,
    config: { gatherAmount: unit.gatherAmount },
  }
  assert.equal(getGatherAmount(unit), 2)
  gatherOffline(step, 200)
  assert.equal(target.quantity, 18)
  assert.equal(unit.inventory.activeWeapons.tool, 'scythe_ceramic~condition:0')
  assert.equal(getGatherAmount(unit), 1)
  gatherOffline(step, 200)
  assert.equal(target.quantity, 17)
  assert.equal(unit.inventory.resources.wheat, 3)
})
