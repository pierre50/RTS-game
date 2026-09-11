const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { playableColor } = loadTsModule('app/lib/graphics/playableColor.ts')
const { normalizePlayerColor } = loadTsModule('app/ui/PlayerSetupColors.ts')
const { ensureCampaignPlayerRoster } = loadTsModule('app/lib/campaign/playerRoster.ts', {
  mocks: {
    '../graphics/colors': { playerColors: ['violet', 'red', 'yellow', 'brown', 'orange', 'green', 'teal'] },
  },
})

for (const color of ['grey', 'gray', 'black']) {
  test(`reserved ${color} is replaced in player setup and runtime`, () => {
    assert.equal(playableColor(color, 'red'), 'red')
    assert.equal(normalizePlayerColor(color), 'violet')
  })
}

test('campaign repair removes reserved AI colors, preserves bandits and is stable', () => {
  const campaign = {
    currentWorldId: 'root',
    worldGraph: { rootWorldId: 'root' },
    worlds: { root: { state: { players: [{ isPlayed: true, civ: 'Hellas', color: 'green' }] } } },
    factions: {},
  }
  const initial = ensureCampaignPlayerRoster(campaign, 1)
  const ai = Object.values(initial.factions).find(faction => faction.id !== 'bandits')
  for (const color of ['grey', 'gray', 'black']) {
    const broken = {
      ...initial,
      factions: { ...initial.factions, [ai.id]: { ...ai, color }, legacy: { ...ai, id: 'legacy', color } },
    }
    const repaired = ensureCampaignPlayerRoster(broken, 2)
    for (const faction of Object.values(repaired.factions)) {
      if (faction.id === 'bandits') assert.equal(faction.color, 'black')
      else assert.ok(!['grey', 'gray', 'black'].includes(faction.color))
    }
    assert.equal(ensureCampaignPlayerRoster(repaired, 3), repaired)
    assert.equal(broken.factions[ai.id].color, color)
  }
  assert.equal(playableColor('green'), 'green')
})
