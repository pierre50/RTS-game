const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadPlayerActions() {
  return loadTsModule('app/dev-console/actions/player.ts', {
    mocks: {
      '../../lib/audio/settings': {
        GAME_SPEED_USAGE: 'speed [1|2]',
        isGameSpeedPreset: value => [1, 2].includes(value),
      },
      './shared': { normalizeToggle: (value, current) => (value === 'on' ? true : value === 'off' ? false : !current) },
    },
  })
}

test('listFactions prints campaign relations and local spawn indices', () => {
  const { listFactions } = loadPlayerActions()
  const result = listFactions({
    getCampaignFactions: () => ({
      bandits: {
        id: 'bandits',
        name: 'Bandits',
        color: 'black',
        relationState: 'hostile',
        relationScore: -65,
        homeWorldId: 'root',
        knownWorldIds: ['yellow-world'],
        discoveredAt: 1,
        updatedAt: 1,
      },
      'civ-latium': {
        id: 'civ-latium',
        civilization: 'Latium',
        name: 'House Latium',
        color: 'red',
        relationState: 'neutral',
        relationScore: 0,
        homeWorldId: 'root',
        knownWorldIds: ['latium-world'],
        discoveredAt: 1,
        updatedAt: 1,
      },
    }),
    getCurrentWorldId: () => 'latium-world',
    player: { isEnemy: () => false },
    players: [{ factionId: 'civ-latium', units: [{}, {}], buildings: [{}] }],
  })

  assert.equal(result.ok, true)
  assert.match(result.message, /House Latium .* civ=Latium .* color=red .* relation=neutral \(0\)/)
  assert.match(result.message, /worlds=latium-world\*/)
  assert.match(result.message, /playerIndex=0 units=2 buildings=1/)
  assert.match(result.message, /Bandits .* color=black .* relation=hostile \(-65\)/)
  assert.match(result.message, /not local/)
})

test('listLocalPlayers uses runtime indices even with a campaign roster', () => {
  const { listLocalPlayers } = loadPlayerActions()
  const enemy = { buildings: [], civ: 'Latium', color: 'red', label: 'enemy', name: 'Enemy', units: [] }
  const hero = {
    buildings: [],
    civ: 'Hellas',
    color: 'green',
    isEnemy: target => target === enemy,
    label: 'hero',
    name: 'Hero',
    units: [],
  }
  const result = listLocalPlayers({
    getCampaignFactions: () => ({ unrelated: { name: 'Unrelated faction' } }),
    player: hero,
    players: [hero, enemy],
  })

  assert.equal(result.ok, true)
  assert.match(result.message, /^0\. Hero .* relation=self .* local/m)
  assert.match(result.message, /^1\. Enemy .* relation=hostile .* local/m)
})

test('hero invincible command toggles the active hero dev damage immunity', () => {
  const { toggleHeroInvincible } = loadPlayerActions()
  const hero = { hitPoints: 7 }
  const context = { controls: { heroUnit: hero } }

  assert.deepEqual(toggleHeroInvincible(context, 'on'), { ok: true, message: 'Hero invincible: on' })
  assert.equal(hero.devInvincible, true)
  assert.deepEqual(toggleHeroInvincible(context, 'off'), { ok: true, message: 'Hero invincible: off' })
  assert.equal(hero.devInvincible, false)
})

test('hero invincible command reports when no active hero exists', () => {
  const { toggleHeroInvincible } = loadPlayerActions()

  assert.deepEqual(toggleHeroInvincible({ controls: { heroUnit: null } }), {
    ok: false,
    message: 'No active hero found',
  })
})

test('the obsolete age command is no longer exposed', () => {
  assert.equal(loadPlayerActions().setAge, undefined)
})
