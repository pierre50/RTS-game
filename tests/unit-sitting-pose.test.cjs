const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { getUnitRestVisualSheet, syncUnitSittingPose } = loadTsModule('app/lib/units/visuals/unitSittingPose.ts', {
  mocks: { './unitControl': { isHeroControlled: unit => unit.controlMode === 'hero' } },
})

function villager(hour, extra = {}) {
  return {
    type: 'Villager',
    sittingSheet: { textures: { pose: {} } },
    inactif: true,
    context: { dayNight: { state: { hour, minute: 15 } }, scheduler: { elapsedMs: 100 } },
    dailySchedule: {
      wakeMinute: 360,
      workStartMinute: 420,
      lunchStartMinute: 720,
      lunchEndMinute: 780,
      workEndMinute: 1080,
      bedMinute: 1320,
    },
    currentSheet: 'standingSheet',
    ...extra,
  }
}

test('morning, lunch and evening use a static rest sheet; work and sleep do not', () => {
  for (const hour of [6, 12, 19]) {
    assert.equal(getUnitRestVisualSheet(villager(hour), 'standingSheet'), 'sittingSheet')
  }
  for (const hour of [5, 9, 13, 23]) {
    assert.equal(getUnitRestVisualSheet(villager(hour), 'standingSheet'), 'standingSheet')
  }
})

test('sitting never interrupts orders, movement, combat, sleep, mounted units or conversations', () => {
  for (const state of [
    { action: 'chop' },
    { dest: {} },
    { path: [{}] },
    { pendingOrder: {} },
    { inactif: false },
    { combatMode: 'flee' },
    { sleepVisualState: 'sleeping' },
    { mountedOnHorse: true },
    { controlMode: 'hero' },
    { lookingAtHero: true },
    { followingHero: true },
    { restWakeLockUntilMs: 200 },
    { isDead: true },
    { visible: false },
    { shelterState: { status: 'movingToRest' } },
    { shelterState: { status: 'inside' } },
    { type: 'BanditSword' },
    { sittingSheet: undefined },
  ]) {
    assert.equal(getUnitRestVisualSheet(villager(12, state), 'standingSheet'), 'standingSheet', JSON.stringify(state))
  }
  for (const sheet of ['walkingSheet', 'actionSheet', 'dyingSheet']) {
    assert.equal(getUnitRestVisualSheet(villager(12), sheet), sheet)
  }
})

test('wake waiting and restored meal breaks sit; resuming work restores standing without changing the task', () => {
  for (const status of ['outside', 'wakingUp', 'inside']) {
    const unit = villager(6, { shelterState: { status, reason: 'sleep' }, work: 'woodcutter' })
    unit.setTextures = sheet => {
      unit.currentSheet = sheet
    }
    syncUnitSittingPose(unit)
    assert.equal(unit.currentSheet, 'sittingSheet')
    unit.context.dayNight.state.hour = 8
    syncUnitSittingPose(unit)
    assert.equal(unit.currentSheet, 'standingSheet')
    assert.equal(unit.work, 'woodcutter')
    assert.equal(unit.shelterState.status, status)
  }
})

test('new destinations and queued orders immediately stand a resting villager up', () => {
  const { setUnitDestination, queueUnitPendingOrder } = loadTsModule('app/classes/unit/UnitOrders.ts')
  const destination = { i: 1, j: 2, x: 32, y: 64 }
  for (const order of [
    unit => setUnitDestination(unit, destination),
    unit => queueUnitPendingOrder(unit, destination, 'gather'),
    unit => queueUnitPendingOrder(unit, () => {}),
  ]) {
    const unit = villager(12, { currentSheet: 'sittingSheet' })
    unit.setTextures = sheet => {
      unit.currentSheet = sheet
    }
    order(unit)
    assert.equal(unit.currentSheet, 'standingSheet')
    assert.ok(unit.dest || unit.pendingOrder)
  }
})

