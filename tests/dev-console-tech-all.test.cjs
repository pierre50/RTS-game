const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadPlayerActions() {
  const filename = path.join(__dirname, '../app/dev-console/actions/player.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })

  const module = { exports: {} }
  const localRequire = request => {
    if (request === '../../constants') return { POPULATION_MAX: 200, SHEET_TYPES: { standing: 'standing' } }
    if (request === '../../lib') {
      return {
        capitalizeFirstLetter: value => value.charAt(0).toUpperCase() + value.slice(1),
        isValidCondition: (condition, values) => {
          const expectedValue = values[condition.key]
          switch (condition.op) {
            case '=':
              return expectedValue === condition.value
            case '>=':
              return expectedValue >= condition.value
            case 'includes':
              return expectedValue.includes(condition.value)
            default:
              throw new Error(`Unsupported op in test: ${condition.op}`)
          }
        },
      }
    }
    if (request === '../../lib/audio/settings') {
      return {
        GAME_SPEED_USAGE: 'speed [0.5|1|1.5|2]',
        isGameSpeedPreset: () => true,
      }
    }
    if (request === '../../lib/equipment/equipmentStats') {
      return { refreshUnitEquipmentStats: unit => unit.calls.push(['refreshUnitEquipmentStats']) }
    }
    if (request === '../../lib/lpc') {
      return { preloadBakedLpcUnitsForPlayers: () => Promise.resolve() }
    }
    if (request === './shared') {
      return {
        RESOURCE_NAMES: ['wood', 'food', 'stone', 'gold'],
        findKey: (object, query) =>
          Object.keys(object || {}).find(key => key.toLowerCase() === String(query).toLowerCase()),
        normalizeToggle: (value, current) => (value === 'on' ? true : value === 'off' ? false : !current),
      }
    }
    return requireFromTsFile(request, filename, mocks)
  }

  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('tech all unlocks only technologies available at the current age', () => {
  const { applyAllTechnologies } = loadPlayerActions()
  let editorPanelUpdates = 0
  let topbarUpdates = 0
  const player = {
    age: 1,
    technologies: [],
    units: [],
    buildings: [],
    techs: {
      ToolAge: { key: 'age', value: 1 },
      BronzeAge: { key: 'age', value: 2 },
      IronAge: { key: 'age', value: 3 },
      Wheel: { key: 'technologies', conditions: [{ key: 'age', op: '>=', value: 1 }] },
      Writing: { key: 'technologies', conditions: [{ key: 'age', op: '>=', value: 1 }] },
      Metalworking: {
        key: 'technologies',
        conditions: [
          { key: 'age', op: '>=', value: 2 },
          { key: 'technologies', op: 'includes', value: 'Wheel' },
        ],
      },
    },
  }
  const context = {
    player,
    menu: {
      updateActionTarget: () => {
        editorPanelUpdates++
      },
      updateTopbar: () => {
        topbarUpdates++
      },
    },
  }

  const result = applyAllTechnologies(context)

  assert.deepEqual(result, { ok: true, message: 'Unlocked 2 technologies' })
  assert.equal(player.age, 1)
  assert.deepEqual(player.technologies, ['Wheel', 'Writing'])
  assert.equal(player.autoTechnologyByAge, true)
  assert.equal(editorPanelUpdates, 2)
  assert.equal(topbarUpdates, 2)
})

test('hero invincible command toggles the active hero dev damage immunity', () => {
  const { toggleHeroInvincible } = loadPlayerActions()
  const hero = { hitPoints: 7 }
  const context = { controls: { heroUnit: hero } }

  assert.deepEqual(toggleHeroInvincible(context, 'on'), { ok: true, message: 'Hero invincible: on' })
  assert.equal(hero.devInvincible, true)
  assert.deepEqual(toggleHeroInvincible(context, 'off'), { ok: true, message: 'Hero invincible: off' })
  assert.equal(hero.devInvincible, false)
})

test('hero invincible command reports when no active hero exists', () => {
  const { toggleHeroInvincible } = loadPlayerActions()

  assert.deepEqual(toggleHeroInvincible({ controls: { heroUnit: null } }), {
    ok: false,
    message: 'No active hero found',
  })
})

test('tech all auto-unlocks the next age tier when age increases', () => {
  const { applyAllTechnologies, setAge } = loadPlayerActions()
  const player = {
    age: 1,
    technologies: [],
    units: [],
    buildings: [],
    onAgeChange: () => {},
    techs: {
      ToolAge: { key: 'age', value: 1 },
      BronzeAge: { key: 'age', value: 2 },
      IronAge: { key: 'age', value: 3 },
      Wheel: { key: 'technologies', conditions: [{ key: 'age', op: '>=', value: 1 }] },
      Writing: { key: 'technologies', conditions: [{ key: 'age', op: '>=', value: 1 }] },
      Metalworking: {
        key: 'technologies',
        conditions: [
          { key: 'age', op: '>=', value: 2 },
          { key: 'technologies', op: 'includes', value: 'Wheel' },
        ],
      },
      Architecture: {
        key: 'technologies',
        conditions: [
          { key: 'age', op: '>=', value: 2 },
          { key: 'technologies', op: 'includes', value: 'Metalworking' },
        ],
      },
    },
  }
  const context = {
    player,
    menu: {
      updateActionTarget: () => {},
      updateTopbar: () => {},
    },
  }

  applyAllTechnologies(context)
  const result = setAge(context, 2)

  assert.deepEqual(result, { ok: true, message: 'Age set to 2' })
  assert.equal(player.age, 2)
  assert.deepEqual(player.technologies, ['Wheel', 'Writing', 'Metalworking', 'Architecture'])
})

test('setAge refreshes existing unit equipment visuals', () => {
  const { setAge } = loadPlayerActions()
  const calls = []
  const player = {
    age: 0,
    technologies: [],
    units: [
      {
        calls,
        currentSheet: 'walking',
        setTextures: sheet => calls.push(['setTextures', sheet]),
      },
      {
        calls,
        isDead: true,
        setTextures: sheet => calls.push(['deadSetTextures', sheet]),
      },
    ],
    buildings: [],
    techs: {},
  }
  const context = {
    player,
    menu: {
      updateActionTarget: () => calls.push(['updateActionTarget']),
      updateTopbar: () => calls.push(['updateTopbar']),
    },
  }

  const result = setAge(context, 1)

  assert.deepEqual(result, { ok: true, message: 'Age set to 1' })
  assert.deepEqual(calls, [['refreshUnitEquipmentStats'], ['setTextures', 'walking'], ['updateActionTarget'], ['updateTopbar']])
})
