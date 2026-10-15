const assert = require('node:assert/strict')
const test = require('node:test')
const { Container, Texture } = require('pixi.js')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function setup(options = {}) {
  const ticks = new Set()
  const sheet = { textures: { south: Texture.EMPTY } }
  let stops = 0
  const Controller = class {
    constructor(animal) {
      this.animal = animal
    }
  }
  const { Animal } = loadTsModule('app/classes/animal/Animal.ts', {
    mocks: {
      './AnimalLifecycle': {
        AnimalLifecycle: class extends Controller {
          stopDeathFall() {}
        },
      },
      './AnimalBehavior': {
        AnimalBehavior: class extends Controller {
          start() {}
          stop() {
            stops++
          }
        },
      },
      './AnimalCombat': { AnimalCombat: Controller },
      './AnimalMovement': { AnimalMovement: Controller },
      '../../ui/entity/AnimalInterface': { AnimalInterface: Controller },
      '../../lib': {
        cartesianToIsometric: (i, j) => [i * 32, j * 16],
        getInstanceZIndex: () => 0,
        getEntityMapSpace: () => null,
        getAnimationFrames: textures => Object.values(textures),
        getReliefLiftPixels: level => level * 16,
        getEntityMapPoint: animal => ({ x: animal.x, y: animal.y }),
        uuidv4: () => 'animal-1',
        setUnitTexture: (sheetName, animal) => {
          animal.currentSheet = sheetName
          animal.sprite.textures = [Texture.EMPTY]
          animal.sprite.play()
        },
        isEntityInActiveMapSpace: () => true,
        setSpriteFiltersPreservingDamageFeedback() {},
        attachEntityShadowsToMapSpace: (map, animal) => map.addChild(animal.shadow),
        updateInstanceVisibility: animal => animal.syncShadow(),
        bindAnimatedSpriteToTicker(sprite) {
          sprite.autoUpdate = false
          ticks.add(sprite)
          const destroy = sprite.destroy.bind(sprite)
          sprite.destroy = options => {
            ticks.delete(sprite)
            destroy(options)
          }
        },
      },
      '../../lib/mapSpaces': { getEntitySpaceMapLike: animal => animal.context.map },
      '../../lib/terrain/reliefSurface': { syncEntityRelief: (map, animal) => animal.applyReliefLift(2) },
      '../../lib/equipment/animalCorpseLoot': { initializeAnimalCorpseLoot() {} },
      '../../lib/units/unitEnergy': { ensureUnitEnergy() {} },
      '../../lib/combat/combatAttackLoop': { clearCombatAttackRecovery() {} },
      '../../lib/buildings/passageCells': { routeEntityAwayFromPassageCell: () => false },
      '../../lib/audio/settings': { onVisualSettingsChange: () => () => {}, getShadowsEnabled: () => true },
      '../../lib/horses/horseColors': { recolorHorseTextures: textures => textures },
      '../../lib/horses/horseTaming': { getHorseTamingStatus() {}, shouldHorseFleeFromThreat: () => true },
    },
  })
  const cell = {
    z: 0,
    has: null,
    place(animal) {
      this.has = animal
      // Real cells refresh visibility immediately, before construction finishes.
      void animal.deferredSpriteBounds
      animal.visible = true
      animal.syncShadow()
      animal.visible = false
      animal.syncShadow()
    },
  }
  const map = Object.assign(new Container(), { grid: [[cell]], randomRange: () => 90, addToInstanceBucket() {} })
  const owner = {
    config: {
      animals: {
        Deer: { assets: {}, walkingSheet: sheet, standingSheet: sheet, totalQuantity: 100, totalHitPoints: 50 },
      },
    },
  }
  const animal = new Animal({ i: 0, j: 0, type: 'Deer', owner, ...options }, { map, app: {}, editor: null })
  map.addChild(animal.displayObject)
  return { animal, cell, map, ticks, stops: () => stops }
}

