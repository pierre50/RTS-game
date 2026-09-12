const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const indicators = new Map()
  const { NeutralVillageQuests } = loadTsModule('app/services/quests/NeutralVillageQuests.ts', {
    mocks: {
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
    reload: () => {
      state = JSON.parse(JSON.stringify(state))
    },
  }
}

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
  assert.equal(chief.inventory.resources.wood, 17)
  assert.equal(runtime.getQuest(chief).status, 'completed')
  assert.equal(indicators.has(chief), false)
  reload()
  runtime.update()
  assert.equal(runtime.deliver(chief), false)
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

test('quest buttons work without orders, keep a declined offer, and refresh bag progress', t => {
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
  assert.equal(panel.root.children.length, 2)
  panel.root.children[1].click()
  assert.equal(closed, 1)
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
