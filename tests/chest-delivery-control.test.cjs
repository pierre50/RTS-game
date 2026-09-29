const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('chests no longer expose delivery toggles, including old blocked chests', () => {
  const original = global.document
  try {
    const { createHeroBuildingContainerBody } = loadTsModule('app/ui/hero-building/HeroBuildingContainerBody.ts', {
      mocks: {
        '../../lib/lang': { t: key => key },
        '../../lib/theft/theft': { applyTheftConsequences() {}, THEFT_SUBJECT_TYPES: { chest: 'chest' } },
        '../inventory/InventoryTransferPanel': {
          InventoryTransferPanel: class {
            constructor(options) {
              Object.assign(this, options)
            }
          },
        },
      },
    })
    global.document = {
      createElement: () => ({
        children: [],
        append(...children) {
          this.children.push(...children)
        },
        setAttribute() {},
      }),
    }

    const owner = { label: 'p', isPlayed: true, buildings: [] }
    const hero = { type: 'Hero', isChief: true, label: 'hero', owner, inventory: { resources: {} } }
    const chest = {
      type: 'Chest',
      family: 'building',
      label: 'camp',
      owner,
      spaceId: 'outside',
      inventory: { resources: {} },
    }
    owner.buildings = [chest]
    const menu = { context: { controls: { heroUnit: hero } }, showMessage() {} }
    let changed = 0
    const panel = createHeroBuildingContainerBody(chest, menu, () => changed++)
    assert.equal(panel.header, undefined)
    chest.villagerDeliveriesBlocked = true
    assert.equal(createHeroBuildingContainerBody(chest, menu, () => {}).header, undefined)
    assert.equal(changed, 0)
    hero.isChief = true
    const foreign = { ...chest, owner: { label: 'other' } }
    assert.equal(createHeroBuildingContainerBody(foreign, menu, () => {}).header, undefined)
    const inside = { ...chest, spaceId: 'interior:tc' }
    assert.equal(createHeroBuildingContainerBody(inside, menu, () => {}).header, undefined)
  } finally {
    global.document = original
  }
})
