const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { getBaseTerritory } = loadTsModule('app/lib/territory/baseTerritory.ts')
const { BASE_TERRITORY_RADIUS: radius } = loadTsModule('app/config/territory.ts')
const { getPlayerResourceTotals, withdrawChestResources } = loadTsModule('app/lib/resources/playerResourceTotals.ts')

function base(label = 'p', i = 0) {
  const player = { label, isPlayed: true, units: [], buildings: [] }
  player.buildings.push({ type: 'TownCenter', label: 'center', i, j: 0, owner: player })
  return player
}
function chest(player, i, wood, extra = {}) {
  const store = { type: 'Chest', i, j: 0, owner: player, inventory: { resources: { wood } }, ...extra }
  player.buildings.push(store)
  return store
}

test('territory uses inclusive Euclidean cells and the closest living completed center', () => {
  const own = base(),
    other = base('other', radius)
  assert.equal(getBaseTerritory({ i: -radius, j: 0 }, [own, other]).owner, own)
  assert.equal(getBaseTerritory({ i: -radius, j: 1 }, [own, other]), null)
  assert.equal(getBaseTerritory({ i: radius - 1, j: 0 }, [own, other]).owner, other)
  other.buildings[0].isDestroyed = true
  assert.equal(getBaseTerritory({ i: radius - 1, j: 0 }, [own, other]).owner, own)
  own.buildings[0].isBuilt = false
  assert.equal(getBaseTerritory({ i: 0, j: 0 }, [own, other]), null)
})

test('interior reserves use the exterior position, isolated chests and caves are excluded', () => {
  const player = base()
  player.buildings.push({ type: 'House', label: 'house', i: 2, j: 0 })
  chest(player, 999, 20, { spaceId: 'interior:p:house' })
  chest(player, radius + 1, 100)
  chest(player, 0, 100, { spaceId: 'cave:1' })
  assert.equal(getPlayerResourceTotals(player, { includeHero: false }).wood, 20)
  player.buildings[0].isDestroyed = true
  assert.equal(getPlayerResourceTotals(player, { includeHero: false }).wood, 0)
})

test('chief only spends shared reserves inside own territory; upkeep remains independent', () => {
  const player = base(),
    other = base('other', radius)
  const hero = { type: 'Hero', isChief: true, i: 0, j: 0, owner: player, inventory: { resources: { wood: 5 } } }
  player.units.push(hero)
  player.context = { players: [player, other], controls: { heroUnit: hero } }
  const store = chest(player, 2, 30)
  const remote = chest(player, radius + 1, 100)
  assert.equal(getPlayerResourceTotals(player).wood, 35)
  hero.i = radius - 1
  assert.equal(getPlayerResourceTotals(player).wood, 5)
  assert.equal(withdrawChestResources(player, { wood: 6 }), false)
  assert.equal(withdrawChestResources(player, { wood: 10 }, { includeHero: false }), true)
  assert.equal(hero.inventory.resources.wood, 5)
  assert.equal(store.inventory.resources.wood, 20)
  assert.equal(remote.inventory.resources.wood, 100)
  hero.i = 0
  hero.isChief = false
  assert.equal(getPlayerResourceTotals(player).wood, 5)
  hero.isChief = true
  hero.spaceId = 'interior:p:center'
  hero.i = 999
  assert.equal(getPlayerResourceTotals(player).wood, 25)
})
