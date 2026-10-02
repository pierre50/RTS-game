const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('building levels share geometry while keeping independent images and cache entries', async () => {
  const pixi = await import('pixi.js')
  const { Assets, Spritesheet, Texture, TextureSource } = pixi
  const { ASSET_BUNDLES } = loadTsModule('app/config/assetManifest.ts')
  const { registerBuildingSpritesheets } = loadTsModule('app/lib/buildings/buildingSpritesheets.ts', {
    mocks: { 'pixi.js': pixi },
  })
  const { getTextureByFrame } = loadTsModule('app/lib/graphics/textures.ts')
  const { getBuildingAsset } = loadTsModule('app/lib/graphics/assets.ts')
  const publicPath = assetPath => path.join(__dirname, '..', 'public', assetPath)
  const data = JSON.parse(fs.readFileSync(publicPath(ASSET_BUNDLES.graphics['buildings/age-0']), 'utf8'))
  const base = new Spritesheet({
    texture: new Texture({ source: new TextureSource({ width: data.meta.size.w, height: data.meta.size.h }) }),
    data,
  })
  await base.parse()
  Assets.cache.set('buildings/age-0', base)
  const shadowData = JSON.parse(fs.readFileSync(publicPath(ASSET_BUNDLES.graphics['buildings/age-0/shadow']), 'utf8'))
  const shadow = new Spritesheet({
    texture: new Texture({
      source: new TextureSource({ width: shadowData.meta.size.w, height: shadowData.meta.size.h }),
    }),
    data: shadowData,
  })
  await shadow.parse()
  Assets.cache.set('buildings/age-0/shadow', shadow)

  const images = [publicPath(`assets/graphics/buildings/${data.meta.image}`)]
  for (const level of [1, 2]) {
    const alias = `buildings/age-${level}/image`
    images.push(publicPath(ASSET_BUNDLES.graphics[alias]))
    Assets.cache.set(alias, new Texture({ source: new TextureSource({ width: 1807, height: 139 }) }))
  }
  for (const image of images) {
    const png = fs.readFileSync(image)
    assert.equal(png.readUInt32BE(16), data.meta.size.w)
    assert.equal(png.readUInt32BE(20), data.meta.size.h)
  }
  assert.equal(new Set(images.map(image => fs.readFileSync(image).toString('base64'))).size, 3)
  await registerBuildingSpritesheets()

  for (const civ of fs.readdirSync(publicPath('assets/data/civilizations'))) {
    const config = JSON.parse(fs.readFileSync(publicPath(`assets/data/civilizations/${civ}`), 'utf8'))
    const configAssets = { cache: { get: () => config } }
    for (const type of Object.keys(config.buildings[0])) {
      const textures = []
      for (const level of [0, 1, 2]) {
        const ref = getBuildingAsset(type, { level }, configAssets).images.final
        assert.equal(ref.sheet, `buildings/age-${level}`)
        const texture = getTextureByFrame(ref.sheet, ref.frame, Assets)
        textures.push(texture)
        assert.deepEqual(texture.frame, textures[0].frame)
        assert.deepEqual(texture.defaultAnchor, textures[0].defaultAnchor)
        assert.ok(getTextureByFrame(`${ref.sheet}/shadow`, ref.frame, Assets))
      }
      assert.equal(new Set(textures.map(texture => texture.source)).size, 3)
    }
  }
  const firstFrame = Object.keys(data.frames)[0]
  assert.equal(Assets.cache.get(firstFrame), base.textures[firstFrame])
  for (const level of [1, 2]) {
    const alias = `buildings/age-${level}`
    const sheet = Assets.cache.get(alias)
    assert.equal(Assets.cache.get(`${alias}/${firstFrame}`), sheet.textures[firstFrame])
    await registerBuildingSpritesheets()
    assert.equal(Assets.cache.get(alias), sheet)
  }
})
