const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadCampaignSave() {
  const filename = path.join(__dirname, '../app/serialization/CampaignSave.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports
}

function worldSave(seed = 42) {
  return {
    version: 2,
    runtime: { elapsedMs: 0 },
    camera: { x: 0, y: 0 },
    world: { seed, size: 144, mapType: 'continent', positionsCount: 3, pregeneratedBlueprintId: null },
    config: { seed, size: 144, mapType: 'continent' },
    players: [{ label: 'player-1', type: 'Human', isPlayed: true, buildings: [], units: [], corpses: [], views: [[{}]] }],
    resources: [],
    animals: [],
  }
}

const {
  addChildWorldToCampaign,
  createInitialCampaignSave,
  getCurrentWorldState,
  getVisitedWorldNodes,
  getWorldTreePath,
  isCampaignSave,
  returnToParentWorld,
  updateCurrentWorldState,
} = loadCampaignSave()

test('wraps a single world save as a campaign root', () => {
  const world = worldSave(123)
  const campaign = createInitialCampaignSave(world, {
    color: 'blue',
    name: 'Plaine de départ',
    now: 1000,
    worldId: 'root',
  })

  assert.equal(campaign.format, 'campaign-v1')
  assert.equal(campaign.currentWorldId, 'root')
  assert.equal(campaign.worlds.root.state, world)
  assert.equal(campaign.worldGraph.rootWorldId, 'root')
  assert.deepEqual(campaign.worldGraph.nodes.root.children, [])
  assert.equal(campaign.heroParty.playerLabel, 'player-1')
  assert.equal(isCampaignSave(campaign), true)
  assert.equal(getCurrentWorldState(campaign), world)
})

test('updates the current world state while preserving graph data', () => {
  const campaign = createInitialCampaignSave(worldSave(123), { now: 1000, worldId: 'root' })
  const nextWorld = worldSave(456)
  nextWorld.players[0].label = 'hero-player'

  const updated = updateCurrentWorldState(campaign, nextWorld, 2000)

  assert.equal(updated.worlds.root.state, nextWorld)
  assert.equal(updated.worlds.root.visitedAt, 2000)
  assert.equal(updated.worldGraph.nodes.root.visitedAt, 2000)
  assert.equal(updated.heroParty.playerLabel, 'hero-player')
})

test('adds a child world and records the portal tree path', () => {
  const campaign = createInitialCampaignSave(worldSave(123), { now: 1000, worldId: 'root' })
  const childState = worldSave(456)

  const next = addChildWorldToCampaign(campaign, childState, {
    color: 'red',
    entryPortalId: 'portal-red-root',
    name: 'Ruines rouges',
    now: 2000,
    returnPortalId: 'portal-return',
    worldId: 'child-red',
  })

  assert.equal(next.currentWorldId, 'child-red')
  assert.equal(next.worlds['child-red'].parentWorldId, 'root')
  assert.equal(next.worlds['child-red'].entryPortalId, 'portal-red-root')
  assert.equal(next.worlds['child-red'].returnPortalId, 'portal-return')
  assert.deepEqual(next.worldGraph.nodes.root.children, ['child-red'])
  assert.equal(next.worldGraph.nodes['child-red'].parentId, 'root')
  assert.equal(getCurrentWorldState(next), childState)
})

test('returns to the parent world without deleting the child state', () => {
  const campaign = createInitialCampaignSave(worldSave(123), { now: 1000, worldId: 'root' })
  const child = addChildWorldToCampaign(campaign, worldSave(456), { now: 2000, worldId: 'child' })

  const returned = returnToParentWorld(child, 3000)

  assert.equal(returned.currentWorldId, 'root')
  assert.equal(returned.worlds.child.state.world.seed, 456)
  assert.equal(returned.worlds.root.visitedAt, 3000)
  assert.equal(returned.worldGraph.nodes.root.visitedAt, 3000)
})

test('exposes visited world nodes and the current tree path for the inventory map', () => {
  const campaign = createInitialCampaignSave(worldSave(123), { now: 1000, worldId: 'root' })
  const child = addChildWorldToCampaign(campaign, worldSave(456), { now: 2000, worldId: 'child' })

  assert.deepEqual(
    getWorldTreePath(child).map(node => node.id),
    ['root', 'child']
  )
  assert.deepEqual(
    getVisitedWorldNodes(child).map(node => node.id),
    ['root', 'child']
  )
})
