const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadAssetManifest() {
  const filename = path.join(__dirname, '../app/config/assetManifest.ts')
  const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports.ASSET_BUNDLES
}

test('bundled spritesheet frame cache ids are unique', () => {
  const seen = new Map()
  const duplicates = []

  for (const [bundleName, bundle] of Object.entries(loadAssetManifest())) {
    for (const [alias, assetPath] of Object.entries(bundle)) {
      if (!assetPath.endsWith('/texture.json')) continue

      const atlasPath = path.join(__dirname, '..', 'public', assetPath)
      assert.ok(fs.existsSync(atlasPath), `Manifest spritesheet is missing: ${assetPath}`)
      const atlas = JSON.parse(fs.readFileSync(atlasPath, 'utf8'))

      for (const frameName of Object.keys(atlas.frames || {})) {
        const current = `${bundleName}:${alias}`
        const previous = seen.get(frameName)
        if (previous) duplicates.push(`${frameName}: ${previous} and ${current}`)
        else seen.set(frameName, current)
      }
    }
  }

  assert.deepEqual(duplicates, [])
})
