const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadModule(relativePath, mocks = {}) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
  })
  const module = { exports: {} }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const { displayObjectCanUpdateAnimation } = loadModule('app/lib/extra.js', {
  '../constants': { SHEET_TYPES: {}, WORK_TYPES: {} },
  './grid': { instanceIsInPlayerSight: () => false },
  './maths': {},
  './uiSound': {},
  './lang': {},
})

const { instanceShouldRender } = loadModule('app/lib/grid/visibility.js', {
  '../../constants': { BUCKET_SIZE: 8, FAMILY_TYPES: { resource: 'resource' } },
  '../../services/FogOfWar': { updateVisibility: () => {} },
})

test('skips animation updates when the entity container is hidden', () => {
  const entity = { visible: false, renderable: true, parent: null }
  const sprite = { playing: true, visible: true, renderable: true, destroyed: false, parent: entity }

  assert.equal(displayObjectCanUpdateAnimation(sprite), false)
  entity.visible = true
  assert.equal(displayObjectCanUpdateAnimation(sprite), true)
})

test('keeps hidden gameplay animations running when they have callbacks', () => {
  const entity = { visible: false, renderable: true, parent: null }
  const sprite = {
    playing: true,
    visible: true,
    renderable: true,
    destroyed: false,
    parent: entity,
    onComplete: () => {},
  }

  assert.equal(displayObjectCanUpdateAnimation(sprite), true)
})

test('renders an explored resource only while it is inside the camera', () => {
  let inCamera = false
  const resource = {
    family: 'resource',
    context: {
      map: { showResources: true, revealEverything: false, revealTerrain: false },
      player: {},
      controls: { instanceInCamera: () => inCamera },
    },
  }

  assert.equal(instanceShouldRender(resource), false)
  inCamera = true
  assert.equal(instanceShouldRender(resource), true)
})
