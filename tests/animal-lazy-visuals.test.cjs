const assert = require('node:assert/strict')
const test = require('node:test')
const { Container, Texture } = require('pixi.js')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function setup(options = {}) {
  const ticks = new Set()
  const sheet = { textures: { south: Texture.EMPTY } }
  let stops = 0
  class Instance extends Container {
    constructor(context) {
      super()
      this.context = context
      this.label = 'animal-1'
      this.isDestroyed = false
      this.isDead = false
    }
    assignProperties(values) {
      Object.assign(this, values)
    }
    shouldKeepHealthBarVisible() {
      return false
    }
    stopInterval() {}
    stopTimeout() {}
    setTextures(sheetName) {
      this.currentSheet = sheetName
      this.sprite.textures = [Texture.EMPTY]
      this.sprite.play()
    }
    pause() {
      this.playingBeforePause ??= this.sprite.playing
      this.sprite.stop()
    }
    resume() {
      if (this.playingBeforePause !== false) this.sprite.play()
      this.playingBeforePause = undefined
    }
  }
  const Controller = class {
    constructor(animal) {
      this.animal = animal
    }
  }
  const { Animal } = loadTsModule('app/classes/animal/Animal.ts', {
    mocks: {
      '../Instance': { Instance },
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
  map.addChild(animal)
  return { animal, cell, map, ticks, stops: () => stops }
}

test('cold animals retain occupancy and simulation state without animation allocation', () => {
  const { animal, cell, ticks } = setup()
  assert.equal(cell.has, animal)
  assert.equal(cell.solid, true)
  assert.equal(animal.getVisualSprite(), undefined)
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
