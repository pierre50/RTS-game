const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

class Graphics {
  constructor() {
    this.destroyed = false
    this.position = {
      set: (x, y) => {
        this.x = x
        this.y = y
      },
    }
    this.scale = { set: value => (this.scaleValue = value) }
  }

  circle() {
    return this
  }

  fill() {
    return this
  }

  destroy() {
    this.destroyed = true
  }
}

function loadCombatBloodImpact({ enabled = true } = {}) {
  return loadTsModule('app/lib/entities/combatBloodImpact.ts', {
    mocks: {
      'pixi.js': { Graphics },
      '../constants': { FAMILY_TYPES: { animal: 'animal', unit: 'unit' } },
      '../audio/settings': { getBloodEffectsEnabled: () => enabled },
    },
  })
}

function makeTarget() {
  const added = []
  const animationSteps = []
  const parent = {
    destroyed: false,
    addChild: child => {
      child.parent = parent
      added.push(child)
    },
    removeChild: child => {
      child.parent = null
    },
  }
  return {
    added,
    animationSteps,
    context: {
      scheduler: {
        add: callback => {
          animationSteps.push(callback)
          return 1
        },
        remove: () => {},
      },
    },
    family: 'unit',
    isDead: false,
    isDestroyed: false,
    sprite: {
      anchor: { y: 0.5 },
      height: 40,
      parent,
      x: 10,
      y: 20,
    },
    x: 10,
    y: 20,
  }
}

test('combat blood impact does not spawn drops when disabled in settings', () => {
  const { spawnCombatBloodImpact } = loadCombatBloodImpact({ enabled: false })
  const target = makeTarget()

  spawnCombatBloodImpact({ x: 0, y: 0 }, target, { damage: 6, random: () => 0.5 })

  assert.equal(target.added.length, 0)
})

test('combat blood impact spawns drops when enabled', () => {
  const { spawnCombatBloodImpact } = loadCombatBloodImpact({ enabled: true })
  const target = makeTarget()

  spawnCombatBloodImpact({ x: 0, y: 0 }, target, { damage: 6, random: () => 0.5 })

  assert.equal(target.added.length, 5)
})

test('combat blood impact drops stop at the victim feet', () => {
  const { spawnCombatBloodImpact } = loadCombatBloodImpact({ enabled: true })
  const target = makeTarget()
  const feetY = target.sprite.y + target.sprite.height * (1 - target.sprite.anchor.y)

  spawnCombatBloodImpact({ x: 0, y: 0 }, target, { damage: 6, random: () => 0.5 })

  for (let i = 0; i < 40; i++) {
    target.animationSteps[0]()
  }

  assert.equal(target.added.length, 5)
  assert.equal(Math.max(...target.added.map(drop => drop.y)), feetY)
})
