const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { playerRelation } = loadTsModule('app/lib/combat/playerRelation.ts')

test('display handles live hostility, shared faction, teams and neutral owners', () => {
  const player = { label: 'hero', factionId: 'hero', team: null }
  const faction = { relationState: 'friendly' }
  const context = { player, getCampaignFactions: () => ({ village: faction }) }
  const owner = { label: 'village', factionId: 'village', diplomacy: null }
  assert.equal(playerRelation(context, owner), 'friendly')
  owner.isEnemy = () => true
  assert.equal(playerRelation(context, owner), 'hostile')
  owner.factionId = 'hero'
  assert.equal(playerRelation(context, owner), 'allied')
  owner.type = 'Gaia'
  owner.diplomacy = 'neutral'
  assert.equal(playerRelation(context, owner), 'neutral')
  assert.equal(playerRelation({ player: { team: 2 } }, { team: 2 }), 'allied')
  assert.equal(playerRelation({ player }, { type: 'Bandits', civ: 'Hellas' }), 'hostile')
  assert.equal(playerRelation({ player }, { diplomacy: 'neutral' }), 'neutral')
})
