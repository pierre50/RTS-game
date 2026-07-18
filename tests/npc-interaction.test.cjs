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
  ACTION_TYPES: {
    attack: 'attack',
    build: 'build',
    hunt: 'hunt',
    takemeat: 'takemeat',
  },
  FAMILY_TYPES: {
    animal: 'animal',
    building: 'building',
    resource: 'resource',
    unit: 'unit',
  },
  SHEET_TYPES: {
    standing: 'standing',
  },
}

function loadNpcInteraction(target) {
  return loadModule('app/lib/npcInteraction.ts', {
    '../constants': constants,
    './grid/visibility': {
      findInstancesInSight: () => (target ? [target] : []),
    },
    './maths': {
      getInstanceDegree: () => 0,
    },
  })
}

test('"aller vers" sends villagers to attack an enemy under the cursor', () => {
  const enemyOwner = { label: 'enemy' }
  const target = {
    family: constants.FAMILY_TYPES.unit,
    hitPoints: 20,
    i: 5,
    isDead: false,
    isDestroyed: false,
    j: 5,
    owner: enemyOwner,
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const calls = []
  const npc = {
    context: { map: { grid: [] } },
    getActionCondition: orderTarget => orderTarget === target,
    i: 1,
    j: 1,
    owner: { isEnemy: owner => owner === enemyOwner },
    sendToAttack: orderTarget => calls.push(['attack', orderTarget]),
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['attack', target]])
})

test('"aller vers" sends villagers to hunt a live animal under the cursor', () => {
  const target = {
    family: constants.FAMILY_TYPES.animal,
    hitPoints: 8,
    i: 5,
    isDead: false,
    isDestroyed: false,
    j: 5,
    quantity: 100,
    x: 100,
    y: 100,
  }
  const { sendNpcGroupToTarget } = loadNpcInteraction(target)
  const calls = []
  const npc = {
    context: { map: { grid: [] } },
    getActionCondition: (orderTarget, action) => orderTarget === target && action === constants.ACTION_TYPES.hunt,
    i: 1,
    j: 1,
    owner: { isEnemy: () => false },
    sendToHunt: orderTarget => calls.push(['hunt', orderTarget]),
  }

  sendNpcGroupToTarget([npc], { i: 5, j: 5, has: target }, { x: 100, y: 100 })

  assert.deepEqual(calls, [['hunt', target]])
})

test('"aller vers" cursor shows combat feedback over combat targets', () => {
  const classes = new Set()
  global.document = {
    body: {
      classList: {
        add: className => classes.add(className),
        remove: (...classNames) => classNames.forEach(className => classes.delete(className)),
      },
    },
  }

  try {
    const { resetHeroCursor, updateHeroCursor } = loadModule('app/lib/heroCursor.ts', {
      '../constants': constants,
    })
    updateHeroCursor(null, { family: constants.FAMILY_TYPES.unit }, true)

    assert.equal(classes.has('arpg-cursor-combat'), true)
    resetHeroCursor()
  } finally {
    delete global.document
  }
})

test('"aller vers" cursor shows the resource hand over buildings', () => {
  const classes = new Set()
  global.document = {
    body: {
      classList: {
        add: className => classes.add(className),
        remove: (...classNames) => classNames.forEach(className => classes.delete(className)),
      },
    },
  }

  try {
    const { resetHeroCursor, updateHeroCursor } = loadModule('app/lib/heroCursor.ts', {
      '../constants': constants,
    })
    updateHeroCursor(null, { family: constants.FAMILY_TYPES.building }, true)

    assert.equal(classes.has('arpg-cursor-resource'), true)
    resetHeroCursor()
  } finally {
    delete global.document
  }
})

test('"aller vers" cursor shows the pointer only while choosing an empty go-to target', () => {
  const classes = new Set()
  global.document = {
    body: {
      classList: {
        add: className => classes.add(className),
        remove: (...classNames) => classNames.forEach(className => classes.delete(className)),
      },
    },
  }

  try {
    const { resetHeroCursor, updateHeroCursor } = loadModule('app/lib/heroCursor.ts', {
      '../constants': constants,
    })
    updateHeroCursor(null, null, false)
    assert.equal(classes.has('arpg-cursor-pointer'), false)

    updateHeroCursor(null, null, true)
    assert.equal(classes.has('arpg-cursor-pointer'), true)
    resetHeroCursor()
  } finally {
    delete global.document
  }
})

test('combat hover does not change the cursor outside "aller vers" picking', () => {
  const classes = new Set()
  global.document = {
    body: {
      classList: {
        add: className => classes.add(className),
        remove: (...classNames) => classNames.forEach(className => classes.delete(className)),
      },
    },
  }

  try {
    const { resetHeroCursor, updateHeroCursor } = loadModule('app/lib/heroCursor.ts', {
      '../constants': constants,
    })
    updateHeroCursor(null, { family: constants.FAMILY_TYPES.unit }, false)

    assert.equal(classes.has('arpg-cursor-combat'), false)
    assert.equal(classes.has('arpg-cursor-pointer'), false)
    resetHeroCursor()
  } finally {
    delete global.document
  }
})
