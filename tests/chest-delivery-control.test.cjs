const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('owned outdoor chests expose an initially allowed delivery toggle; foreign and interior chests do not', () => {
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
    assert.equal(panel.header.children[0].textContent, 'villagerDeliveriesAllowed')
    panel.header.children[1].onclick()
    assert.equal(chest.villagerDeliveriesBlocked, true)
    assert.equal(panel.header.children[0].textContent, 'villagerDeliveriesBlocked')
    panel.header.children[1].onclick()
    assert.equal(chest.villagerDeliveriesBlocked, false)
    assert.equal(changed, 2)
    hero.isChief = false
    assert.equal(createHeroBuildingContainerBody(chest, menu, () => {}).header, undefined)
    panel.header.children[1].onclick()
    assert.equal(chest.villagerDeliveriesBlocked, false)
    hero.isChief = true
    const foreign = { ...chest, owner: { label: 'other' } }
    assert.equal(createHeroBuildingContainerBody(foreign, menu, () => {}).header, undefined)
    const inside = { ...chest, spaceId: 'interior:tc' }
    assert.equal(createHeroBuildingContainerBody(inside, menu, () => {}).header, undefined)
  } finally {
    global.document = original
  }
})
