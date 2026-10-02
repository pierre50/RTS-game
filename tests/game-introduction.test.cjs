const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture(gender = 'male', realWake = false) {
  let wakeComplete
  const tasks = new Map()
  let nextId = 0
  const scheduler = {
    elapsedMs: 0,
    add(fn) {
      const id = ++nextId
      tasks.set(id, fn)
      return id
    },
    remove(id) {
      tasks.delete(id)
    },
    addOneShot(fn) {
      const id = this.add(() => {
        tasks.delete(id)
        fn()
      })
      return id
    },
  }
  const visuals = realWake
    ? loadTsModule('app/services/rest/UnitSleepVisuals.ts', {
        mocks: { '../../lib/entities/entityFade': { cancelFade() {} } },
      })
    : null
  const api = loadTsModule('app/services/introduction/GameIntroduction.ts', {
    mocks: {
      '../../lib/lpc': { ensureAndRefreshBakedLpcUnitAssets: async () => {} },
      '../../lib/grid/visibility': { updateInstanceVisibility() {} },
      '../../lib/maths': { getInstanceDegree: () => 90 },
      '../rest/UnitSleepVisuals': {
        setSleepingOutsideFinalVisual(unit) {
          if (visuals) return visuals.setSleepingOutsideFinalVisual(unit)
          unit.sleepVisualState = 'sleeping'
        },
        playSleepingWakeVisual(unit, callback) {
          if (visuals) return visuals.playSleepingWakeVisual(unit, callback)
          unit.sleepVisualState = 'waking'
          wakeComplete = () => {
            unit.sleepVisualState = null
            callback()
          }
        },
      },
      '../../lib/entities/overheadIndicator': {
        setUnitOverheadIndicator(unit, type) {
          unit.indicator = type
        },
        clearUnitOverheadIndicator(unit) {
          unit.indicator = null
        },
      },
    },
  })
  const hero = { label: 'hero', i: 5, j: 5, x: 5, y: 5, gender, stop() {} }
  if (realWake) {
    hero.context = { scheduler }
    hero.sprite = {
      textures: ['sleep-0', 'sleep-1', 'sleep-2'],
      currentFrame: 0,
      gotoAndStop(frame) {
        this.currentFrame = frame
      },
      stop() {},
    }
    hero.setTextures = sheet => {
      hero.currentSheet = sheet
    }
  }
  const grid = Array.from({ length: 12 }, (_, i) =>
    Array.from({ length: 12 }, (_, j) => ({ i, j, z: 0, category: 'Land', solid: false, has: null }))
  )
  grid[5][5].has = hero
  let saveCount = 0
  let saved
  let dialogue
  let opened = 0
  const journal = { version: 1, quests: [], trackedQuestId: null }
  const player = {
    label: 'player',
    config: { buildings: { FireCamp: { size: 1 } } },
    units: [hero],
    buildings: [],
    createBuilding(options) {
      const entity = { ...options, label: 'camp' }
      this.buildings.push(entity)
      return entity
    },
    createUnit(options) {
      const entity = {
        ...options,
        label: 'companion',
        x: options.i,
        y: options.j,
        stop() {},
        sendTo(cell) {
          this.i = cell.i
          this.j = cell.j
        },
      }
      this.units.push(entity)
      return entity
    },
  }
  const context = {
    scheduler,
    getQuestJournal: () => journal,
    getCurrentWorldId: () => 'start',
    player,
    map: { grid },
    controls: {
      heroUnit: hero,
      setRuntimeInputEnabled(value) {
        this.inputEnabled = value
      },
    },
    menu: {
      setHudSuppressed(value) {
        this.hudSuppressed = value
      },
      openNpcOrders(npcs, options) {
        opened++
        dialogue = options
        assert.equal(npcs[0], player.units[1])
      },
      closeNpcOrders() {},
    },
  }
  const host = {
    _campaignSave: { currentWorldId: 'start' },
    _gameContext: () => context,
    togglePause(value) {
      context.paused = value
    },
    autosave() {
      saveCount++
      saved = structuredClone({
        campaign: host._campaignSave,
        journal,
        unitLabels: player.units.map(unit => unit.label),
        buildingLabels: player.buildings.map(building => building.label),
      })
    },
  }
  return {
    ...api,
    host,
    context,
    player,
    tick() {
      scheduler.elapsedMs += 1000
      for (const fn of [...tasks.values()]) fn()
    },
    finishWake() {
      wakeComplete()
    },
    getSaved: () => saved,
    getSaveCount: () => saveCount,
    getDialogue: () => dialogue,
    getOpened: () => opened,
  }
}