test('cold animals retain occupancy and simulation state without animation allocation', () => {
  const { animal, cell, ticks } = setup()
  assert.equal(cell.has, animal)
  assert.equal(cell.solid, true)
  assert.equal(animal.getVisualSprite(), undefined)
  assert.deepEqual(animal.getVisualState().position, { x: 0, y: 0, z: 0 })
  animal.setTextures('walkingSheet')
  animal.setMovementAnimationPlaying(false)
  animal.applyReliefLift(3)
  animal.setAltitude(20)
  animal.pause()
  animal.resume()
  assert.equal(animal.getMovementAnimationPlaying(), false)
  assert.ok(animal.deferredSpriteBounds)
  assert.equal(animal.getVisualSprite(), undefined)
  assert.equal(ticks.size, 0)
  animal.destroy({ children: true })
})

test('animal simulation state and Pixi display remain separate', () => {
  const { animal, map } = setup()
  assert.equal(animal instanceof Container, false)
  assert.equal(animal.displayObject instanceof Container, true)
  assert.equal(animal.displayObject.runtimeEntity, animal)
  assert.equal(map.children.includes(animal.displayObject), true)
  animal.x = 48
  animal.y = 24
  animal.zIndex = 17
  animal.visible = true
  assert.deepEqual([animal.displayObject.x, animal.displayObject.y, animal.displayObject.zIndex, animal.displayObject.visible], [48, 24, 17, true])
  animal.destroy({ children: true })
})

test('camera round trips reclaim both animations and retain the same animal and state', () => {
  const { animal, cell, ticks } = setup()
  animal.hitPoints = 27
  for (let i = 0; i < 10; i++) {
    animal.visible = true
    animal.syncShadow()
    const sprite = animal.getVisualSprite()
    assert.ok(sprite)
    assert.equal(sprite.position.y, -32)
    assert.equal(ticks.size, 2)
    animal.visible = false
    animal.syncShadow()
    assert.equal(sprite.destroyed, true)
    assert.equal(ticks.size, 0)
    assert.equal(animal.getVisualSprite(), undefined)
    assert.equal(cell.has, animal)
    assert.equal(animal.hitPoints, 27)
  }
  animal.destroy({ children: true })
})

test('animal combat can request animation events through the view', () => {
  const { animal, ticks } = setup()
  assert.equal(animal.getVisualSprite(), undefined)
  const animation = animal.visualAnimation
  assert.ok(animal.getVisualSprite())
  assert.equal(ticks.size, 2)
  let impacts = 0
  animation.onFrameEachLoop(0, () => { impacts++ })
  animal.getVisualSprite().onFrameChange(0)
  assert.equal(impacts, 1)
  animal.destroy({ children: true })
})

test('offscreen combat/death callbacks stay alive and destruction stops behavior', () => {
  const { animal, ticks, stops } = setup()
  const sprite = animal.sprite
  sprite.onComplete = () => {}
  animal.syncShadow()
  assert.equal(animal.getVisualSprite(), sprite)
  animal.destroy({ children: true })
  assert.equal(ticks.size, 0)
  assert.equal(stops(), 1)
  assert.throws(() => animal.sprite, /destroyed animal/)
})

test('attack preparation retains its sprite before frame callbacks are attached', () => {
  const { animal } = setup()
  animal.action = 'attack'
  animal.setTextures('actionSheet')
  const sprite = animal.sprite
  animal.syncShadow()
  assert.equal(animal.getVisualSprite(), sprite)
  assert.equal(sprite.destroyed, false)
  animal.destroy({ children: true })
})

test('eviction during pause preserves intended playback when the animal returns', () => {
  const { animal } = setup()
  animal.visible = true
  animal.syncShadow()
  animal.pause()
  animal.visible = false
  animal.syncShadow()
  animal.resume()
  assert.equal(animal.playingBeforePause, undefined)
  animal.visible = true
  animal.syncShadow()
  assert.equal(animal.getVisualSprite().playing, true)
  animal.destroy({ children: true })
})

test('restoring an animal retains its individual meat capacity and remaining stock', () => {
  const { animal } = setup({ quantity: 15, totalQuantity: 23 })
  assert.equal(animal.quantity, 15)
  assert.equal(animal.totalQuantity, 23)
})
