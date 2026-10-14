const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('placement territory uses the economic radius, follows the camera, and cleans up', () => {
  const drawings = []
  class Graphics {
    position = {
      set: (x, y) => {
        this.x = x
        this.y = y
      },
    }
    clear() {
      drawings.length = 0
    }
    ellipse(...args) {
      drawings.push({ ellipse: args })
    }
    fill(style) {
      drawings.at(-1).fill = style
    }
    stroke(style) {
      drawings.at(-1).stroke = style
    }
    destroy() {
      this.destroyed = true
    }
  }
  const { BuildingTerritoryPreview } = loadTsModule('app/controllers/BuildingTerritoryPreview.ts', {
    mocks: { 'pixi.js': { Graphics } },
  })
  const { BASE_TERRITORY_RADIUS } = loadTsModule('app/config/world/territory.ts')
  const town = { type: 'TownCenter', i: 50, j: 50, isBuilt: true }
  const controls = {
    context: {
      player: {
        buildings: [town, { ...town, i: 80, isDead: true }, { ...town, i: 90, isBuilt: false }],
        colorHex: '#3366ff',
      },
    },
    camera: { x: 100, y: 200 },
    mouseBuilding: { type: 'House' },
    addChild(graphic) {
      this.graphic = graphic
      graphic.parent = {
        removeChild: () => {
          this.removed = true
        },
      }
    },
  }
  const preview = new BuildingTerritoryPreview(controls)
  preview.update({ i: 52, j: 50 })
  assert.equal(drawings.length, 1)
  assert.deepEqual(drawings[0].ellipse, [
    0,
    1600,
    (BASE_TERRITORY_RADIUS * 64) / Math.SQRT2,
    (BASE_TERRITORY_RADIUS * 32) / Math.SQRT2,
  ])
  assert.equal(drawings[0].fill.color, '#3366ff')
  assert.ok(drawings[0].fill.alpha < 0.2)
  controls.camera.x = 300
  preview.update({ i: 55, j: 50 })
  assert.equal(controls.graphic.x, -300)
  assert.equal(drawings.length, 1)
  controls.mouseBuilding.type = 'TownCenter'
  preview.update({ i: 100, j: 50 })
  assert.equal(drawings.length, 2)
  assert.equal(drawings[1].ellipse[0], 1600)
  preview.update({ i: 1, j: 1, spaceId: 'interior:house' })
  assert.equal(controls.graphic.visible, false)
  preview.update({ i: 100, j: 50 })
  assert.equal(controls.graphic.visible, true)
  preview.destroy()
  assert.equal(controls.removed, true)
  assert.equal(controls.graphic.destroyed, true)
})
