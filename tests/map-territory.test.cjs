const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { findMapTerritoryOwner, constructionTerritoryBlocker } = loadTsModule('app/lib/campaign/mapTerritory.ts')
const { PLAYER_TYPES } = loadTsModule('app/constants/entities.ts')
const alive = () => ({ hitPoints: 100 })
const center = () => ({ ...alive(), type: 'TownCenter', isBuilt: true })
const human = () => ({
  label: 'hero',
  type: PLAYER_TYPES.human,
  isPlayed: true,
  factionId: 'self',
  units: [alive()],
  buildings: [],
})
const resident = () => ({
  label: 'resident',
  type: PLAYER_TYPES.ai,
  civ: 'Hellas',
  factionId: 'hellas',
  units: [alive()],
  buildings: [center()],
})
const settlements = [{ kind: 'village', civ: 'Hellas', region: { x: 1, y: 0 } }]
function context(players) {
  return { players, map: { worldRegion: { x: 1, y: 0 }, worldManifest: { settlements } } }
}

for (const relation of ['allied', 'hostile']) {
  test(`a living ${relation} resident blocks construction; destroying their center releases it`, () => {
    const player = human()
    const owner = { ...resident(), diplomacy: relation }
    const ctx = context([player, owner])
    assert.equal(constructionTerritoryBlocker(ctx, player), owner)
    assert.equal(constructionTerritoryBlocker(ctx, owner), null)
    owner.buildings[0].isDead = true
    assert.equal(constructionTerritoryBlocker(ctx, player), null)
    player.buildings.push(center())
    assert.equal(findMapTerritoryOwner(ctx.players, settlements), player)
  })
}

test('a passing army and bandit camp do not claim empty territory', () => {
  const player = human()
  const visitor = { ...resident(), civ: 'Kemet', buildings: [] }
  const bandit = { ...resident(), type: PLAYER_TYPES.bandits }
  assert.equal(findMapTerritoryOwner([player, visitor, bandit]), null)
})

test('the native resident takes priority over a visitor with captured buildings', () => {
  const player = { ...human(), buildings: [{ ...alive(), type: 'House', isBuilt: true }] }
  const owner = resident()
  assert.equal(findMapTerritoryOwner([player, owner], settlements), owner)
})

test('a matching hero-only start does not claim the settlement without a building', () => {
  const player = { ...human(), civ: 'Hellas', factionId: 'hellas' }
  assert.equal(findMapTerritoryOwner([player], settlements), null)
  player.buildings.push(center())
  assert.equal(findMapTerritoryOwner([player], settlements), player)
})

test('destroyed centers do not retain ownership', () => {
  const owner = resident()
  owner.buildings[0].isDead = true
  const player = { ...human(), buildings: [{ ...center(), isDestroyed: true }] }
  assert.equal(findMapTerritoryOwner([owner, player], settlements), null)
})

test('regional instances of the same faction may build', () => {
  const owner = resident()
  const player = { ...human(), factionId: owner.factionId }
  assert.equal(constructionTerritoryBlocker(context([player, owner]), player), null)
})

test('settlements in other regions do not assign ownership to visiting units', () => {
  const player = human()
  const owner = { ...resident(), buildings: [] }
  const ctx = context([player, owner])
  ctx.map.worldRegion = { x: 4, y: 4 }
  assert.equal(constructionTerritoryBlocker(ctx, player), null)
})

test('blocked purchases and wheat planting return before costs or map mutation', () => {
  const { buyPlayerBuilding, plantPlayerWheatField } = loadTsModule('app/classes/players/PlayerBuildingPlacement.ts', {
    mocks: {
      '../../lib': {},
      '../../lib/buildings/passageCells': {},
      '../../lib/entities/entityFade': {},
      '../../lib/mapSpaces': {},
      '../map/resources/ResourceQuantityRanges': {},
      '../Resource': {},
      '../../lib/objectives/ageObjectives': {},
    },
  })
  const player = human()
  player.context = context([player, resident()])
  player.plantWheatField = (i, j, options) => plantPlayerWheatField(player, i, j, options)
  assert.equal(buyPlayerBuilding(player, 1, 1, 'House'), false)
  assert.equal(buyPlayerBuilding(player, 1, 1, 'Farm'), false)
  assert.equal(buyPlayerBuilding(player, 1, 1, 'House', { alreadyPaid: true }), false)
})

test('construction tab names the occupying player and clears the warning after center destruction', () => {
  const { renderInventoryConstruction } = loadTsModule('app/ui/InventoryConstruction.ts', {
    mocks: {
      '../lib/avatar': {},
      '../lib/extra': { capitalizeFirstLetter: text => text.charAt(0).toUpperCase() + text.slice(1) },
      '../lib/audio/settings': { getReservedGameplayHotkeys: () => [] },
      '../lib/lang': { t: (key, vars) => `${key}:${vars.player}` },
    },
  })
  const previous = global.document
  global.document = { createElement: () => ({ setAttribute() {} }) }
  try {
    const player = human()
    const owner = { ...resident(), name: 'Hellas' }
    const ctx = { ...context([player, owner]), player, controls: {} }
    const panel = {
      children: [],
      set textContent(value) {
        this.children = []
        this.text = value
      },
      appendChild(child) {
        this.children.push(child)
      },
    }
    const host = { constructionPanel: panel, menu: { context: ctx, clearActionHotkeys() {} } }
    renderInventoryConstruction(host)
    assert.equal(panel.children[0].textContent, 'constructionTerritoryOccupied:Hellas')
    owner.buildings[0].isDead = true
    renderInventoryConstruction(host)
    assert.deepEqual(panel.children, [])
  } finally {
    global.document = previous
  }
})

test('only completed living town centers claim land, regardless of the remaining units', () => {
  const owner = resident()
  owner.units = []
  assert.equal(findMapTerritoryOwner([owner]), owner)
  owner.buildings[0].isBuilt = false
  assert.equal(findMapTerritoryOwner([owner]), null)
  owner.buildings[0].isBuilt = true
  owner.buildings[0].hitPoints = 0
  assert.equal(findMapTerritoryOwner([owner]), null)
  owner.buildings = [{ ...alive(), type: 'House', isBuilt: true }]
  assert.equal(findMapTerritoryOwner([owner]), null)
})

test('destroying a center frees construction without transferring surviving buildings or units', () => {
  const owner = resident()
  const player = human()
  const house = { ...alive(), type: 'House', isBuilt: true }
  owner.buildings.push(house)
  owner.buildings[0].isDestroyed = true
  assert.equal(constructionTerritoryBlocker(context([owner, player]), player), null)
  assert.equal(owner.buildings[1], house)
  assert.equal(owner.units.length, 1)
  assert.deepEqual(player.buildings, [])
  player.buildings.push(center())
  assert.equal(findMapTerritoryOwner([owner, player], settlements), player)
  assert.equal(owner.buildings[1], house)
})
