const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const dayListeners = new Set()
  const indicators = new Map()
  const sounds = []
  const { NeutralVillageQuests } = loadTsModule('app/services/quests/NeutralVillageQuests.ts', {
    mocks: {
      '../../lib/audio/sound': { playSoundCue: cue => sounds.push(cue) },
      '../../lib/equipment/equipmentStats': { refreshUnitEquipmentStats() {} },
      '../../lib/lpc': { refreshBakedLpcUnitAssets() {} },
      '../../lib/entities/overheadIndicator': {
        setEntityOverheadIndicator: (npc, type) => indicators.set(npc, type),
        clearEntityOverheadIndicator: npc => indicators.delete(npc),
      },
    },
  })
  let state = { version: 1, quests: [], trackedQuestId: null }
  const village = { label: 'village', name: 'Village', type: 'AI', diplomacy: 'neutral', units: [] }
  const chief = {
    label: 'chief',
    name: 'Ari',
    owner: village,
    type: 'Chief',
    hitPoints: 50,
    inventory: { resources: { wood: 2 } },
  }
  village.units.push(chief)
  const player = { label: 'human', isPlayed: true, isEnemy: () => false, units: [] }
  const hero = { label: 'hero', owner: player, inventory: { resources: { wood: 20 } } }
  const context = {
    dayNight: { state: { day: 1 }, onDayChange(callback) { dayListeners.add(callback); return () => dayListeners.delete(callback) } },
    player,
    players: [player, village],
    controls: { heroUnit: hero },
    map: {
      worldRegionId: 'region',
      resources: new Set([{ type: 'Tree', quantity: 80 }]),
      randomRange: (min, max) => max,
    },
    getQuestJournal: () => state,
    menu: { updateTopbar() {}, refreshInventory() {} },
    scheduler: { add: () => 1, remove() {} },
  }
  const runtime = new NeutralVillageQuests(context)
  context.neutralQuests = runtime
  return {
    context,
    runtime,
    chief,
    hero,
    village,
    indicators,
    sounds,
    nextDay(day) {
      const previous = context.dayNight.state.day
      context.dayNight.state.day = day
      for (const callback of dayListeners) callback(day, previous)
    },
    reload: () => {
      state = JSON.parse(JSON.stringify(state))
    },
  }
}

test('tutorial wood leads to a saved wildlife choice, equipped rewards and conditional ammunition help without gold', () => {
  const { runtime, chief, hero, context, village, reload } = fixture()
  village.isPlayed = true
  chief.i = 1; chief.j = 1
  context.map.grid = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => ({ category: 'Land' })))
  context.map.gaia = { animals: [
    { type: 'Deer', i: 2, j: 2, quantity: 20 },
    { type: 'BlackGrouse', i: 3, j: 3, quantity: 100 },
  ] }
  assert.equal(runtime.assignResourceRequest('tutorial', chief, 'wood', 10, 'tutorial-first-tasks'), true)
  assert.equal(runtime.deliver(chief), true)
  assert.equal(hero.inventory.resources.wood, 10)
  assert.equal(hero.inventory.resources.gold ?? 0, 0)
  assert.equal(hero.inventory.activeWeapons.ranged, 'bow')
  assert.equal(hero.inventory.equipped.arrow, 'arrow_ceramic')
  assert.equal(hero.inventory.equippedCounts.arrow, 20)
  const quest = structuredClone(runtime.getQuest(chief))
  assert.equal(quest.stageId, 'hunt')
  assert.equal(quest.parameters.resource, 'feather')
  assert.equal(quest.parameters.quantity, 3)
  assert.equal(quest.markers.hunt.length, 1)
  assert.equal(runtime.deliver(chief), false)
  assert.equal(runtime.interact(chief, 'arrows'), false)
  reload()
  context.map.gaia.animals = []
  runtime.assignResourceRequest('tutorial', chief, 'wood', 10, 'tutorial-first-tasks')
  assert.deepEqual(runtime.getQuest(chief), quest)
  delete hero.inventory.equipped.arrow
  delete hero.inventory.equippedCounts.arrow
  hero.inventory.equipment.push('arrow_iron')
  assert.equal(runtime.interact(chief, 'arrows'), false)
  hero.inventory.equipment = []
  assert.equal(runtime.interact(chief, 'arrows'), true)
  assert.equal(runtime.interact(chief, 'arrows'), false)
  assert.equal(hero.inventory.equippedCounts.arrow, 20)
  hero.inventory.resources.feather = 3
  assert.equal(runtime.deliver(chief), true)
  assert.equal(runtime.getQuest(chief).status, 'active')
  assert.equal(runtime.getQuest(chief).stageId, 'alarm')
  assert.equal(hero.inventory.activeWeapons.melee, 'sword_ceramic')
  assert.equal(hero.inventory.resources.feather, 0)
  assert.equal(hero.inventory.resources.gold ?? 0, 0)
  assert.equal(runtime.interact(chief, 'arrows'), false)
})

