const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('own units without a team become visible to a chief, without including unrelated unteamed players', () => {
  const { isHeroTeamUnit, isTeamHealthBarRestricted } = loadTsModule('app/classes/InstanceHudBars.ts', {
    mocks: { 'pixi.js': {} },
  })
  const owner = { label: 'player', team: null }
  const hero = { label: 'hero', owner, hitPoints: 45, isChief: false }
  const host = { family: 'unit', owner: { ...owner }, context: { controls: { heroUnit: hero } } }
  assert.equal(isHeroTeamUnit(host), true)
  assert.equal(isTeamHealthBarRestricted(host), true)
  hero.isChief = true
  assert.equal(isTeamHealthBarRestricted(host), false)
  host.owner = { label: 'other', team: null }
  assert.equal(isHeroTeamUnit(host), false)
  owner.team = 2
  host.owner.team = 2
  assert.equal(isHeroTeamUnit(host), true)
  host.owner.team = 3
  assert.equal(isHeroTeamUnit(host), false)
})

test('hero health bar is removed immediately without waiting for the paused scheduler', () => {
  const { drawInstanceHealthBar, removeInstanceHudBar } = loadTsModule('app/classes/InstanceHudBars.ts', {
    mocks: { 'pixi.js': {} },
  })
  let bar = {}
  const host = {
    label: 'hero',
    selected: true,
    context: {
      controls: { heroUnit: { label: 'hero' } },
      scheduler: { add() { assert.fail('Hero health bar must never animate') }, remove() {} },
    },
    get children() { return bar ? [bar] : [] },
    getChildByLabel() { return bar },
    removeChild() { bar = null },
    addChild() { assert.fail('Hero health bar must never be drawn, even when selected') },
  }
  removeInstanceHudBar(host, 'healthBar')
  assert.equal(bar, null)
  bar = {}
  drawInstanceHealthBar(host)
  assert.equal(bar, null)
  drawInstanceHealthBar(host)
})
