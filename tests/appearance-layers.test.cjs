const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadModule(relativePath, mocks) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const constants = {
  SHEET_TYPES: {
    action: 'actionSheet',
    standing: 'standingSheet',
    walking: 'walkingSheet',
  },
}

test('carried-resource layers hide during action and return after it', () => {
  const { isAppearanceLayerHiddenByLoading } = loadModule('app/lib/lpc/appearanceLayers.ts', {
    '../../constants': constants,
  })
  const carriedResourceLayer = { showWhenLoading: true }

  assert.equal(
    isAppearanceLayerHiddenByLoading({
      layer: carriedResourceLayer,
      isLoading: true,
      sheet: constants.SHEET_TYPES.action,
      heroControlled: false,
    }),
    true
  )
  assert.equal(
    isAppearanceLayerHiddenByLoading({
      layer: carriedResourceLayer,
      isLoading: true,
      sheet: constants.SHEET_TYPES.standing,
      heroControlled: false,
    }),
    false
  )
  assert.equal(
    isAppearanceLayerHiddenByLoading({
      layer: carriedResourceLayer,
      isLoading: true,
      sheet: constants.SHEET_TYPES.walking,
      heroControlled: false,
    }),
    false
  )
})

test('tools hidden while carrying come back during action', () => {
  const { isAppearanceLayerHiddenByLoading } = loadModule('app/lib/lpc/appearanceLayers.ts', {
    '../../constants': constants,
  })
  const toolLayer = { hideWhenLoading: true }

  assert.equal(
    isAppearanceLayerHiddenByLoading({
      layer: toolLayer,
      isLoading: true,
      sheet: constants.SHEET_TYPES.action,
      heroControlled: false,
    }),
    false
  )
  assert.equal(
    isAppearanceLayerHiddenByLoading({
      layer: toolLayer,
      isLoading: true,
      sheet: constants.SHEET_TYPES.standing,
      heroControlled: false,
    }),
    true
  )
  assert.equal(
    isAppearanceLayerHiddenByLoading({
      layer: toolLayer,
      isLoading: true,
      sheet: constants.SHEET_TYPES.walking,
      heroControlled: false,
    }),
    true
  )
})
