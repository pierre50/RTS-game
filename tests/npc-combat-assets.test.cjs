const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { bakedLogicalAliases } = loadTsModule('app/lib/lpc/bakedAliases.ts')
const root = path.join(__dirname, '../public/assets/graphics/units')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))

test('every NPC body variant provides both ranged and melee combat animations', () => {
  let count = 0
  for (const asset of manifest.assets) {
    const [unit, ...parts] = asset.split('/')
    if (
      ![
        'villager',
        'infantry',
        'infantry_nohair',
        'chief',
        'priest',
        'bandit_chief',
        'bandit_sword',
        'bandit_archer',
      ].includes(unit)
    )
      continue
    const variant = parts.join('/')
    const aliases = bakedLogicalAliases(unit, variant)
    const shooting = `units/${asset}/${unit === 'bandit_archer' ? 'action' : 'action/shoot'}`
    const melee = `units/${asset}/${['villager', 'priest', 'bandit_archer'].includes(unit) ? 'action/slash' : 'action'}`
    const atlas = JSON.parse(fs.readFileSync(path.join(root, asset, 'texture.json'), 'utf8'))
    for (const [alias, requiredFrames] of [
      [shooting, 27],
      [melee, 18],
    ]) {
      assert.ok(aliases.includes(alias), `${alias} must be registered for loading`)
      const suffix = `_graphics_${alias.replaceAll('/', '_')}.png`
      assert.ok(
        Object.keys(atlas.frames).filter(key => key.endsWith(suffix)).length >= requiredFrames,
        `${alias} lacks combat frames`
      )
    }
    count++
  }
  assert.ok(count > 30, 'test must cover all civilizations and available genders')
})
