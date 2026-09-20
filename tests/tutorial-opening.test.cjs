const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { VisionGrid } = loadTsModule('app/services/VisionGrid.ts')

function fixture() {
  let wakeComplete
  let delayed
  let approachTick
  let enter
  let dialogue
  let saved
  let departures = 0
  const hero = { label: 'hero', type: 'Hero', isChief: true, i: 5, j: 5, x: 5, y: 5, stop() {} }
  const cells = [{ i: 4, j: 4 }, { i: 4, j: 5 }, { i: 5, j: 4 }]
  const space = { id: 'house-interior', idleCells: cells, entryCell: { i: 1, j: 1 }, entryPortal: { sourceSpaceId: 'outside', sourceCell: { i: 7, j: 6 } } }
  const api = loadTsModule('app/services/tutorial/TutorialOpening.ts', { mocks: {
    '../introduction/IntroductionPlacement': { findIntroductionPlacement: () => ({ camp: { i: 7, j: 5 }, companion: { i: 3, j: 5 } }) },
    '../../lib/lpc': { ensureAndRefreshBakedLpcUnitAssets: async () => {} },
    '../../lib/maths': { getInstanceDegree: () => 90 },
    '../../lib/mapSpaces': { getMapSpace: () => ({ id: 'outside' }), moveEntityToMapSpace(map, unit, targetSpace, cell) { Object.assign(unit, { i: cell.i, j: cell.j, spaceId: targetSpace.id }); cell.has = unit } },
    '../SpacePortalSystem': { prepareUnitForSpaceTransfer() {}, routeUnitThroughSpacePortal(context, unit, portal, options) {
      enter = () => { unit.spaceId = space.id; unit.i = 1; unit.j = 1; options.onTransferred() }
      return true
    } },
    '../BuildingInteriorSpaceSystem': {
      ensureBuildingInteriorSpace: () => space, activateBuildingInteriorSpace() {}, refreshMapSpaceEntityVisibility() {},
      getBuildingInteriorSpaceForUnit: unit => unit.spaceId === space.id ? space : null,
      routeUnitOutOfBuildingInteriorSpace(context, unit, space, options) { departures++; delete unit.spaceId; options?.onTransferred?.(); return true },
    },
    '../rest/UnitSleepVisuals': {
      setSleepingOutsideFinalVisual(unit) { unit.sleepVisualState = 'sleeping' },
      playSleepingWakeVisual(unit, done) { wakeComplete = () => { unit.sleepVisualState = null; done() } },
    },
    '../../lib/entities/overheadIndicator': { setUnitOverheadIndicator() {}, clearUnitOverheadIndicator() {} },
  } })
  const player = {
    views: new VisionGrid(8), cellViewed: 0,
    units: [hero], buildings: [], config: { buildings: { House: { size: 2 } } },
    createBuilding(options) { const house = { ...options, label: 'house' }; this.buildings.push(house); return house },
    createUnit(options) { const chief = { ...options, label: 'chief', owner: this, stop() {}, sendToEvt(cell) { this.destination = cell; this.path = [cell] } }; this.units.push(chief); return chief },
  }
  player.createBuilding({ type: 'House', i: 7, j: 5, isBuilt: true })
  player.createUnit({ type: 'Chief', i: 3, j: 5 })
  const context = {
    player, map: { random: () => 0, grid: [] },
    neutralQuests: { assignResourceRequest: () => true },
    scheduler: { addOneShot(fn) { delayed = fn }, add(fn) { approachTick = fn; return 1 }, remove() { approachTick = null } },
    controls: { heroUnit: hero, setRuntimeInputEnabled(value) { this.enabled = value } },
    menu: { setHudSuppressed(value) { this.suppressed = value }, openNpcOrders(units, options) { dialogue = options }, closeNpcOrders() {} },
  }
  const host = {
    _campaignSave: { currentWorldId: 'start' }, _gameContext: () => context,
    _loadRequiredInteriorBlueprint: async () => ({}),
    togglePause(value) { context.paused = value }, autosave() { saved = structuredClone(host._campaignSave) },
  }
  return { ...api, host, context, hero, player, beginEntry() { delayed() }, enter() { enter() },
    arrive() { const chief = player.units[1]; Object.assign(chief, { i: chief.destination.i, j: chief.destination.j, path: [] }); approachTick() },
    get dialogue() { return dialogue }, get waking() { return Boolean(wakeComplete) }, tick() { approachTick() },
    wake() { this.beginEntry(); this.enter(); this.arrive(); wakeComplete() }, reply() { dialogue.dialogue.onNodeChanged('polite'); dialogue.dialogue.onComplete() }, get saved() { return saved }, get departures() { return departures } }
}

