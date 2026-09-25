const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { playerColors } = loadTsModule('app/lib/graphics/playerColorData.ts')
const { normalizePlayerColor, isKnownPlayerColor } = loadTsModule('app/ui/PlayerSetupColors.ts')
const mocks = { '../graphics/colors': { playerColors } }
const { buildWorldRegionPlayerConfigs } = loadTsModule('app/screens/game/WorldRegionPlayers.ts', { mocks })
const { ensureCampaignPlayerRoster } = loadTsModule('app/lib/campaign/playerRoster.ts', { mocks })

test('blue remains selectable alongside violet', () => {
  assert.ok(isKnownPlayerColor('blue'))
  assert.ok(isKnownPlayerColor('violet'))
  assert.equal(normalizePlayerColor('blue'), 'blue')
})

for (const color of playerColors) {
  test(`1000 map villages exclude the hero's ${color}, with or without saved factions`, () => {
    const blueprint = { size: 1000, settlements: [
      { kind: 'village', civ: 'Hellas' },
      { kind: 'city', civ: 'Latium' },
      ...Array.from({ length: 12 }, () => ({ kind: 'village', civ: 'Kemet' })),
    ] }
    const config = { heroStartVillage: 'Hellas', players: [{ civ: 'Hellas', color, isHuman: true }] }
    for (const factions of [undefined, { host: { id: 'host', civilization: 'Hellas', color } }]) {
      const players = buildWorldRegionPlayerConfigs(config, blueprint, factions)
      assert.equal(players.filter(player => player.isHuman).length, 1)
      assert.equal(players.find(player => player.isHuman).color, color)
      for (const player of players.filter(player => !player.isHuman)) assert.notEqual(player.color, color)
      assert.deepEqual(buildWorldRegionPlayerConfigs(config, blueprint, factions), players)
    }
  })

  test(`campaign repairs saved AI colors matching ${color} without changing bandits`, () => {
    const campaign = {
      currentWorldId: 'root', worldGraph: { rootWorldId: 'root' },
      worlds: { root: { state: { players: [{ isPlayed: true, civ: 'Hellas', color }] } } },
      factions: { legacy: { id: 'legacy', color } },
    }
    const initial = ensureCampaignPlayerRoster(campaign, 1)
    const ai = Object.values(initial.factions).find(faction => faction.id !== 'bandits' && faction.id !== 'legacy')
    const broken = { ...initial, factions: { ...initial.factions, [ai.id]: { ...ai, color } } }
    const repaired = ensureCampaignPlayerRoster(broken, 2)
    for (const faction of Object.values(repaired.factions)) {
      if (faction.id === 'bandits') assert.equal(faction.color, 'black')
      else assert.notEqual(faction.color, color)
    }
    assert.equal(ensureCampaignPlayerRoster(repaired, 3), repaired)
    assert.equal(broken.factions[ai.id].color, color)
  })
}