test('approach runs the real wake animation, opens dialogue and releases the hero', async () => {
  const f = fixture('male', true)
  await f.prepareGameIntroduction(f.host)
  f.showGameIntroduction(f.host)
  f.startGameIntroduction(f.host)
  for (let tick = 0; tick < 8; tick++) f.tick()
  assert.equal(f.getOpened(), 1)
  assert.equal(f.host._campaignSave.introduction.phase, 'dialogue')
  assert.equal(f.getSaveCount(), 1, 'no checkpoint capture during approach or wake')
  assert.equal(f.context.controls.heroUnit.sleepVisualState, null)
  f.getDialogue().dialogue.onComplete()
  assert.equal(f.context.controls.inputEnabled, true)
  assert.equal(f.context.controls.heroUnit.actionLocked, undefined)
  assert.equal(f.host._campaignSave.introduction.status, 'completed')
  assert.equal(f.getSaveCount(), 2)
})

for (const gender of ['male', 'female'])
  test(`new game creates one allied companion opposite to ${gender}, and one camp without a chest`, async () => {
    const f = fixture(gender)
    await f.prepareGameIntroduction(f.host)
    assert.equal(f.player.units.length, 2)
    assert.equal(f.player.units[1].gender, gender === 'male' ? 'female' : 'male')
    assert.equal(f.player.units[1].isChief, false)
    assert.deepEqual(f.player.units[1].inventory.resources, { meat: 6, berry: 6 })
    assert.equal(f.context.controls.heroUnit.isChief, false)
    assert.ok(Math.max(Math.abs(f.player.units[1].i - 5), Math.abs(f.player.units[1].j - 5)) >= 3)
    assert.deepEqual(
      f.player.buildings.map(building => building.type),
      ['FireCamp']
    )
    assert.equal(f.context.paused, true)
    assert.equal(f.getSaved().campaign.introduction.status, 'prepared')
    assert.deepEqual(f.getSaved().unitLabels, ['hero', 'companion'])
    await f.prepareGameIntroduction(f.host)
    assert.equal(f.player.units.length, 2)
  })

test('blocked approach still wakes the hero and releases controls after the reply', async () => {
  const f = fixture()
  await f.prepareGameIntroduction(f.host)
  f.player.units[1].sendTo = () => {}
  f.showGameIntroduction(f.host)
  f.startGameIntroduction(f.host)
  for (let i = 0; i < 14; i++) f.tick()
  assert.equal(f.context.controls.heroUnit.sleepVisualState, 'waking')
  f.finishWake()
  f.getDialogue().dialogue.onComplete()
  assert.equal(f.context.controls.inputEnabled, true)
  assert.equal(f.context.paused, false)
})

