const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('territory indicator follows ownership, relations and leaving the base; only own report opens', t => {
  let now = 0
  t.mock.method(performance, 'now', () => now)
  const previous = global.document
  const events = {}
  const element = {
    classList: { toggle() {} },
    setAttribute(name, value) {
      this[name] = value
    },
    addEventListener(name, fn) {
      events[name] = fn
    },
    remove() {
      this.removed = true
    },
  }
  global.document = { createElement: () => element }
  t.after(() => {
    global.document = previous
  })
  let opened = 0,
    closed = 0
  const { TerritoryIndicator } = loadTsModule('app/ui/TerritoryIndicator.ts', {
    mocks: {
      '../lib/lang': { t: key => key },
      './minimap/MinimapResourcePanel': {
        openBaseReport: () => {
          opened++
          return {
            close() {
              closed++
            },
          }
        },
      },
    },
  })
  const center = i => ({ type: 'TownCenter', i, j: 0 })
  const player = { label: 'own', civ: 'Own', buildings: [center(0)], isEnemy: () => false }
  const foreign = { label: 'other', civ: 'Other', factionId: 'other', buildings: [center(50)] }
  const hero = { type: 'Hero', i: 0, j: 0 }
  const faction = { relationState: 'friendly' }
  const menu = {
    gameHud: { appendChild() {} },
    context: {
      player,
      players: [player, foreign],
      controls: { heroUnit: hero },
      getCampaignFactions: () => ({ other: faction }),
    },
  }
  const indicator = new TerritoryIndicator(menu)
  indicator.update()
  assert.equal(element.hidden, false)
  assert.equal(element.textContent, 'Own · ⊕')
  events.click({ preventDefault() {}, stopPropagation() {} })
  assert.equal(opened, 1)
  events.click({ preventDefault() {}, stopPropagation() {} })
  assert.equal(opened, 1)
  hero.i = 50
  now += 300
  indicator.update()
  assert.equal(element.title, 'worldMapRelationFriendly')
  events.click({ preventDefault() {}, stopPropagation() {} })
  assert.equal(opened, 1)
  faction.relationState = 'hostile'
  now += 300
  indicator.update()
  assert.equal(element.title, 'worldMapRelationHostile')
  hero.i = 100
  now += 300
  indicator.update()
  assert.equal(element.hidden, true)
  indicator.destroy()
  assert.equal(closed, 1)
  assert.equal(element.removed, true)
})