test('old completed tutorial wood can continue without another payment', () => {
  const { runtime, chief, hero, context, village } = fixture()
  village.isPlayed = true
  runtime.assignResourceRequest('tutorial', chief, 'wood', 10)
  assert.equal(runtime.deliver(chief), true)
  hero.inventory.resources.wood = 0
  const gold = hero.inventory.resources.gold
  runtime.assignResourceRequest('tutorial', chief, 'wood', 10, 'tutorial-first-tasks')
  chief.i = 0; chief.j = 0
  context.map.grid = [[{ category: 'Land' }]]
  context.map.gaia = { animals: [{ type: 'Deer', i: 0, j: 0, quantity: 100 }] }
  assert.equal(runtime.interact(chief, 'continue'), true)
  assert.equal(hero.inventory.resources.gold, gold)
  assert.equal(hero.inventory.resources.wood, 0)
  assert.equal(runtime.getQuest(chief).parameters.resource, 'leather')
  assert.equal(runtime.interact(chief, 'continue'), false)
})

test('neutral chief offers once, saves its random request and advertises acceptance and turn-in', () => {
  const { runtime, chief, indicators, reload } = fixture()
  runtime.update()
  const original = structuredClone(runtime.getQuest(chief))
  assert.equal(original.parameters.resource, 'wood')
  assert.equal(original.parameters.quantity, 15)
  assert.equal(indicators.get(chief), 'exclamation')
  reload()
  runtime.update()
  assert.deepEqual(runtime.getQuest(chief), original)
  assert.equal(runtime.system.state.quests.length, 1)
  assert.equal(runtime.accept(chief), true)
  assert.equal(runtime.accept(chief), false)
  assert.equal(indicators.get(chief), 'question')
})

test('delivery moves exact resources from hero to chief once and persists completion', () => {
  const { runtime, chief, hero, indicators, reload } = fixture()
  runtime.update()
  runtime.accept(chief)
  assert.equal(runtime.deliver(chief), true)
  assert.equal(hero.inventory.resources.wood, 5)
  assert.equal(hero.inventory.resources.gold, 15)
  assert.equal(chief.inventory.resources.wood, 17)
  assert.equal(runtime.getQuest(chief).status, 'completed')
  assert.equal(indicators.has(chief), false)
  reload()
  runtime.update()
  assert.equal(runtime.deliver(chief), false)
  assert.equal(hero.inventory.resources.gold, 15)
  assert.equal(runtime.system.state.quests.length, 1)
})

test('spent resources, hostility, sleeping, death and a different space prevent delivery', () => {
  for (const alter of [
    f => {
      f.hero.inventory.resources.wood = 0
    },
    f => {
      f.context.player.isEnemy = () => true
    },
    f => {
      f.chief.sleepVisualState = 'sleeping'
    },
    f => {
      f.chief.isDead = true
    },
    f => {
      f.hero.spaceId = 'cave'
    },
    f => {
      f.context.map.worldRegionId = 'elsewhere'
    },
  ]) {
    const f = fixture()
    f.runtime.update()
    f.runtime.accept(f.chief)
    alter(f)
    const before = structuredClone(f.chief.inventory)
    assert.equal(f.runtime.deliver(f.chief), false)
    assert.deepEqual(f.chief.inventory, before)
    f.runtime.update()
    if (f.context.map.worldRegionId === 'region') assert.equal(f.indicators.has(f.chief), false)
  }
})

test('only neutral chiefs with locally available resources receive an offer', () => {
  for (const alter of [
    f => {
      f.village.isPlayed = true
    },
    f => {
      f.chief.type = 'Villager'
    },
    f => {
      f.village.diplomacy = null
    },
    f => {
      f.context.map.resources.clear()
    },
  ]) {
    const f = fixture()
    alter(f)
    f.runtime.update()
    assert.equal(f.runtime.system.state.quests.length, 0)
  }
  const f = fixture()
  f.village.factionId = 'faction'
  f.village.diplomacy = null
  f.context.getCampaignFactions = () => ({ faction: { relationState: 'neutral' } })
  f.runtime.update()
  assert.equal(f.runtime.system.state.quests.length, 1)
  f.runtime.destroy()
  assert.equal(f.indicators.size, 0)
})