test('legacy saves and travel never open an introduction; a prepared reload resumes without spawning', async () => {
  const f = fixture()
  f.showGameIntroduction(f.host)
  assert.equal(f.getOpened(), 0)
  await f.prepareGameIntroduction(f.host)
  f.host._campaignSave.currentWorldId = 'other'
  f.showGameIntroduction(f.host)
  assert.equal(f.getOpened(), 0)
  f.host._campaignSave = structuredClone(f.getSaved().campaign)
  f.showGameIntroduction(f.host)
  assert.equal(f.getOpened(), 0)
  assert.equal(f.context.controls.heroUnit.sleepVisualState, 'sleeping')
  assert.equal(f.context.menu.hudSuppressed, true)
  assert.equal(f.context.controls.heroUnit.indicator, 'sleep')
  assert.equal(f.context.controls.inputEnabled, false)
  f.startGameIntroduction(f.host)
  assert.equal(f.context.paused, false)
  f.tick()
  f.tick()
  assert.equal(f.context.controls.heroUnit.sleepVisualState, 'waking')
  assert.equal(f.context.menu.hudSuppressed, true)
  assert.equal(f.context.controls.heroUnit.indicator, null)
  assert.equal(f.getOpened(), 0)
  f.finishWake()
  assert.equal(f.getOpened(), 1)
  assert.equal(f.getDialogue().ordersEnabled, false)
  assert.equal(f.context.paused, false)
  assert.equal(f.context.controls.heroUnit.isChief, false)
  assert.equal(f.context.menu.hudSuppressed, true)
  assert.equal(f.player.units.length, 2)
  // Saving may replace the campaign while the response callback remains open.
  f.host._campaignSave = structuredClone(f.host._campaignSave)
  f.getDialogue().dialogue.onComplete()
  assert.equal(f.host._campaignSave.introduction.status, 'completed')
  assert.equal(f.context.controls.heroUnit.isChief, true)
  assert.equal(f.getSaved().campaign.introduction.status, 'completed')
  assert.equal(f.getSaved().journal.quests[0].definitionId, 'camp-first-house')
  assert.equal(f.getSaved().journal.quests[0].status, 'active')
  assert.equal(f.getSaved().journal.trackedQuestId, 'camp-first-house')
  assert.equal(f.context.paused, false)
  assert.equal(f.context.controls.inputEnabled, true)
  assert.equal(f.context.menu.hudSuppressed, false)
  f.showGameIntroduction(f.host)
  assert.equal(f.getOpened(), 1)
})

test('camp placement respects occupied cells, water and access around the fire', () => {
  const { findIntroductionPlacement } = loadTsModule('app/services/introduction/IntroductionPlacement.ts')
  const f = fixture()
  const grid = f.context.map.grid
  grid[6][5].category = 'Water'
  grid[4][5].has = { type: 'Tree' }
  const placement = findIntroductionPlacement(f.context.map, f.context.controls.heroUnit, 1)
  assert.ok(placement)
  assert.notEqual(placement.camp, placement.companion)
  assert.equal(placement.camp.has, null)
  assert.equal(placement.companion.has, null)
  for (const [i, j] of [
    [6, 5],
    [4, 5],
    [5, 4],
    [5, 6],
  ])
    grid[i][j].solid = true
  assert.equal(findIntroductionPlacement(f.context.map, f.context.controls.heroUnit, 1), null)
})

for (const phase of ['waking', 'dialogue', undefined])
  test(`reload resumes ${phase ?? 'legacy dialogue'} without replaying approach`, async () => {
    const f = fixture()
    await f.prepareGameIntroduction(f.host)
    f.host._campaignSave.introduction.phase = phase
    f.showGameIntroduction(f.host)
    f.startGameIntroduction(f.host)
    if (phase === 'waking') {
      assert.equal(f.getOpened(), 0)
      f.finishWake()
    }
    assert.equal(f.getOpened(), 1)
    assert.equal(f.player.units.length, 2)
  })

test('companion approaches along a clear straight corridor after the hero spawn shifts one cell', () => {
  const { findIntroductionPlacement } = loadTsModule('app/services/introduction/IntroductionPlacement.ts')
  for (const [i, j] of [
    [5, 5],
    [6, 5],
    [5, 6],
  ]) {
    const f = fixture()
    const grid = f.context.map.grid
    grid[5][5].has = null
    const hero = { i, j }
    grid[i][j].has = hero
    const { camp, companion, arrival } = findIntroductionPlacement(f.context.map, hero, 1)
    const di = arrival.i - i
    const dj = arrival.j - j
    assert.equal(Math.abs(di) + Math.abs(dj), 1)
    assert.equal(companion.i, i + 3 * di)
    assert.equal(companion.j, j + 3 * dj)
    for (let step = 1; step <= 3; step++) {
      const cell = grid[i + di * step][j + dj * step]
      assert.notEqual(cell, camp)
      assert.equal(cell.has, null)
      assert.equal(cell.solid, false)
    }
    assert.ok(di * (camp.i - i) + dj * (camp.j - j) <= 0)
  }
})

