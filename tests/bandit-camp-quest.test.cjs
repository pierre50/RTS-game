const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  let journal = { version: 1, quests: [], trackedQuestId: null }
  let spawns = 0
  const bandits = { type: 'Bandits', units: [], buildings: [] }
  const sites = [{ id: 'camp', i: 40, j: 40, unitTypes: ['BanditSword'], generation: 0 }]
  const addGuards = (site, count = 3) => {
    const units = Array.from({ length: count }, (_, index) => ({
      label: `${site.id}:${site.generation}:${index}`,
      hitPoints: 30,
      i: site.i + index,
      j: site.j,
      campPatrolAnchor: { i: site.i, j: site.j },
    }))
    bandits.units.push(...units)
    return units
  }
  addGuards(sites[0])
  const { NeutralVillageQuests } = loadTsModule('app/services/quests/NeutralVillageQuests.ts', {
    mocks: {
      '../../lib/camps/campRespawnState': { campRespawnStates: () => sites },
      '../../classes/map/BanditCampGeneration': {
        respawnBanditCamp(_map, _context, site) {
          if (site.blocked) return false
          spawns++
          site.generation++
          addGuards(site)
          return true
        },
      },
      '../../lib/entities/overheadIndicator': { setEntityOverheadIndicator() {}, clearEntityOverheadIndicator() {} },
      '../../lib/audio/sound': { playSoundCue() {} },
      '../../lib/equipment/equipmentStats': { refreshUnitEquipmentStats() {} },
      '../../lib/lpc': { refreshBakedLpcUnitAssets() {} },
      './QuestRelationReward': { grantQuestRelationReward: () => '' },
    },
  })
  const village = { type: 'AI', label: 'village', i: 5, j: 5, diplomacy: 'neutral', units: [], buildings: [] }
  const chief = { label: 'chief', type: 'Chief', hitPoints: 50, i: 5, j: 5, owner: village, inventory: {} }
  village.units.push(chief)
  const hero = { i: 0, j: 0, inventory: { resources: {} } }
  const context = {
    player: { label: 'player', isEnemy: () => false, views: { isVisible: () => false } },
    players: [village, bandits],
    controls: { heroUnit: hero, instanceInCamera: () => false },
    scheduler: { elapsedMs: 0, add: () => 1, remove() {} },
    dayNight: { state: { day: 1 } },
    map: {
      worldRegionId: 'region',
      resources: new Set([{ type: 'Tree', quantity: 20 }]),
      randomRange: min => min,
      grid: Array.from({ length: 70 }, (_, i) =>
        Array.from({ length: 70 }, (_, j) => ({
          i,
          j,
          category: 'Land',
          solid: false,
          has: null,
        }))
      ),
    },
    getQuestJournal: () => journal,
  }
  const runtime = new NeutralVillageQuests(context)
  const tick = () => {
    context.scheduler.elapsedMs += 500
    runtime.update(false)
  }
  return {
    runtime,
    chief,
    hero,
    context,
    bandits,
    sites,
    addGuards,
    tick,
    spawns: () => spawns,
    reload: () => {
      journal = JSON.parse(JSON.stringify(journal))
    },
  }
}

test('AI chiefs reuse an occupied camp and all kills count before a single reward', () => {
  const f = fixture()
  f.runtime.update()
  assert.equal(f.runtime.getQuest(f.chief).definitionId, 'neutral-bandit-camp')
  assert.equal(f.spawns(), 0)
  assert.equal(f.runtime.accept(f.chief), true)
  assert.equal(f.runtime.interact(f.chief, 'report'), false)
  f.tick()
  assert.equal(f.spawns(), 0)
  let quest = f.runtime.getQuest(f.chief)
  assert.equal(quest.encounters.bandits.entityLabels.length, 3)
  assert.equal(quest.markers['clear-camp'].length, 1)
  f.reload()
  f.tick()
  assert.equal(f.spawns(), 0)
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
  assert.equal(f.spawns(), 0)
})

