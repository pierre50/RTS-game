const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function element(tag) {
  const classes = new Set()
  return {
    tag,
    children: [],
    style: {},
    events: {},
    attributes: {},
    classList: {
      add: key => classes.add(key),
      toggle: (key, active) => (active ? classes.add(key) : classes.delete(key)),
      contains: key => classes.has(key),
    },
    append(...items) {
      this.children.push(...items)
    },
    appendChild(item) {
      this.children.push(item)
    },
    replaceChildren(...items) {
      this.children = items
    },
    setAttribute(key, value) {
      this.attributes[key] = value
    },
    addEventListener(key, fn) {
      this.events[key] = fn
    },
  }
}

test('minimap contains only map legend, toggles caves and factions, and keeps filters on reopen', t => {
  const previous = global.document
  global.document = { createElement: element }
  t.after(() => {
    global.document = previous
  })
  const moduleCache = new Map()
  const options = { moduleCache, mocks: { '../../lib/lang': { t: key => key } } }
  const { renderMinimapLegend } = loadTsModule('app/ui/minimap/MinimapLegend.ts', options)
  const { isMinimapMarkerHidden } = loadTsModule('app/ui/minimap/MinimapFilters.ts', options)
  const own = { label: 'own', isPlayed: true, civ: 'Self', colorHex: '#fff' }
  const ai = { label: 'ai', civ: 'Other', name: 'Other', type: 'AI', units: [{ hitPoints: 10 }], colorHex: '#f00' }
  let redraws = 0
  const menu = {
    context: { player: own, players: [own, ai], map: {} },
    activateMiniMap: () => redraws++,
    updateCameraMiniMap: () => redraws++,
  }
  const container = element('div')
  renderMinimapLegend(container, menu)
  assert.equal(container.children.length, 3)
  assert.equal(container.children[2].textContent, 'minimapMarkerShapes')
  const legend = container.children[1]
  assert.equal(legend.children[0].textContent, 'minimapMapLegend')
  assert.deepEqual(
    legend.children.slice(1).map(row => row.children[1].textContent),
    ['you', 'Other', 'Cave']
  )
  const cave = legend.children[3]
  assert.equal(cave.tag, 'button')
  cave.events.click()
  assert.equal(isMinimapMarkerHidden(menu.context, 'caves'), true)
  assert.equal(cave.attributes['aria-pressed'], 'false')
  assert.equal(cave.classList.contains('is-hidden'), true)
  assert.equal(redraws, 1)
  assert.equal(isMinimapMarkerHidden(menu.context, 'Other'), false)
  legend.children[2].events.click()
  assert.equal(isMinimapMarkerHidden(menu.context, 'Other'), true)
  renderMinimapLegend(container, menu)
  const reopened = container.children[1].children[3]
  assert.equal(reopened.classList.contains('is-hidden'), true)
  reopened.events.click()
  assert.equal(isMinimapMarkerHidden(menu.context, 'caves'), false)
  assert.equal(isMinimapMarkerHidden({}, 'Other'), false)
  const [less, value, more] = container.children[0].children
  assert.equal(value.textContent, '100 %')
  assert.equal(less.disabled, true)
  less.events.click()
  assert.equal(value.textContent, '100 %')
  more.events.click()
  assert.equal(value.textContent, '150 %')
  less.events.click()
  assert.equal(value.textContent, '100 %')
  for (let n = 0; n < 10; n++) more.events.click()
  assert.equal(value.textContent, '400 %')
  assert.equal(more.disabled, true)
  for (let n = 0; n < 10; n++) less.events.click()
  assert.equal(value.textContent, '100 %')
  assert.equal(less.disabled, true)
})

test('minimap legend uses live owners and colors even for a guest sharing the host civilization', t => {
  const previous = global.document
  global.document = { createElement: element }
  t.after(() => {
    global.document = previous
  })
  const options = { moduleCache: new Map(), mocks: { '../../lib/lang': { t: key => key } } }
  const { renderMinimapLegend } = loadTsModule('app/ui/minimap/MinimapLegend.ts', options)
  const { isMinimapMarkerHidden } = loadTsModule('app/ui/minimap/MinimapFilters.ts', options)
  const menu = {
    context: {
      players: [
        { isPlayed: true, civ: 'Hellas', factionId: 'hellas', colorHex: '#123456' },
        {
          type: 'AI',
          units: [{ hitPoints: 10 }],
          civ: 'Hellas',
          factionId: 'hellas',
          name: 'Host',
          colorHex: '#abcdef',
          diplomacy: 'friendly',
        },
        { type: 'Bandits', units: [{ hitPoints: 10 }], civ: 'Hellas', colorHex: '#222222' },
      ],
      getCampaignFactions: () => ({ hellas: { id: 'hellas', color: '#ff0000', name: 'Stale' } }),
      map: {
        worldManifest: {
          settlements: [
            { kind: 'village', civ: 'Hellas', playerIndex: 0 },
            { kind: 'village', civ: 'Absent', playerIndex: 1 },
          ],
        },
      },
    },
    updateCameraMiniMap() {},
  }
  const container = element('div')
  renderMinimapLegend(container, menu)
  const rows = container.children[1].children.slice(1)
  assert.deepEqual(
    rows.map(row => row.children[1].textContent),
    ['you', 'Host', 'worldMapBandits', 'Cave']
  )
  assert.deepEqual(
    rows.map(row => row.children[0].style.backgroundColor),
    ['#123456', '#abcdef', '#222222', '#8f8f8f']
  )
  rows[1].events.click()
  assert.equal(isMinimapMarkerHidden(menu.context, 'hellas'), true)
  assert.equal(isMinimapMarkerHidden(menu.context, 'self'), false)
  rows[2].events.click()
  assert.equal(isMinimapMarkerHidden(menu.context, 'bandits'), true)
})