test('camp conversation keeps steps in memory and only persists at completion', async () => {
  const f = fixture()
  await f.prepareGameIntroduction(f.host)
  f.host._campaignSave.introduction.phase = 'dialogue'
  f.showGameIntroduction(f.host)
  f.startGameIntroduction(f.host)
  const sequence = f.getDialogue().dialogue
  assert.equal(sequence.startId, 'wake')
  assert.ok(sequence.nodes.every(node => node.choices.length === 1))
  f.host._campaignSave = structuredClone(f.host._campaignSave)
  for (const topic of ['wake', 'rescue', 'attack', 'next', 'house', 'build', 'lead']) {
    const answer = sequence.nodes.find(node => node.id === topic)
    assert.equal(answer.choices[0].nextId, sequence.nodes[sequence.nodes.indexOf(answer) + 1]?.id)
    sequence.onNodeChanged(topic)
    assert.equal(f.host._campaignSave.introduction.dialogueNodeId, topic)
    assert.equal(f.getSaveCount(), 1)
    assert.equal(f.context.controls.heroUnit.isChief, false)
    assert.equal(f.context.menu.hudSuppressed, true)
    assert.equal(f.host._campaignSave.introduction.status, 'prepared')
  }
  sequence.onComplete()
  assert.equal(f.context.controls.heroUnit.isChief, true)
  assert.equal(f.context.menu.hudSuppressed, false)
  assert.equal(f.host._campaignSave.introduction.status, 'completed')
})

test('camp dialogue resumes a saved answer and gracefully handles older saves', () => {
  const { createCampIntroductionDialogue } = loadTsModule('app/services/introduction/CampIntroductionDialogue.ts')
  for (const nodeId of ['attack', 'rescue', 'next', 'lead', 'questions', undefined, 'obsolete']) {
    const sequence = createCampIntroductionDialogue({ nodeId, onNodeChanged() {}, onComplete() {} })
    assert.equal(sequence.startId, !nodeId || nodeId === 'obsolete' ? 'wake' : nodeId === 'questions' ? 'next' : nodeId)
    for (const node of sequence.nodes)
      for (const choice of node.choices) {
        if (choice.nextId) assert.ok(sequence.nodes.some(next => next.id === choice.nextId))
      }
  }
})

test('starting provisions cover three daily meals and are not refilled by introduction restore', async () => {
  const { consumeVillageFood } = loadTsModule('app/lib/economy/villageFood.ts')
  const f = fixture()
  await f.prepareGameIntroduction(f.host)
  const companion = f.player.units[1]
  for (let day = 1; day <= 3; day++) {
    companion.followingHero = day === 2
    assert.deepEqual(consumeVillageFood(f.player), { needed: 4, consumed: 4 })
    assert.equal(
      Object.values(companion.inventory.resources).reduce((sum, count) => sum + count, 0),
      12 - day * 4
    )
    await f.prepareGameIntroduction(f.host)
    assert.equal(
      Object.values(companion.inventory.resources).reduce((sum, count) => sum + count, 0),
      12 - day * 4
    )
  }
})

test('preparing the camp waits for its sole initial save before returning', async () => {
  const f = fixture()
  let release
  f.host.autosave = () =>
    new Promise(resolve => {
      release = resolve
    })
  let complete = false
  const preparing = f.prepareGameIntroduction(f.host).then(() => {
    complete = true
  })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(typeof release, 'function')
  assert.equal(complete, false)
  release({ key: 'save_0' })
  await preparing
  assert.equal(f.host._initialSaveFailed, false)
})
