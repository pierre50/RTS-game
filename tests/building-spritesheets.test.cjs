const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const publicPath = assetPath => path.join(__dirname, '..', 'public', assetPath)
const sharedTypes = new Set(['ArcheryRange', 'Market', 'StoragePit', 'Forge'])
// Levels whose atlas anchors were hand-tuned to seat that sprite on its footprint.
const tunedAnchorLevels = { Granary: [0], StoragePit: [0] }

test('all civilizations resolve the unified building atlas and matching shared shadows', async () => {
  const { Assets, Spritesheet, Texture, TextureSource } = await import('pixi.js')
  const { ASSET_BUNDLES } = loadTsModule('app/config/assetManifest.ts')
  const { getTextureByFrame } = loadTsModule('app/lib/graphics/textures.ts')
  const { getBuildingAsset } = loadTsModule('app/lib/graphics/assets.ts')
  const sheets = {}
  for (const alias of ['buildings', 'buildings/shadow']) {
    const assetPath = publicPath(ASSET_BUNDLES.graphics[alias])
    const data = JSON.parse(fs.readFileSync(assetPath, 'utf8'))
    const png = fs.readFileSync(path.join(path.dirname(assetPath), data.meta.image))
    assert.equal(png.readUInt32BE(16), data.meta.size.w)
    assert.equal(png.readUInt32BE(20), data.meta.size.h)
    assert.equal(Object.keys(data.frames).length, 29)
    for (const { frame } of Object.values(data.frames)) {
      assert.ok(frame.x >= 0 && frame.y >= 0)
      assert.ok(frame.x + frame.w <= data.meta.size.w)
      assert.ok(frame.y + frame.h <= data.meta.size.h)
    }
    const sheet = new Spritesheet({
      texture: new Texture({ source: new TextureSource({ width: data.meta.size.w, height: data.meta.size.h }) }),
      data,
    })
    await sheet.parse()
    Assets.cache.set(alias, sheet)
    sheets[alias] = sheet
  }
  assert.equal(
    Object.keys(ASSET_BUNDLES.graphics).some(alias => alias.startsWith('buildings/age-')),
    false
  )
  const names = Object.keys(sheets.buildings.data.frames)
  for (const [style, count] of [
    ['rustic', 7],
    ['village', 11],
    ['upgraded', 11],
  ]) {
    const styleNames = names.filter(name => name.includes(`_${style}_`))
    assert.equal(styleNames.length, count)
    assert.equal(new Set(styleNames.map(name => sheets.buildings.data.frames[name].frame.y)).size, 1)
  }

  const usedFrames = new Set()
  for (const civ of fs.readdirSync(publicPath('assets/data/civilizations'))) {
    const config = JSON.parse(fs.readFileSync(publicPath(`assets/data/civilizations/${civ}`), 'utf8'))
    const configAssets = { cache: { get: () => config } }
    for (const type of Object.keys(config.buildings[0])) {
      const textures = []
      const shadows = []
      const anchorLevels = [0, 1, 2].filter(level => !tunedAnchorLevels[type]?.includes(level))
      for (const level of [0, 1, 2]) {
        const ref = getBuildingAsset(type, { level }, configAssets).images.final
        assert.equal(ref.sheet, 'buildings')
        usedFrames.add(ref.frame)
        const texture = getTextureByFrame(ref.sheet, ref.frame, Assets)
        const shadow = getTextureByFrame(`${ref.sheet}/shadow`, ref.frame, Assets)
        textures.push(texture)
        shadows.push(shadow)
        assert.equal(texture.width, textures[0].width)
        assert.equal(texture.height, textures[0].height)
        assert.equal(texture.source, textures[0].source)
        assert.deepEqual(shadow.frame, shadows[0].frame)
      }
      for (const level of anchorLevels.slice(1)) {
        assert.deepEqual(textures[level].defaultAnchor, textures[anchorLevels[0]].defaultAnchor, `${type} ${level}`)
        assert.deepEqual(shadows[level].defaultAnchor, shadows[anchorLevels[0]].defaultAnchor, `${type} ${level}`)
      }
      // Shared types have no rustic art: they open on the village sprite and upgrade one level earlier,
      // keeping the upgraded sprite at the last level. Never resolve to a neighbouring frame.
      const shared = sharedTypes.has(type)
      const [village, upgraded] = shared ? [textures[0], textures[1]] : [textures[1], textures[2]]
      if (shared) assert.equal(textures[2], textures[1], type)
      else assert.notEqual(textures[0], textures[1], type)
      assert.notEqual(village, upgraded, type)
      assert.equal(village.frame.x, upgraded.frame.x, type)
      assert.ok(village.frame.y < upgraded.frame.y, type)
    }
  }
  assert.equal(usedFrames.size, 29)
})
