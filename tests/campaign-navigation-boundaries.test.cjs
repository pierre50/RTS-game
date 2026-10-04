const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const api = loadTsModule('app/serialization/CampaignSave.ts', {
  mocks: { '../services/world/WorldEconomy': { economyAfterWorldSave: campaign => campaign.economy } },
})
const state = patch => ({ players: [], ...patch })
test('campaign bootstrap derives stable identities and normalizes invalid clock values', () => {
  const now = 123
  for (const [world, id, name] of [
    [state({ world: { seed: 'a/b', size: 20 }, runtime: { dayNightElapsedMs: -1 } }), 'world-a-b', 'Monde 20'],
    [
      state({ config: { seed: 7, size: 10, environment: 'snow' }, runtime: { dayNightElapsedMs: 12 } }),
      'world-7',
      'Monde 10',
    ],
    [state(), 'world-123', 'world-123'],
  ]) {
    const campaign = api.createInitialCampaignSave(world, { now })
    assert.equal(campaign.currentWorldId, id)
    assert.equal(campaign.worlds[id].name, name)
    assert.equal(campaign.clock.dayNightElapsedMs, world.runtime?.dayNightElapsedMs === 12 ? 12 : 0)
    assert.equal(api.getCurrentWorldState(campaign), world)
  }
  assert.ok(api.createInitialCampaignSave(state()).currentWorldId.startsWith('world-'))
  const legacy = state()
  assert.equal(api.getCurrentWorldState(legacy), legacy)
})
test('campaign navigation rejects missing worlds without mutating the saved campaign', () => {
  const campaign = api.createInitialCampaignSave(state(), { worldId: 'root', now: 1 })
  const original = structuredClone(campaign)
  assert.equal(api.returnToParentWorld(campaign), campaign)
  assert.throws(() => api.getCurrentWorldState({ ...campaign, currentWorldId: 'missing' }), /current campaign world/)
  assert.throws(
    () => api.updateCurrentWorldState({ ...campaign, currentWorldId: 'missing' }, state()),
    /current campaign world/
  )
  assert.throws(
    () => api.addChildWorldToCampaign(campaign, state(), { parentWorldId: 'missing' }),
    /parent campaign world/
  )
  assert.throws(() => api.enterCampaignWorld(campaign, 'missing'), /target campaign world/)
  assert.deepEqual(campaign, original)
})
test('revisiting a child preserves discovery and does not duplicate the parent link', () => {
  const root = api.createInitialCampaignSave(state({ players: [{ isPlayed: true, label: 'human' }] }), {
    worldId: 'root',
    now: 1,
  })
  const child = state({
    world: { mapType: 'interior', seed: 'room' },
    players: [{ type: 'Bandits' }, { units: [{ type: 'Villager', hitPoints: 5 }] }],
  })
  const entered = api.addChildWorldToCampaign(root, child)
  assert.equal(entered.worldGraph.nodes['world-room'].kind, 'interior')
  assert.equal(entered.heroParty.playerLabel, 'human')
  const returned = api.returnToParentWorld(entered, 5)
  const revisited = api.addChildWorldToCampaign(returned, child, { now: 8 })
  assert.deepEqual(revisited.worldGraph.nodes.root.children, ['world-room'])
  assert.equal(revisited.worlds['world-room'].discoveredAt, entered.worlds['world-room'].discoveredAt)
  assert.equal(api.enterCampaignWorld(revisited, 'root').currentWorldId, 'root')
  const orphan = structuredClone(entered)
  delete orphan.worlds.root
  assert.throws(() => api.returnToParentWorld(orphan), /parent campaign world/)
})
test('legacy campaigns without graph nodes retain world data and the existing party', () => {
  const campaign = api.createInitialCampaignSave(state(), { worldId: 'root', now: 1 })
  campaign.heroParty.playerLabel = 'human'
  campaign.worldGraph.nodes = {}
  delete campaign.factions
  const updated = api.updateCurrentWorldState(campaign, state(), 3)
  assert.equal(updated.heroParty.playerLabel, 'human')
  assert.deepEqual(updated.worldGraph.nodes, {})
  const child = api.addChildWorldToCampaign(updated, state({ config: { mapType: 'interior', seed: 4 } }))
  assert.equal(child.worldGraph.nodes['world-4'].kind, 'interior')
  assert.equal(api.returnToParentWorld(child).currentWorldId, 'root')
  assert.deepEqual(api.enterCampaignWorld(child, 'root').worldGraph, child.worldGraph)
  child.worldGraph.nodes.root = { id: 'root', visitedAt: 3 }
  delete child.worldGraph.nodes['world-4'].discoveredAt
  assert.equal(api.getVisitedWorldNodes(child).length, 2)
})