test('the opening forgets the temporary outside spawn, keeps interior exploration and preserves later progress', async () => {
  const f = fixture()
  const { views } = f.player
  let fogged = false
  let invalidated = false
  let rebuilt = false
  let resourcesRefreshed = false
  const cell = { i: 2, j: 3, viewBy: new Set([f.hero]), setFog() { fogged = true } }
  f.context.map.grid = [[cell]]
  f.context.map.mapFog = { viewportRenderer: { invalidate() { invalidated = true } } }
  f.context.menu.rebuildTerrainMiniMapFromViews = () => { rebuilt = true; assert.equal(views.isViewed(2, 3), false) }
  f.context.menu.updateResourcesMiniMap = () => { resourcesRefreshed = true }
  views.setViewed(2, 3)
  views.addViewer(2, 3, f.hero)
  views.withSpace('house-interior', () => {
    views.setViewed(4, 4)
    views.addViewer(4, 4, f.hero)
  })
  f.player.cellViewed = 2
  await f.prepareTutorialOpening(f.host)
  assert.equal(views.isViewed(2, 3), false)
  assert.equal(views.isVisible(2, 3), false)
  assert.equal(cell.viewBy.size, 0)
  assert.equal(f.player.cellViewed, 1)
  assert.ok(fogged && invalidated && rebuilt && resourcesRefreshed)
  views.withSpace('house-interior', () => {
    assert.equal(views.isViewed(4, 4), true)
    assert.equal(views.isVisible(4, 4), true)
  })
  assert.equal(views.toJSON()[2]?.[3]?.viewed, undefined)

  views.setViewed(2, 3)
  await f.prepareTutorialOpening(f.host)
  await f.restoreTutorialOpening(f.host)
  assert.equal(views.isViewed(2, 3), true)
})

test('autosaves during preparation keep the opening on the live campaign', async () => {
  const f = fixture()
  f.host._loadRequiredInteriorBlueprint = async () => {
    f.host._campaignSave = structuredClone(f.host._campaignSave)
    return {}
  }
  await f.prepareTutorialOpening(f.host)
  assert.equal(f.host._campaignSave.tutorial.stage, 'sleeping')
  assert.equal(f.saved.tutorial.stage, 'sleeping')
  f.showTutorialOpening(f.host)
  assert.equal(f.context.controls.enabled, false)
  assert.equal(f.hero.sleepVisualState, 'sleeping')
  f.startTutorialOpening(f.host)
  f.wake()
  assert.equal(f.host._campaignSave.tutorial.stage, 'dialogue')
  assert.equal(f.dialogue.dialogue.startId, 'wake')
})

test('first tutorial step creates a house, wakes the non-chief hero and sends the chief outside after the reply', async () => {
  const f = fixture()
  await f.prepareTutorialOpening(f.host)
  assert.equal(f.hero.spaceId, 'house-interior')
  assert.equal(f.hero.isChief, false)
  assert.equal(f.player.units[1].isChief, true)
  assert.equal(f.saved.tutorial.stage, 'sleeping')
  assert.equal(f.saved.introduction, undefined)
  await f.prepareTutorialOpening(f.host)
  assert.equal(f.player.buildings.length, 1)
  assert.equal(f.player.units.length, 2)
  f.showTutorialOpening(f.host)
  assert.equal(f.hero.sleepVisualState, 'sleeping')
  assert.equal(f.context.controls.enabled, false)
  assert.equal(f.context.menu.suppressed, true)
  f.startTutorialOpening(f.host)
  f.wake()
  assert.equal(f.context.paused, false)
  assert.equal(f.saved.tutorial.stage, 'dialogue')
  assert.equal(f.departures, 0)
  f.host._campaignSave = structuredClone(f.saved)
  f.reply()
  assert.equal(f.saved.tutorial.stage, 'wood-requested')
  assert.equal(f.departures, 1)
  assert.equal(f.context.controls.enabled, true)
  assert.equal(f.context.menu.suppressed, false)
  assert.equal(f.hero.isChief, false)
  f.reply()
  assert.equal(f.departures, 1)
  f.showTutorialOpening(f.host)
  f.startTutorialOpening(f.host)
  assert.equal(f.departures, 1)
})

test('tutorial chooses the farthest living house and sends the chief to the TownCenter after exiting', async () => {
  const f = fixture()
  const center = { type: 'TownCenter', label: 'center', i: 5, j: 5, isBuilt: true }
  const house = { type: 'House', label: 'far-house', i: 18, j: 12, isBuilt: true }
  f.player.buildings.push(center, house,
    { ...house, label: 'ruined-house', i: 30, isDead: true },
    { ...house, label: 'unfinished-house', i: 40, isBuilt: false })
  let destination
  f.player.units[1].sendTo = target => { destination = target }
  await f.prepareTutorialOpening(f.host)
  assert.equal(f.saved.tutorial.houseLabel, 'far-house')
  f.showTutorialOpening(f.host)
  f.startTutorialOpening(f.host)
  f.wake()
  assert.equal(destination, undefined)
  f.reply()
  assert.equal(destination, center)
  assert.equal(f.player.units[1].lookingAtHero, false)
})

