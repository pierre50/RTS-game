const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function element() {
  return {
    children: [],
    attributes: {},
    append(...children) {
      this.children.push(...children)
    },
    appendChild(child) {
      this.children.push(child)
    },
    setAttribute(key, value) {
      this.attributes[key] = value
    },
  }
}

function withSummary(npcs, check, hasPortrait = true) {
  const previous = global.document
  global.document = { createElement: element }
  const portraits = []
  try {
    const { createNpcGroupSummary } = loadTsModule('app/ui/NpcGroupSummary.ts', {
      mocks: {
        './EntityInfoContent': {
          createEntityAvatar: (_app, unit) => {
            portraits.push(unit)
            return hasPortrait ? element() : null
          },
        },
        './utils/entityDisplayName': { getEntityDisplayName: unit => unit.name ?? unit.assetType ?? unit.type },
        '../lib/lang': { t: (key, params) => `${key}:${params.count}` },
      },
    })
    check(createNpcGroupSummary({}, npcs), portraits)
  } finally {
    global.document = previous
  }
}

test('a large group is represented completely with one portrait per unit type', () => {
  const villagers = Array.from({ length: 120 }, (_, i) => ({
    type: 'Villager',
    name: `Person ${i}`,
    assetType: `appearance${i}`,
    hitPoints: 10,
    totalHitPoints: 10,
  }))
  const archers = Array.from({ length: 3 }, () => ({ type: 'Bowman', hitPoints: 10, totalHitPoints: 10 }))
  withSummary([...villagers, ...archers], (summary, portraits) => {
    const cards = summary.children[0].children
    assert.equal(cards.length, 2)
    assert.equal(portraits.length, 2)
    assert.equal(cards[0].attributes['aria-label'], 'Villager ×120')
    assert.equal(cards[1].attributes['aria-label'], 'Bowman ×3')
    assert.equal(cards[0].children[1].textContent, '×120')
    assert.equal(cards[0].children[2].textContent, 'Villager')
    assert.equal(summary.children.length, 1)
  })
})

test('wounded count excludes healthy, dead and unknown-health units', () => {
  withSummary(
    [
      { type: 'Villager', hitPoints: 4, totalHitPoints: 10 },
      { type: 'Bowman', hitPoints: 8, totalHitPoints: 10 },
      { type: 'Villager', hitPoints: 0, totalHitPoints: 10, isDead: true },
      { type: 'Villager' },
    ],
    summary => {
      assert.equal(summary.children[1].textContent, 'npcGroupWounded:2')
    }
  )
})

test('missing portrait assets do not hide counts or type labels', () => {
  withSummary(
    [{ type: 'Villager', hitPoints: 5, totalHitPoints: 10 }],
    summary => {
      const card = summary.children[0].children[0]
      assert.equal(card.children[0].textContent, '×1')
      assert.equal(card.children[1].textContent, 'Villager')
      assert.equal(summary.children[1].textContent, 'npcGroupWoundedOne:1')
    },
    false
  )
})
