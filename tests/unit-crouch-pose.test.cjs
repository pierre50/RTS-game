const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const meshes = []
class Mesh {
  constructor(options) {
    Object.assign(this, options)
    this.position = {}
    this.scale = {}
    meshes.push(this)
  }
  destroy(options) {
    this.destroyOptions = options
  }
}
const { applyUnitCrouchPose, resetUnitCrouchPose } = loadTsModule('app/lib/units/unitCrouchPose.ts', {
  mocks: {
    'pixi.js': { MeshSimple: Mesh },
    '../../constants': { SHEET_TYPES: { walking: 'walking', standing: 'standing' } },
  },
})
function sprite() {
  const parent = {
    children: [],
    addChild(child) {
      this.children.push(child)
      child.parent = this
    },
    removeChild(child) {
      this.children.splice(this.children.indexOf(child), 1)
      child.parent = null
    },
  }
  return {
    alpha: 0.8,
    anchor: { x: 0.5, y: 1 },
    currentFrame: 0,
    position: { x: 10, y: 20 },
    scale: { x: 1, y: 1 },
    texture: { frame: { width: 64, height: 64 } },
    textures: [],
    visible: true,
    zIndex: 5,
    parent,
  }
}
function unit() {
  return { sprite: sprite(), currentSheet: 'walking', shadow: { scale: { x: 2, y: 3 } } }
}
function fullyCrouch(value) {
  for (let i = 0; i < 6; i++) applyUnitCrouchPose(value, true)
}

test('crouching blends body and shadow, follows animation frames and restores original rendering', () => {
  const value = unit()
  value.sprite.label = 'body'
  const filters = [{}]
  value.sprite.filters = filters
  const frame = { frame: { width: 32, height: 64 } }
  value.sprite.textures = [frame]
  fullyCrouch(value)
  const mesh = value.sprite.parent.children[0]
  assert.equal(value.isCrouching, true)
  assert.equal(value.sprite.parent.children.length, 1)
  assert.equal(mesh.texture, frame)
  assert.equal(mesh.label, 'body-crouch-pose')
  assert.equal(mesh.visible, true)
  assert.equal(mesh.alpha, 0.8)
  assert.equal(value.sprite.alpha, 0)
  assert.deepEqual(mesh.filters, filters)
  assert.notEqual(mesh.filters, filters)
  assert.equal(mesh.zIndex, 5)
  assert.equal(mesh.vertices[1], 4)
  assert.equal(mesh.vertices[mesh.vertices.length - 1], 64)
  assert.deepEqual(value.shadow.scale, { x: 1.8, y: 2.2199999999999998 })
  for (let i = 0; i < 6; i++) applyUnitCrouchPose(value, false)
  assert.equal(value.isCrouching, false)
  assert.equal(value.sprite.alpha, 0.8)
  assert.equal(value.sprite.parent.children.length, 0)
  assert.deepEqual(mesh.destroyOptions, { children: true, texture: false })
  assert.deepEqual(value.shadow.scale, { x: 2, y: 3 })
  resetUnitCrouchPose(value)
})

test('held equipment translates while clothing follows the compressed body', () => {
  const value = unit()
  const keys = [
    'bow',
    'bow_great',
    'bow_recurve',
    'halberd',
    'longsword',
    'cane',
    'arrow_wood',
    'axe_iron',
    'hammer_iron',
    'pickaxe_iron',
    'round_shield_wood',
    'scythe_iron',
    'sword_iron',
    'shirt',
    undefined,
  ]
  value.appearance = { layers: keys.map(equipmentKey => ({ equipmentKey })) }
  value.appearanceLayerSprites = new Map(keys.map((key, index) => [index, sprite()]))
  fullyCrouch(value)
  for (const [index, source] of value.appearanceLayerSprites) {
    const mesh = source.parent.children[0]
    assert.equal(mesh.vertices[mesh.vertices.length - 1], index < 13 ? 68 : 64)
  }
  resetUnitCrouchPose(value)
  for (const source of value.appearanceLayerSprites.values()) assert.equal(source.alpha, 0.8)
})

test('removed layers recover alpha and hide meshes, invisible and detached sources are skipped', () => {
  const value = unit()
  const layer = sprite()
  const hidden = sprite()
  hidden.visible = false
  const detached = sprite()
  detached.parent = null
  value.appearanceLayerSprites = new Map([
    [0, layer],
    [1, hidden],
    [2, detached],
  ])
  delete value.shadow
  fullyCrouch(value)
  const mesh = layer.parent.children[0]
  assert.equal(hidden.parent.children.length, 0)
  value.appearanceLayerSprites.delete(0)
  applyUnitCrouchPose(value, true)
  assert.equal(layer.alpha, 0.8)
  assert.equal(mesh.visible, false)
  value.appearanceLayerSprites.set(0, layer)
  layer.visible = false
  applyUnitCrouchPose(value, true)
  assert.equal(mesh.visible, false)
  assert.equal(layer.alpha, 0)
  resetUnitCrouchPose(value)
  assert.equal(layer.alpha, 0.8)
})

test('mounting or switching to an incompatible animation clears crouch meshes', () => {
  for (const change of [
    value => {
      value.mountedOnHorse = true
    },
    value => {
      value.currentSheet = 'attack'
    },
    value => {
      value.sprite = null
    },
  ]) {
    const value = unit()
    const original = value.sprite
    fullyCrouch(value)
    change(value)
    applyUnitCrouchPose(value, true)
    assert.equal(original.alpha, 0.8)
    assert.equal(original.parent.children.length, 0)
    assert.deepEqual(value.shadow.scale, { x: 2, y: 3 })
  }
  const value = unit()
  value.currentSheet = 'standing'
  value.sprite.scale.y = 0
  applyUnitCrouchPose(value, false)
  assert.equal(value.sprite.parent.children.length, 0)
  applyUnitCrouchPose(value, true)
  assert.equal(value.sprite.parent.children[0].scale.y, 1)
  resetUnitCrouchPose(value)
})