test('existing campaigns are not given a tutorial and saved dialogue does not replay sleep', async () => {
  const f = fixture()
  f.showTutorialOpening(f.host)
  f.startTutorialOpening(f.host)
  assert.equal(f.context.controls.enabled, undefined)
  await f.prepareTutorialOpening(f.host)
  f.host._campaignSave.tutorial.stage = 'dialogue'
  f.showTutorialOpening(f.host)
  f.startTutorialOpening(f.host)
  assert.equal(f.hero.sleepVisualState, undefined)
  f.reply()
  assert.equal(f.saved.tutorial.stage, 'wood-requested')
})

test('loading an unfinished tutorial restores projected exterior occupants inside without recreating them', async () => {
  const f = fixture()
  await f.prepareTutorialOpening(f.host)
  const saved = structuredClone(f.saved)
  for (const cell of f.host._activeBuildingInteriorSpace.idleCells) delete cell.has
  delete f.hero.spaceId
  delete f.player.units[1].spaceId
  f.host._campaignSave = saved
  await f.restoreTutorialOpening(f.host)
  assert.equal(f.hero.spaceId, 'house-interior')
  assert.equal(f.player.units[1].spaceId, 'outside')
  assert.equal(f.player.units.length, 2)
  assert.equal(f.player.buildings.length, 1)
  assert.equal(f.host._campaignSave.tutorial.stage, 'sleeping')
})


test('chief enters through the door and reaches the sleeping hero before waking or opening dialogue', async () => {
  const f = fixture()
  await f.prepareTutorialOpening(f.host)
  assert.equal(f.player.units[1].spaceId, 'outside')
  f.showTutorialOpening(f.host)
  f.startTutorialOpening(f.host)
  f.beginEntry()
  assert.equal(f.waking, false)
  assert.equal(f.dialogue, undefined)
  f.enter()
  assert.equal(f.player.units[1].i, 1)
  f.tick()
  assert.equal(f.waking, false)
  assert.equal(f.hero.sleepVisualState, 'sleeping')
  f.arrive()
  assert.equal(f.waking, true)
  assert.equal(f.dialogue, undefined)
})

test('tutorial resolves the chief and house from the AI host instead of the guest owner', async () => {
  const f = fixture()
  const village = f.player
  village.type = 'AI'
  village.civ = 'Hellas'
  village.units = village.units.filter(unit => unit !== f.hero)
  const guest = { isPlayed: true, civ: 'Hellas', units: [f.hero], buildings: [], views: new VisionGrid(8), cellViewed: 0, createUnit() {} }
  f.context.player = guest
  f.context.players = [guest, village]
  await f.prepareTutorialOpening(f.host)
  assert.equal(f.saved.tutorial.chiefLabel, village.units[0].label)
  assert.equal(f.saved.tutorial.houseLabel, village.buildings[0].label)
  assert.equal(guest.buildings.length, 0)
  f.showTutorialOpening(f.host)
  assert.equal(f.hero.sleepVisualState, 'sleeping')
  await f.restoreTutorialOpening(f.host)
  assert.equal(village.units.length, 1)
})

for (const branch of ['polite', 'rebel']) {
  test(`tutorial keeps the ${branch} reply on reload and waits for the wood acknowledgement`, async () => {
    const f = fixture()
    await f.prepareTutorialOpening(f.host)
    f.showTutorialOpening(f.host)
    f.startTutorialOpening(f.host)
    f.wake()
    const sequence = f.dialogue.dialogue
    assert.equal(sequence.nodes[0].choices.length, 2)
    sequence.onNodeChanged(branch)
    assert.equal(f.saved.tutorial.dialogueNodeId, branch)
    assert.equal(f.saved.tutorial.stage, 'dialogue')
    assert.equal(f.departures, 0)
    f.showTutorialOpening(f.host)
    f.startTutorialOpening(f.host)
    assert.equal(f.dialogue.dialogue.startId, branch)
    f.dialogue.dialogue.onComplete()
    assert.equal(f.saved.tutorial.stage, 'wood-requested')
    assert.equal(f.departures, 1)
  })
}


test('the wood quest is assigned only after accepting the chief request', async () => {
  const f = fixture()
  let assignments = 0
  f.context.neutralQuests.assignResourceRequest = () => { assignments++; return true }
  await f.prepareTutorialOpening(f.host)
  assert.equal(assignments, 0)
  f.showTutorialOpening(f.host)
  f.startTutorialOpening(f.host)
  f.wake()
  assert.equal(assignments, 0)
  f.dialogue.dialogue.onNodeChanged('polite')
  assert.equal(assignments, 0)
  f.dialogue.dialogue.onComplete()
  assert.equal(assignments, 1)
  assert.equal(f.saved.tutorial.stage, 'wood-requested')
})


test('reloading an old opening removes its prematurely tracked quest', async () => {
  const f = fixture()
  await f.prepareTutorialOpening(f.host)
  const id = JSON.stringify(['tutorial-wood', 'start', 'chief'])
  const journal = { quests: [{ id, stageId: 'wood' }, { id: 'other' }], trackedQuestId: id }
  f.context.getQuestJournal = () => journal
  await f.restoreTutorialOpening(f.host)
  assert.deepEqual(journal.quests, [{ id: 'other' }])
  assert.equal(journal.trackedQuestId, null)
})