test('conversation, danger and bedtime end the sitting pose; a finished conversation restores it', () => {
  const unit = villager(19, { shelterState: { status: 'inside', reason: 'sleep' } })
  unit.setTextures = sheet => {
    unit.currentSheet = sheet
  }
  syncUnitSittingPose(unit)
  assert.equal(unit.currentSheet, 'sittingSheet')
  unit.lookingAtHero = true
  syncUnitSittingPose(unit)
  assert.equal(unit.currentSheet, 'standingSheet')
  unit.lookingAtHero = false
  syncUnitSittingPose(unit)
  assert.equal(unit.currentSheet, 'sittingSheet')
  unit.restWakeLockUntilMs = 200
  syncUnitSittingPose(unit)
  assert.equal(unit.currentSheet, 'standingSheet')
  unit.restWakeLockUntilMs = 0
  unit.context.dayNight.state.hour = 22
  syncUnitSittingPose(unit)
  assert.equal(unit.currentSheet, 'standingSheet')
})

test('sitting frames are registered from the merged villager atlas without requiring a separate file', async () => {
  const cache = new Map()
  const root = 'units/villager/hellas/male'
  const textures = Object.fromEntries(
    Array.from({ length: 4 }, (_, i) => [
      `00${i}_graphics_units_villager_hellas_male_body_sitting.png`,
      { direction: i },
    ])
  )
  cache.set(root, { data: { frames: {} }, textures })
  const { loadBakedUnitVariant } = loadTsModule('app/lib/lpc/bakedAliasCache.ts', {
    mocks: {
      'pixi.js': { Assets: { cache, load: () => assert.fail('The merged atlas is already loaded') } },
      './equipment': { dynamicEquipmentAliases: () => [] },
    },
  })
  await loadBakedUnitVariant('villager', 'hellas/male')
  const sheet = cache.get(`${root}/body/sitting`)
  assert.equal(Object.keys(sheet.textures).length, 4)
  assert.equal(sheet.data.animationSpeed, 0)
})

test('rest reconciliation does not initialize a sprite that is not ready', () => {
  const unit = villager(6, { currentSheet: undefined, setTextures: () => assert.fail('Sprite not ready') })
  syncUnitSittingPose(unit)
})

test('sitting remains frozen in each real direction, including east, and walking resumes normally', () => {
  const { setUnitTexture } = loadTsModule('app/lib/entities/spriteTextures.ts')
  const sprite = {
    currentFrame: 0,
    textures: [{}],
    scale: { x: 1, y: 1 },
    anchor: { set() {} },
    stop() {
      this.playing = false
    },
    play() {
      this.playing = true
    },
  }
  const sitting = {
    data: { animationSpeed: 0 },
    textures: { '000.png': 'north', '001.png': 'west', '002.png': 'south', '003.png': 'east' },
  }
  const unit = { context: {}, sprite, degree: 0, sittingSheet: sitting, sheetDirectionCounts: { sittingSheet: 4 } }
  const seen = new Set()
  for (const degree of [0, 90, 180, 270]) {
    unit.degree = degree
    setUnitTexture('sittingSheet', unit)
    assert.equal(sprite.playing, false)
    assert.equal(sprite.textures.length, 1)
    assert.equal(sprite.scale.x, 1)
    seen.add(sprite.textures[0])
  }
  assert.deepEqual([...seen].sort(), ['east', 'north', 'south', 'west'])
  unit.walkingSheet = { data: { animationSpeed: 0.2 }, textures: { '000.png': 'step' } }
  setUnitTexture('walkingSheet', unit)
  assert.equal(sprite.playing, true)
})

test('chiefs and promoted villagers sit during all three breaks inside their town center', () => {
  for (const type of ['Chief', 'Villager']) {
    for (const hour of [6, 12, 19]) {
      const chief = villager(hour, { type, isChief: true, shelterState: { status: 'inside', reason: 'sleep' } })
      assert.equal(getUnitRestVisualSheet(chief, 'standingSheet'), 'sittingSheet')
    }
  }
})

test('infantry and archers sit during the three daily pauses', () => {
  for (const type of ['Fantassin', 'Bowman'])
    for (const hour of [6, 12, 19])
      assert.equal(getUnitRestVisualSheet(villager(hour, { type }), 'standingSheet'), 'sittingSheet')
})
