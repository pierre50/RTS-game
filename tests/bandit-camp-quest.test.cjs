const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  let journal = { version: 1, quests: [], trackedQuestId: null }
  let spawns = 0
  const bandits = { type: 'Bandits', units: [], buildings: [] }
  const { NeutralVillageQuests } = loadTsModule('app/services/quests/NeutralVillageQuests.ts', { mocks: {
    '../../classes/map/BanditCampGeneration': { placeOutdoorBanditQuestCamp(_map, _context, cell) {
      spawns++
      const units = Array.from({ length: 3 }, (_, index) => ({ label: 'bandit-' + index, i: cell.i + index, j: cell.j }))
      bandits.units.push(...units)
      return units
    } },
    '../../lib/entities/overheadIndicator': { setEntityOverheadIndicator() {}, clearEntityOverheadIndicator() {} },
    '../../lib/audio/sound': { playSoundCue() {} },
    '../../lib/equipment/equipmentStats': { refreshUnitEquipmentStats() {} },
    '../../lib/lpc': { refreshBakedLpcUnitAssets() {} },
    './QuestRelationReward': { grantQuestRelationReward: () => '' },
  } })
  const village = { type: 'AI', label: 'village', diplomacy: 'neutral', units: [], buildings: [] }
  const chief = { label: 'chief', type: 'Chief', hitPoints: 50, i: 5, j: 5, owner: village, inventory: {} }
  village.units.push(chief)
  const hero = { inventory: { resources: {} } }
  const context = {
    player: { label: 'player', isEnemy: () => false, views: { isVisible: () => false } },
    players: [village, bandits], controls: { heroUnit: hero, instanceInCamera: () => false },
    scheduler: { elapsedMs: 0, add: () => 1, remove() {} }, dayNight: { state: { day: 1 } },
    map: { worldRegionId: 'region', resources: new Set([{ type: 'Tree', quantity: 20 }]), randomRange: min => min,
      grid: Array.from({ length: 70 }, (_, i) => Array.from({ length: 70 }, (_, j) => ({
        i, j, category: 'Land', solid: false, has: null,
      }))) },
    getQuestJournal: () => journal,
  }
  const runtime = new NeutralVillageQuests(context)
  const tick = () => { context.scheduler.elapsedMs += 500; runtime.update(false) }
  return { runtime, chief, hero, context, bandits, tick, spawns: () => spawns,
    reload: () => { journal = JSON.parse(JSON.stringify(journal)) } }
}

test('AI chiefs offer a camp quest; acceptance spawns once and all kills count before a single reward', () => {
  const f = fixture()
  f.runtime.update()
  assert.equal(f.runtime.getQuest(f.chief).definitionId, 'neutral-bandit-camp')
  assert.equal(f.spawns(), 0)
  assert.equal(f.runtime.accept(f.chief), true)
  assert.equal(f.runtime.interact(f.chief, 'report'), false)
  for (let i = 0; i < 500 && !f.spawns(); i++) f.tick()
  assert.equal(f.spawns(), 1)
  let quest = f.runtime.getQuest(f.chief)
  assert.equal(quest.encounters.bandits.entityLabels.length, 3)
  assert.equal(quest.markers['clear-camp'].length, 1)
  f.reload()
  f.tick()
  assert.equal(f.spawns(), 1)
  f.bandits.units[0].isDead = true
  f.tick()
  assert.equal(f.runtime.interact(f.chief, 'report'), false)
  f.bandits.units[1].isDead = true
  f.bandits.units.splice(2, 1) // Death cleanup may remove a unit before the next quest tick.
  f.tick()
  quest = f.runtime.getQuest(f.chief)
  assert.equal(quest.facts.campCleared, true)
  f.reload()
  assert.equal(f.runtime.interact(f.chief, 'report'), true)
  assert.equal(f.hero.inventory.resources.gold, 25)
  assert.equal(f.runtime.interact(f.chief, 'report'), false)
  assert.equal(f.hero.inventory.resources.gold, 25)
  assert.equal(f.spawns(), 1)
})

test('camera visibility anywhere in the camp footprint delays the whole camp without rewarding an empty quest', () => {
  const f = fixture()
  f.context.controls.instanceInCamera = () => true
  f.runtime.update()
  f.runtime.accept(f.chief)
  for (let i = 0; i < 100; i++) f.tick()
  assert.equal(f.spawns(), 0)
  assert.equal(f.runtime.interact(f.chief, 'report'), false)
  f.context.controls.instanceInCamera = () => false
  for (let i = 0; i < 500 && !f.spawns(); i++) f.tick()
  assert.equal(f.spawns(), 1)
})

test('tutorial and hostile chiefs do not receive bandit offers', () => {
  for (const block of ['tutorial', 'hostile']) {
    const f = fixture()
    if (block === 'tutorial') f.context.isTutorialActive = () => true
    else f.context.player.isEnemy = () => true
    f.runtime.update()
    assert.notEqual(f.runtime.getQuest(f.chief)?.definitionId, 'neutral-bandit-camp')
    assert.equal(f.spawns(), 0)
  }
})

test('a hidden anchor is rejected if any part of the predefined camp is visible', () => {
  const f = fixture()
  // Every candidate footprint crosses a visible strip, even when its center is hidden.
  f.context.player.views.isVisible = i => i % 2 === 0
  f.runtime.update()
  f.runtime.accept(f.chief)
  for (let i = 0; i < 100; i++) f.tick()
  assert.equal(f.spawns(), 0)
  assert.equal(f.runtime.getQuest(f.chief).encounters?.bandits, undefined)
})

test('visiting another region never clears or duplicates the saved camp', () => {
  const f = fixture()
  f.runtime.update()
  f.runtime.accept(f.chief)
  for (let i = 0; i < 500 && !f.spawns(); i++) f.tick()
  const quest = f.runtime.getQuest(f.chief)
  f.context.map.worldRegionId = 'elsewhere'
  f.bandits.units = []
  f.tick()
  assert.equal(quest.facts.campCleared, undefined)
  assert.equal(f.spawns(), 1)
})