test('quest buttons work without orders, keep an unaccepted offer, and refresh bag progress', t => {
  const previous = global.document
  global.document = {
    createElement: () => ({
      children: [],
      textContent: '',
      hidden: false,
      disabled: false,
      appendChild(child) {
        this.children.push(child)
      },
      replaceChildren(...children) {
        this.children = children
      },
      addEventListener(event, callback) {
        this[event] = callback
      },
    }),
  }
  t.after(() => {
    global.document = previous
  })
  const { NpcQuestPanel } = loadTsModule('app/ui/NpcQuestPanel.ts')
  const f = fixture()
  let closed = 0
  const menu = {
    context: f.context,
    playUiClick() {},
    showMessage() {},
    closeNpcOrders() {
      closed++
    },
  }
  const panel = new NpcQuestPanel(menu, () => {})
  assert.match(panel.update(f.chief), /15/)
  assert.equal(panel.root.children.length, 1)
  panel.clear()
  assert.equal(closed, 0)
  assert.equal(f.runtime.getQuest(f.chief).status, 'available')
  panel.update(f.chief, true)
  panel.root.children[0].click()
  assert.equal(f.runtime.getQuest(f.chief).status, 'active')
  f.hero.inventory.resources.wood = 3
  panel.update(f.chief)
  assert.equal(panel.root.children[1].disabled, true)
  assert.match(panel.root.children[0].textContent, /3\/15/)
  assert.equal(panel.root.children[0].textContent.includes('{'), false)
  f.hero.inventory.resources.wood = 15
  panel.update(f.chief)
  assert.equal(panel.root.children[1].disabled, false)
  panel.root.children[1].click()
  assert.equal(f.runtime.getQuest(f.chief).status, 'completed')
  assert.equal(panel.root.children.length, 0)
})

test('completion grants faction relation once, reports actual gain and announces crossed thresholds', () => {
  const { adjustFactionRelation } = loadTsModule('app/lib/combat/factions.ts')
  for (const [score, status, expectedScore, expectedStatus, gain] of [
    [0, 'neutral', 10, 'neutral', 10],
    [20, 'neutral', 30, 'friendly', 10],
    [60, 'friendly', 70, 'allied', 10],
    [95, 'allied', 100, 'allied', 5],
  ]) {
    const f = fixture()
    let faction = { id: 'faction', name: 'Maison Ari', relationScore: score, relationState: status }
    let changes = 0
    const messages = []
    f.village.factionId = 'faction'
    f.context.getCampaignFactions = () => ({ faction })
    f.context.changeFactionRelation = (id, delta) => {
      assert.equal(id, 'faction')
      faction = adjustFactionRelation(faction, delta, 123)
      changes++
    }
    f.context.menu.showMessage = message => messages.push(message)
    f.runtime.update()
    assert.equal(f.runtime.accept(f.chief), true)
    assert.equal(f.runtime.deliver(f.chief), true)
    assert.equal(faction.relationScore, expectedScore)
    assert.equal(faction.relationState, expectedStatus)
    assert.match(messages[0], new RegExp(`Maison Ari : \\+${gain}`))
    assert.equal(messages[0].includes('Nouvelle relation'), status !== expectedStatus)
    assert.equal(f.runtime.dialogue(f.chief).status, 'completed')
    f.reload()
    assert.equal(f.runtime.deliver(f.chief), false)
    assert.equal(changes, 1)
    assert.equal(messages.length, 1)
  }
})

test('failed deliveries grant no reputation; independent village reputation survives reload', () => {
  const f = fixture()
  f.runtime.update(); f.runtime.accept(f.chief)
  f.hero.inventory.resources.wood = 0
  assert.equal(f.runtime.deliver(f.chief), false)
  assert.equal(f.runtime.system.state.villageRelations, undefined)
  f.hero.inventory.resources.wood = 15
  assert.equal(f.runtime.deliver(f.chief), true)
  const key = JSON.stringify(['region', 'village'])
  assert.equal(f.runtime.system.state.villageRelations[key], 10)
  f.reload()
  assert.equal(f.runtime.system.state.villageRelations[key], 10)
  assert.equal(f.runtime.getQuest(f.chief).facts.relationRewardApplied, true)
})

test('maximum reputation completion does not announce a fictitious increase', () => {
  const f = fixture()
  f.runtime.update(); f.runtime.accept(f.chief)
  f.runtime.system.state.villageRelations = { [JSON.stringify(['region', 'village'])]: 100 }
  const messages = []
  f.context.menu.showMessage = message => messages.push(message)
  assert.equal(f.runtime.deliver(f.chief), true)
  assert.match(messages[0], /déjà au maximum/)
  assert.equal(messages[0].includes('+10'), false)
})

