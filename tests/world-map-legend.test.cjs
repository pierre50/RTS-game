const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { createWorldMapLegend, settlementPlayerColor } = loadTsModule('app/ui/worldMap/WorldMapLegend.ts', {
  mocks: {
    '../../lib/lang': { t: key => key },
    '../../lib/campaign/playerRoster': { factionIdForCivilization: civ => `faction-${civ}` },
    '../../lib/graphics/colors': { getHexColor: color => ({ red: '#ff0000', grey: '#888888' })[color] },
  },
})
function element() {
  return {
    children: [],
    style: {},
    classes: new Set(),
    classList: { toggle() {} },
    append(...children) {
      this.children.push(...children)
    },
    appendChild(child) {
      this.children.push(child)
    },
  }
}
function host(players = [], factions = {}) {
  return { context: { players, getCampaignFactions: () => factions } }
}
test('settlement colors prefer matching civilizations over stale player indexes', () => {
  const menu = host([
    { civ: 'A', color: 'red' },
    { civ: 'B', colorHex: '#123456' },
  ])
  assert.equal(settlementPlayerColor(menu, { kind: 'city', civ: 'B', playerIndex: 0 }), '#123456')
  assert.equal(settlementPlayerColor(menu, { kind: 'village', playerIndex: 0 }), '#ff0000')
  assert.equal(settlementPlayerColor(menu, { kind: 'city', civ: 'C', playerIndex: 0 }), null)
  assert.equal(settlementPlayerColor(menu, { kind: 'banditCamp', playerIndex: 0 }), null)
})
test('settlement colors resolve explicit, normalized and legacy faction identities', () => {
  const menu = host([], {
    named: { id: 'named', color: '#112233' },
    'faction-A': { id: 'a', color: '#223344' },
    legacy: { id: 'legacy', civilization: 'B', color: 'red' },
  })
  for (const [settlement, expected] of [
    [{ factionId: 'named', civ: 'A' }, '#112233'],
    [{ civ: 'A' }, '#223344'],
    [{ civ: 'B' }, '#ff0000'],
    [{ playerIndex: -1 }, null],
  ])
    assert.equal(settlementPlayerColor(menu, { kind: 'village', ...settlement }), expected)
  assert.equal(settlementPlayerColor({ context: {} }, { kind: 'city' }), null)
})
test('world legend puts the player first, deduplicates factions and shows diplomatic relations', t => {
  const original = globalThis.document
  globalThis.document = { createElement: element }
  t.after(() => {
    if (original === undefined) delete globalThis.document
    else globalThis.document = original
  })
  const menu = host([{ civ: 'Self', isPlayed: true, colorHex: '#00ff00' }], {
    enemy: { id: 'enemy', name: 'Rivals', relationState: 'hostile', color: '#ff0000' },
    duplicate: { id: 'duplicate', name: ' rivals ', relationState: 'hostile' },
  })
  const legend = createWorldMapLegend(menu, {
    settlements: [
      { kind: 'city', factionId: 'enemy' },
      { kind: 'village', factionId: 'enemy' },
      { kind: 'city', factionId: 'duplicate' },
      { kind: 'banditCamp' },
      { kind: 'banditCamp' },
      { kind: 'village', civ: 'Self' },
      { kind: 'ruins' },
      { kind: 'city' },
    ],
  })
  assert.equal(legend.children.length, 4)
  const rows = legend.children.slice(1)
  assert.deepEqual(
    rows.map(row => row.children[1].textContent),
    ['you', 'Rivals', 'worldMapBandits']
  )
  assert.deepEqual(
    rows.map(row => row.children[2].textContent),
    ['', 'worldMapRelationHostile', 'worldMapRelationHostile']
  )
  assert.equal(rows[0].children[0].style.backgroundColor, '#00ff00')
  assert.equal(rows[2].children[0].style.backgroundColor, '#888888')
})
test('empty legends are omitted and unknown settlements retain neutral fallback', t => {
  const original = globalThis.document
  globalThis.document = { createElement: element }
  t.after(() => {
    if (original === undefined) delete globalThis.document
    else globalThis.document = original
  })
  assert.equal(createWorldMapLegend(host(), {}), null)
  const legend = createWorldMapLegend(host(), { settlements: [{ kind: 'city', id: 'unknown' }] })
  assert.equal(legend.children[1].children[0].style.backgroundColor, '#6ee37a')
  assert.equal(legend.children[1].children[2].textContent, 'worldMapRelationNeutral')
})