test('AI faction filters remain available for remembered buildings while cleared bandits disappear', t => {
  const previous = global.document
  global.document = { createElement: element }
  t.after(() => {
    global.document = previous
  })
  const { renderMinimapLegend } = loadTsModule('app/ui/minimap/MinimapLegend.ts', {
    mocks: { '../../lib/lang': { t: key => key } },
  })
  const ai = { type: 'AI', civ: 'Hellas', units: [{ hitPoints: 10 }], buildings: [{ type: 'TownCenter' }] }
  const bandits = { type: 'Bandits', units: [{ hitPoints: 10 }], buildings: [{ type: 'FireCamp' }] }
  const menu = { context: { players: [ai, bandits], map: {} } }
  const container = element('div')
  renderMinimapLegend(container, menu)
  assert.equal(container.children[1].children.length, 4)
  ai.units[0].isDead = true
  bandits.units = []
  renderMinimapLegend(container, menu)
  assert.deepEqual(
    container.children[1].children.slice(1).map(row => row.children[1].textContent),
    ['Hellas', 'Cave']
  )
})

test('minimap relation follows current faction diplomacy on reopen instead of the legacy neutral field', t => {
  const previous = global.document
  global.document = { createElement: element }
  t.after(() => {
    global.document = previous
  })
  const { renderMinimapLegend } = loadTsModule('app/ui/minimap/MinimapLegend.ts', {
    mocks: { '../../lib/lang': { t: key => key } },
  })
  const faction = { relationState: 'friendly' }
  const own = { label: 'hero', isPlayed: true, factionId: 'hero' }
  const ai = { label: 'village', type: 'AI', factionId: 'village', diplomacy: null, units: [{ hitPoints: 10 }] }
  const menu = {
    context: { player: own, players: [own, ai], map: {}, getCampaignFactions: () => ({ village: faction }) },
  }
  const container = element('div')
  for (const relation of ['friendly', 'wary', 'hostile', 'allied', 'neutral']) {
    faction.relationState = relation
    renderMinimapLegend(container, menu)
    const label = container.children[1].children[2].children[2]
    assert.equal(label.className, `worldmap-legend-relation ${relation}`)
    assert.equal(label.textContent, `worldMapRelation${relation[0].toUpperCase()}${relation.slice(1)}`)
  }
})

test('legend shares marker icons and shows a separate base only while a completed town center exists', t => {
  const previous = global.document
  global.document = { createElement: element }
  t.after(() => {
    global.document = previous
  })
  const options = { moduleCache: new Map(), mocks: { '../../lib/lang': { t: key => key } } }
  const { renderMinimapLegend } = loadTsModule('app/ui/minimap/MinimapLegend.ts', options)
  const { isMinimapMarkerHidden } = loadTsModule('app/ui/minimap/MinimapFilters.ts', options)
  const center = { type: 'TownCenter', isBuilt: false }
  const player = { isPlayed: true, label: 'self', colorHex: '#123456', buildings: [center] }
  const menu = {
    context: {
      player,
      players: [
        player,
        { type: 'AI', civ: 'Other', units: [{ hitPoints: 10 }] },
        { type: 'Bandits', units: [{ hitPoints: 10 }] },
      ],
      map: {},
    },
    updateCameraMiniMap() {},
  }
  const container = element('div')
  const rows = () => container.children[1].children.slice(1)
  renderMinimapLegend(container, menu)
  assert.deepEqual(
    rows().map(row => row.children[0].children[0].src),
    ['hero', 'village', 'camp', 'cave'].map(kind => `assets/icons/minimap/${kind}.svg`)
  )
  center.isBuilt = true
  renderMinimapLegend(container, menu)
  const base = rows().find(row => row.children[1].textContent === 'minimapPlayerBase')
  assert.ok(base)
  assert.equal(base.children[0].children[0].src, 'assets/icons/minimap/home.svg')
  assert.equal(base.children[0].style.backgroundColor, player.colorHex)
  base.events.click()
  assert.equal(isMinimapMarkerHidden(menu.context, 'base'), true)
  assert.equal(isMinimapMarkerHidden(menu.context, 'self'), false)
  center.isDestroyed = true
  renderMinimapLegend(container, menu)
  assert.ok(!rows().some(row => row.children[1].textContent === 'minimapPlayerBase'))
})