test('next day renews a completed request after three days with a new id and new parameters', () => {
  const f = fixture()
  f.runtime.update()
  f.runtime.accept(f.chief)
  f.runtime.deliver(f.chief)
  const previous = structuredClone(f.runtime.getQuest(f.chief))
  assert.equal(previous.completedDay, 1)
  assert.equal(previous.nextOfferDay, 4)
  f.nextDay(3)
  assert.equal(f.runtime.getQuest(f.chief).id, previous.id)
  f.reload()
  f.nextDay(4)
  const next = f.runtime.getQuest(f.chief)
  assert.notEqual(next.id, previous.id)
  assert.notDeepEqual(next.parameters, previous.parameters)
  assert.equal(next.status, 'available')
  assert.equal(f.indicators.get(f.chief), 'exclamation')
  assert.deepEqual(f.runtime.system.state.quests[0], previous)
  f.nextDay(20)
  assert.equal(f.runtime.system.state.quests.length, 2)
  assert.equal(f.runtime.getQuest(f.chief).id, next.id)
  f.runtime.accept(f.chief)
  f.nextDay(50)
  assert.equal(f.runtime.getQuest(f.chief).id, next.id)
  assert.equal(f.hero.inventory.resources.gold, 15)
})

test('entering a map after a long absence creates only one offer and keeps completion history', () => {
  const f = fixture()
  f.runtime.update()
  f.runtime.accept(f.chief)
  f.runtime.deliver(f.chief)
  f.runtime.destroy()
  f.reload()
  f.context.dayNight.state.day = 30
  const runtime = new f.runtime.constructor(f.context)
  runtime.update()
  runtime.update()
  assert.equal(runtime.system.state.quests.length, 2)
  assert.equal(runtime.getQuest(f.chief).status, 'available')
  assert.equal(f.hero.inventory.resources.gold, 15)
  runtime.destroy()
})

test('legacy active quests gain their gold reward, legacy completed quests only start a cooldown', () => {
  const f = fixture()
  f.runtime.update()
  f.runtime.accept(f.chief)
  delete f.runtime.getQuest(f.chief).parameters.rewardGold
  f.reload()
  assert.equal(f.runtime.deliver(f.chief), true)
  assert.equal(f.hero.inventory.resources.gold, 15)
  const quest = f.runtime.getQuest(f.chief)
  delete quest.completedDay
  delete quest.nextOfferDay
  f.context.dayNight.state.day = 10
  f.reload()
  f.runtime.update()
  assert.equal(f.runtime.getQuest(f.chief).nextOfferDay, 13)
  assert.equal(f.runtime.system.state.quests.length, 1)
  assert.equal(f.hero.inventory.resources.gold, 15)
})


test('fixed tutorial assignment works for an own chief, delivers once and never respawns', () => {
  const f = fixture()
  f.chief.owner = f.context.player
  f.context.player.units.push(f.chief)
  f.village.units = []
  assert.equal(f.runtime.dialogue(f.chief), undefined)
  assert.equal(f.runtime.assignResourceRequest('tutorial-wood', f.chief, 'wood', 10), true)
  const quest = f.runtime.dialogue(f.chief)
  assert.equal(quest.status, 'active')
  assert.equal(f.runtime.system.state.trackedQuestId, quest.id)
  f.hero.inventory.resources.wood = 9
  assert.equal(f.runtime.deliver(f.chief), false)
  f.hero.inventory.resources.wood = 10
  f.runtime.update()
  assert.equal(f.indicators.get(f.chief), 'question')
  assert.equal(f.runtime.deliver(f.chief), true)
  assert.equal(f.hero.inventory.resources.wood, 0)
  assert.equal(f.hero.inventory.resources.gold, 10)
  assert.equal(f.runtime.deliver(f.chief), false)
  f.reload()
  f.nextDay(100)
  assert.equal(f.runtime.assignResourceRequest('tutorial-wood', f.chief, 'wood', 10), true)
  assert.equal(f.runtime.system.state.quests.length, 1)
  assert.equal(f.runtime.dialogue(f.chief).status, 'completed')
  assert.equal(f.runtime.system.state.villageRelations, undefined)
})


