const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadUnitWalkingAnimation() {
  const filename = path.join(__dirname, '../app/lib/units/unitWalkingAnimation.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '../constants': {
      SHEET_TYPES: {
        walking: 'walkingSheet',
      },
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('unit walking animation speed follows and restores movement speed factor', () => {
  const { applyUnitWalkingAnimationSpeed } = loadUnitWalkingAnimation()
  const layer = { animationSpeed: 0.4 }
  const unit = {
    currentSheet: 'walkingSheet',
    sprite: { animationSpeed: 0.4 },
    shadow: { animationSpeed: 0.4 },
    appearanceLayerSprites: new Map([[0, layer]]),
  }

  applyUnitWalkingAnimationSpeed(unit, 0.5)
  assert.equal(unit.sprite.animationSpeed, 0.2)
  assert.equal(unit.shadow.animationSpeed, 0.2)
  assert.equal(layer.animationSpeed, 0.2)

  applyUnitWalkingAnimationSpeed(unit, 1)
  assert.equal(unit.sprite.animationSpeed, 0.4)
  assert.equal(unit.shadow.animationSpeed, 0.4)
  assert.equal(layer.animationSpeed, 0.4)
})

test('unit walking animation speed ignores non-walking sheets', () => {
  const { applyUnitWalkingAnimationSpeed } = loadUnitWalkingAnimation()
  const unit = {
    currentSheet: 'standingSheet',
    sprite: { animationSpeed: 0.4 },
  }

  applyUnitWalkingAnimationSpeed(unit, 0.6)
  assert.equal(unit.sprite.animationSpeed, 0.4)
})
