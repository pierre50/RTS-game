const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadTsModule(filename, moduleCache) {
  const resolved = filename.endsWith('.ts') ? filename : `${filename}.ts`
  if (moduleCache.has(resolved)) return moduleCache.get(resolved).exports

  const source = fs.readFileSync(resolved, 'utf8')
  const { code } = babel.transformSync(source, {
    filename: resolved,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })

  const module = { exports: {} }
  moduleCache.set(resolved, module)

  const localRequire = request => {
    if (request.startsWith('.')) {
      return loadTsModule(path.resolve(path.dirname(resolved), request), moduleCache)
    }
    return require(request)
  }

  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

function loadDiplomacy() {
  global.localStorage = {
    getItem: () => 'fr',
    setItem() {},
  }
  return loadTsModule(path.join(__dirname, '../app/lib/combat/diplomaticAggression.ts'), new Map())
}

test.afterEach(() => {
  delete global.localStorage
})

test('attacking a neutral faction starts a war immediately', () => {
  const { applyDiplomaticAggression } = loadDiplomacy()
  const messages = []
  const factions = {
    tribe: { id: 'tribe', name: 'Clan Test', relationScore: 0, relationState: 'neutral' },
  }
  const sourceOwner = {
    label: 'player',
    isPlayed: true,
    isEnemy: targetOwner => factions[targetOwner?.factionId]?.relationState === 'hostile',
  }
  const source = {
    context: {
      getCampaignFactions: () => factions,
      menu: { showMessage: (message, level) => messages.push([message, level]) },
      changeFactionRelation: (id, delta) => {
        factions[id] = {
          ...factions[id],
          relationScore: factions[id].relationScore + delta,
          relationState: 'hostile',
        }
      },
    },
    owner: sourceOwner,
  }
  const target = { owner: { label: 'neutral-ai', factionId: 'tribe' } }

  assert.deepEqual(applyDiplomaticAggression(source, target, { reason: 'theft:horse' }), {
    changed: true,
    hostileNow: true,
    relation: 'hostile',
    targetName: 'Clan Test',
  })
  assert.equal(factions.tribe.relationScore, -65)
  assert.equal(sourceOwner.isEnemy(target.owner), true)
  assert.deepEqual(messages, [['Vous êtes maintenant en guerre avec Clan Test.', 'warning']])
})

test('diplomatic aggression forwards a custom faction relation reason', () => {
  const { applyDiplomaticAggression } = loadDiplomacy()
  const reasons = []
  const factions = {
    tribe: { id: 'tribe', name: 'Clan Test', relationScore: 0, relationState: 'neutral' },
  }
  const source = {
    context: {
      getCampaignFactions: () => factions,
      changeFactionRelation: (_id, _delta, reason) => reasons.push(reason),
    },
    owner: {
      isPlayed: true,
      label: 'player',
      isEnemy: () => false,
    },
  }
  const target = { owner: { label: 'neutral-ai', factionId: 'tribe' } }

  applyDiplomaticAggression(source, target, { notify: false, reason: 'theft:horse' })

  assert.deepEqual(reasons, ['theft:horse'])
})

test('attacking an allied team only breaks the alliance on the first incident', () => {
  const { applyDiplomaticAggression } = loadDiplomacy()
  const messages = []
  const sourceOwner = {
    label: 'player',
    isPlayed: true,
    team: 1,
    isEnemy: targetOwner => targetOwner?.team !== 1 && targetOwner?.diplomacy !== 'neutral',
  }
  const targetOwner = { label: 'ally-ai', team: 1, diplomacy: null }
  const source = { context: { menu: { showMessage: (message, level) => messages.push([message, level]) } }, owner: sourceOwner }
  const target = { owner: targetOwner }

  assert.deepEqual(applyDiplomaticAggression(source, target), {
    changed: true,
    hostileNow: false,
    relation: 'neutral',
    targetName: 'ally-ai',
  })
  assert.equal(targetOwner.team, null)
  assert.equal(targetOwner.diplomacy, 'neutral')
  assert.equal(sourceOwner.isEnemy(targetOwner), false)
  assert.deepEqual(messages, [['Alliance rompue avec ally-ai. Relations neutres.', 'warning']])
})