test('tutorial raid waits for dialogue closure and cannot duplicate its army or sword', async () => {
  const { runtime, chief, hero, village, context, sounds } = fixture()
  village.isPlayed = true
  runtime.assignResourceRequest('tutorial', chief, 'wood', 10, 'tutorial-first-tasks')
  const quest = runtime.getQuest(chief)
  quest.stageId = 'hunt'
  quest.parameters.resource = 'leather'
  quest.parameters.quantity = 2
  hero.inventory.resources.leather = 2
  let starts = 0
  let resolveRaid
  context.tributeRaids = { triggerTutorialRaid: () => { starts++; return new Promise(resolve => { resolveRaid = resolve }) } }
  assert.equal(runtime.deliver(chief), true)
  assert.deepEqual(sounds, ['attack-warning'])
  assert.equal(starts, 0)
  assert.equal(quest.stageId, 'alarm')
  assert.equal(runtime.deliver(chief), false)
  runtime.dialogueClosed(chief)
  runtime.dialogueClosed(chief)
  assert.equal(starts, 1)
  assert.equal(quest.stageId, 'raid')
  resolveRaid(true)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(quest.facts.raidStarted, true)
  runtime.dialogueClosed(chief)
  assert.equal(starts, 1)
  assert.equal(hero.inventory.activeWeapons.melee, 'sword_ceramic')
  assert.equal(hero.inventory.equipment.includes('sword_ceramic'), false)
})

test('failed tutorial raid can retry on the next dialogue close', async () => {
  const { runtime, chief, village, context } = fixture()
  village.isPlayed = true
  runtime.assignResourceRequest('tutorial', chief, 'wood', 10, 'tutorial-first-tasks')
  runtime.getQuest(chief).stageId = 'raid'
  let starts = 0
  context.tributeRaids = { triggerTutorialRaid: async () => ++starts > 1 }
  runtime.dialogueClosed(chief)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(runtime.getQuest(chief).facts.raidStarted, undefined)
  runtime.dialogueClosed(chief)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(starts, 2)
  assert.equal(runtime.getQuest(chief).facts.raidStarted, true)
})

test('a previously completed hunt continues without paying its resources twice', () => {
  const { runtime, chief, hero, village } = fixture()
  village.isPlayed = true
  runtime.assignResourceRequest('tutorial', chief, 'wood', 10, 'tutorial-first-tasks')
  const quest = runtime.getQuest(chief)
  quest.stageId = 'hunt'
  quest.status = 'completed'
  quest.completedDay = 1
  assert.equal(runtime.assignResourceRequest('tutorial', chief, 'wood', 10, 'tutorial-first-tasks'), true)
  assert.equal(quest.stageId, 'legacy-hunt')
  assert.equal(runtime.interact(chief, 'continue'), true)
  assert.equal(quest.stageId, 'alarm')
  assert.equal(hero.inventory.activeWeapons.melee, 'sword_ceramic')
  assert.equal(runtime.interact(chief, 'continue'), false)
})

test('sleep sessions block quests through preview and waking until the real wake completes', () => {
  for (const visual of ['sleeping', 'waking', null]) {
    const { runtime, chief, hero } = fixture()
    runtime.update()
    chief.shelterState = { reason: 'sleep', status: 'outside', location: 'outside' }
    chief.sleepVisualState = visual
    assert.equal(runtime.accept(chief), false)
    chief.shelterState = null
    chief.sleepVisualState = null
    assert.equal(runtime.accept(chief), true)
    chief.shelterState = { reason: 'sleep', status: 'outside', location: 'outside' }
    chief.sleepVisualState = visual
    const before = structuredClone(hero.inventory)
    assert.equal(runtime.deliver(chief), false)
    assert.deepEqual(hero.inventory, before)
    chief.shelterState = null
    chief.sleepVisualState = 'waking'
    assert.equal(runtime.deliver(chief), false)
    chief.sleepVisualState = null
    assert.equal(runtime.deliver(chief), true)
  }
})

test('a sleeping tutorial chief cannot give ammunition or launch the raid on dialogue close', () => {
  const { runtime, chief, village, context, hero } = fixture()
  village.isPlayed = true
  runtime.assignResourceRequest('tutorial', chief, 'wood', 10, 'tutorial-first-tasks')
  const quest = runtime.getQuest(chief)
  quest.stageId = 'hunt'
  chief.shelterState = { reason: 'sleep' }
  chief.sleepVisualState = null
  assert.equal(runtime.interact(chief, 'arrows'), false)
  assert.equal(hero.inventory.equipped?.arrow, undefined)
  quest.stageId = 'raid'
  context.tributeRaids = { triggerTutorialRaid: () => assert.fail('Sleeping conversation must not start a raid') }
  runtime.dialogueClosed(chief)
  assert.equal(quest.facts.raidStarted, undefined)
})
