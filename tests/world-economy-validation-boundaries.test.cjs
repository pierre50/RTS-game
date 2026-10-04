const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { validateWorldEconomy } = loadTsModule('app/serialization/validation/WorldEconomyValidation.ts')
const region = () => ({ regionId: 'region', simulatedUntilMs: 0, terrain: ['.#~:'], worldId: 'world' })
const campaign = economy => ({ worlds: { world: { state: { config: { worldRegionId: 'region' } } } }, economy })
const economy = patch => ({ version: 1, regions: { region: region() }, ...patch })
test('economy validator accepts absent economies and rejects malformed envelopes and raid cooldowns', () => {
  assert.doesNotThrow(() => validateWorldEconomy(campaign(), {}))
  assert.doesNotThrow(() => validateWorldEconomy(campaign(economy({ lastFactionRaidDays: { clan: 1 } })), {}))
  for (const value of [
    false,
    { version: 2, regions: {} },
    { version: 1, regions: [] },
    ...[false, { clan: 0 }, { clan: 0.5 }].map(lastFactionRaidDays => economy({ lastFactionRaidDays })),
  ])
    assert.throws(() => validateWorldEconomy(campaign(value), {}), /Invalid save file/)
})
test('economy regions require valid terrain, timestamps and matching world references', () => {
  const invalid = [
    false,
    ...[
      { regionId: 'other' },
      { simulatedUntilMs: '0' },
      { simulatedUntilMs: -1 },
      { terrain: false },
      { terrain: [] },
      { terrain: [3] },
      { terrain: ['x'] },
      { worldId: 'missing' },
      { initialState: {} },
      { worldId: null, initialState: null },
      { worldId: null, initialState: { config: { worldRegionId: 'other' } } },
    ].map(patch => ({ ...region(), ...patch })),
  ]
  for (const value of invalid)
    assert.throws(
      () => validateWorldEconomy(campaign(economy({ regions: { region: value } })), {}),
      /Invalid save file/
    )
  const mismatched = campaign(economy())
  mismatched.worlds.world.state.config.worldRegionId = 'elsewhere'
  assert.throws(() => validateWorldEconomy(mismatched, {}), /world reference/)
})