test('an existing visible camp can be assigned immediately', () => {
  const f = fixture()
  f.context.controls.instanceInCamera = () => true
  f.context.player.views.isVisible = () => true
  f.runtime.update()
  assert.equal(f.runtime.accept(f.chief), true)
  assert.deepEqual(f.runtime.getQuest(f.chief).encounters.bandits.position, { i: 40, j: 40 })
  assert.equal(f.spawns(), 0)
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

test('visiting another region never clears or duplicates the saved camp', () => {
  const f = fixture()
  f.runtime.update()
  f.runtime.accept(f.chief)
  f.tick()
  const quest = f.runtime.getQuest(f.chief)
  f.context.map.worldRegionId = 'elsewhere'
  f.bandits.units = []
  f.tick()
  assert.equal(quest.facts.campCleared, undefined)
  assert.equal(f.spawns(), 0)
})

test('a cleared nearby site respawns immediately without its normal cooldown', () => {
  const f = fixture()
  f.bandits.units = []
  f.sites[0].clearedAtMs = 0
  f.runtime.update()
  assert.equal(f.runtime.accept(f.chief), true)
  assert.equal(f.spawns(), 1)
  assert.equal(f.sites[0].clearedAtMs, undefined)
  assert.equal(f.runtime.getQuest(f.chief).encounters.bandits.entityLabels.length, 3)
})

test('occupied camps take priority over nearer cleared sites', () => {
  const f = fixture()
  f.sites.push({ id: 'empty', i: 20, j: 20, unitTypes: ['BanditSword'], generation: 0 })
  f.runtime.update()
  f.runtime.accept(f.chief)
  assert.equal(f.runtime.getQuest(f.chief).encounters.bandits.position.i, 40)
  assert.equal(f.spawns(), 0)
})

test('selection uses the village position and chooses its nearest occupied camp', () => {
  const f = fixture()
  const site = { id: 'near', i: 20, j: 20, unitTypes: ['BanditSword'], generation: 0 }
  f.sites.push(site)
  f.addGuards(site)
  f.chief.i = 39
  f.chief.j = 39
  f.hero.i = 39
  f.hero.j = 39
  f.runtime.update()
  f.runtime.accept(f.chief)
  assert.equal(f.runtime.getQuest(f.chief).encounters.bandits.position.i, 20)
})

test('blocked old sites are skipped and failed respawns cannot activate a quest', () => {
  const f = fixture()
  f.bandits.units = []
  f.sites[0].blocked = true
  f.runtime.update()
  assert.equal(f.runtime.accept(f.chief), false)
  assert.equal(f.runtime.getQuest(f.chief).status, 'available')
  f.sites.push({ id: 'fallback', i: 50, j: 50, unitTypes: ['BanditSword'], generation: 0 })
  assert.equal(f.runtime.accept(f.chief), true)
  assert.equal(f.runtime.getQuest(f.chief).encounters.bandits.position.i, 50)
})

test('no suitable sites means no new camp offer', () => {
  for (const reason of ['missing', 'distant', 'unreachable']) {
    const f = fixture()
    if (reason === 'missing') {
      f.sites.length = 0
      f.bandits.units = []
    }
    if (reason === 'distant') {
      f.sites[0].i = 500
      f.bandits.units = []
    }
    if (reason === 'unreachable') {
      for (const cell of f.context.map.grid[25]) cell.category = 'Water'
    }
    f.runtime.update()
    assert.notEqual(f.runtime.getQuest(f.chief)?.definitionId, 'neutral-bandit-camp', reason)
  }
})

test('a camp already assigned to another active quest cannot be reused', () => {
  const f = fixture()
  f.runtime.update()
  f.runtime.accept(f.chief)
  const other = { ...f.chief, label: 'other-chief' }
  f.chief.owner.units.push(other)
  f.runtime.update()
  assert.notEqual(f.runtime.getQuest(other)?.definitionId, 'neutral-bandit-camp')
})

test('legacy active quests without an encounter acquire a real camp', () => {
  const f = fixture()
  f.runtime.update()
  const quest = f.runtime.getQuest(f.chief)
  quest.status = 'active'
  quest.assigneeId = 'player'
  f.tick()
  assert.equal(quest.encounters.bandits.entityLabels.length, 3)
  assert.equal(f.spawns(), 0)
})

test('converted guards count as cleared and later respawns do not reset the quest', () => {
  const f = fixture()
  f.runtime.update()
  f.runtime.accept(f.chief)
  const guards = f.bandits.units
  f.bandits.units = []
  f.chief.owner.units.push(...guards)
  f.tick()
  const quest = f.runtime.getQuest(f.chief)
  assert.equal(quest.facts.campCleared, true)
  f.sites[0].generation++
  f.addGuards(f.sites[0])
  f.tick()
  assert.equal(quest.facts.campCleared, true)
})

test('guards chasing far away or inside their cave still keep their home camp occupied', () => {
  const f = fixture()
  f.bandits.units[0].i = 500
  f.bandits.units[1].spaceId = 'bandit-cave'
  f.runtime.update()
  f.runtime.accept(f.chief)
  assert.equal(f.runtime.getQuest(f.chief).encounters.bandits.entityLabels.length, 3)
  f.bandits.units[2].isDead = true
  f.tick()
  assert.equal(f.runtime.getQuest(f.chief).facts.campCleared, undefined)
  assert.equal(f.spawns(), 0)
})

test('acceptance rechecks reservations made after the offer', () => {
  const f = fixture()
  const other = { ...f.chief, label: 'other-chief' }
  f.chief.owner.units.push(other)
  f.runtime.update()
  assert.equal(f.runtime.getQuest(other).definitionId, 'neutral-bandit-camp')
  assert.equal(f.runtime.accept(f.chief), true)
  assert.equal(f.runtime.accept(other), false)
  assert.equal(f.runtime.getQuest(other).status, 'available')
})

test('the village town hall does not prevent a path check from the chief', () => {
  const f = fixture()
  for (let i = 4; i <= 6; i++) for (let j = 4; j <= 6; j++) f.context.map.grid[i][j].solid = true
  f.chief.i = 8
  f.chief.j = 8
  f.runtime.update()
  assert.equal(f.runtime.accept(f.chief), true)
})

test('accepting a bandit quest tracks its camp even when another quest was followed', () => {
  const f = fixture()
  f.runtime.update()
  f.context.getQuestJournal().trackedQuestId = 'previous-quest'
  assert.equal(f.runtime.accept(f.chief), true)
  assert.equal(f.context.getQuestJournal().trackedQuestId, f.runtime.getQuest(f.chief).id)
  assert.deepEqual(f.runtime.getTrackedMarkers('outside', 'region')[0].position, { i: 40, j: 40 })
})
