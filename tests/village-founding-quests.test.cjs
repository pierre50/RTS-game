const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { QuestSystem, createQuestJournal } = loadTsModule('app/services/quests/QuestSystem.ts')
const { assignVillageFoundingQuests, updateVillageFoundingQuests } = loadTsModule('app/services/quests/VillageFoundingQuests.ts')

test('first house is tracked once, survives reload, and completes only for a finished local house', () => {
  let journal = createQuestJournal()
  const system = new QuestSystem(() => journal)
  let saves = 0
  const context = { player: { label: 'player', buildings: [] }, map: { worldRegionId: 'camp' },
    autosave: () => saves++ }
  const companion = { label: 'companion', name: 'Companion' }
  assignVillageFoundingQuests(context, system, companion)
  assignVillageFoundingQuests(context, system, companion)
  assert.equal(journal.quests.length, 1)
  assert.equal(journal.trackedQuestId, journal.quests[0].id)
  assert.ok(system.definitions.has(journal.quests[0].definitionId))
  journal = structuredClone(journal)
  const quest = journal.quests[0]
  for (const building of [
    { type: 'TownCenter', isBuilt: true },
    { type: 'House', isBuilt: false },
    { type: 'House', isBuilt: true, isDead: true },
    { type: 'House', isBuilt: true, isDestroyed: true },
  ]) {
    context.player.buildings = [building]
    updateVillageFoundingQuests(context, system)
    assert.equal(quest.status, 'active')
  }
  context.player.buildings = [{ type: 'House', isBuilt: true }]
  context.map.worldRegionId = 'other'
  updateVillageFoundingQuests(context, system)
  assert.equal(quest.status, 'active')
  context.map.worldRegionId = 'camp'
  updateVillageFoundingQuests(context, system)
  assert.equal(quest.status, 'completed')
  assert.equal(quest.facts.done, true)
  assert.equal(journal.trackedQuestId, 'village-forum')
  updateVillageFoundingQuests(context, system)
  assert.equal(saves, 1)
})


function militaryFixture() {
  let journal = createQuestJournal()
  const system = new QuestSystem(() => journal)
  const context = { player: { label: 'player', buildings: [], units: [] }, map: { worldRegionId: 'camp' } }
  assignVillageFoundingQuests(context, system, { label: 'companion' })
  const build = type => context.player.buildings.push({ type, isBuilt: true })
  for (const type of ['House', 'TownCenter', 'Granary', 'StoragePit']) build(type)
  updateVillageFoundingQuests(context, system)
  return { context, system, build, journal: () => journal,
    update: () => updateVillageFoundingQuests(context, system),
    reload: () => { journal = structuredClone(journal) } }
}

for (const [building, unit] of [['Barracks', 'Fantassin'], ['ArcheryRange', 'Bowman']]) {
  test(`${building} alone unlocks military training, then the forge completes the guide`, () => {
    const f = militaryFixture()
    assert.equal(f.journal().trackedQuestId, 'village-military')
    f.build(building)
    f.update()
    assert.equal(f.journal().trackedQuestId, 'village-defenders')
    f.reload()
    f.context.player.units.push({ type: unit }, { type: unit })
    f.update()
    assert.equal(f.journal().trackedQuestId, 'village-forge')
    f.build('Forge')
    f.update()
    assert.equal(f.journal().trackedQuestId, null)
    assert.equal(f.journal().quests.length, 7)
    assert.ok(f.journal().quests.every(quest => quest.status === 'completed'))
    f.update()
    assert.equal(f.journal().quests.length, 7)
  })
}

test('military tasks reject unfinished buildings, queued recruits, casualties, heroes and other regions', () => {
  const f = militaryFixture()
  f.context.player.buildings.push({ type: 'Barracks', isBuilt: false }, { type: 'ArcheryRange', isBuilt: true, isDead: true })
  f.update()
  assert.equal(f.journal().trackedQuestId, 'village-military')
  f.build('Barracks')
  f.update()
  f.context.player.units.push(
    { type: 'Villager', trainingTargetType: 'Fantassin' },
    { type: 'Fantassin', trainingTargetType: 'Fantassin' },
    { type: 'Fantassin', isDead: true },
    { type: 'Bowman', isDestroyed: true },
    { type: 'Fantassin', controlMode: 'hero' },
    { type: 'Hero' },
  )
  f.update()
  assert.equal(f.journal().trackedQuestId, 'village-defenders')
  f.context.player.units.push({ type: 'Fantassin' }, { type: 'Bowman' })
  f.context.map.worldRegionId = 'away'
  f.update()
  assert.equal(f.journal().trackedQuestId, 'village-defenders')
  f.context.map.worldRegionId = 'camp'
  f.update()
  assert.equal(f.journal().trackedQuestId, 'village-forge')
})

for (const tracked of [null, 'another-quest']) {
  test(`anticipated military and forge count while preserving tracking: ${tracked}`, () => {
    const f = militaryFixture()
    f.journal().trackedQuestId = tracked
    f.build('ArcheryRange')
    f.build('Forge')
    f.context.player.units.push({ type: 'Bowman' }, { type: 'Fantassin' })
    f.update()
    assert.equal(f.journal().trackedQuestId, tracked)
    assert.equal(f.journal().quests.length, 7)
    assert.ok(f.journal().quests.every(quest => quest.status === 'completed'))
  })
}
