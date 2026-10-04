const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const {
  constructionProgressPercentage,
  initializeConstructionProgress,
  applyConstructionWork,
  advanceMaterialConstruction,
  createConstructionMaterials,
  constructionWorkPoints,
  constructionWorkTotal,
} = loadTsModule('app/lib/economy/constructionMaterials.ts')
const { advanceConstruction } = loadTsModule('app/lib/economy/workRules.ts')

test('work rate and material costs are independent of health, even for fragile long builds', () => {
  for (const health of [2, 20, 10000]) {
    const site = {
      hitPoints: health,
      totalHitPoints: health,
      constructionProgress: 0,
      constructionWorkRequired: 2000,
      constructionMaterials: createConstructionMaterials({ wood: 100 }),
    }
    const bag = { wood: 100 }
    for (let impact = 0; impact < 1000; impact++) {
      const next = advanceConstruction(constructionWorkPoints(site), constructionWorkTotal(site))
      applyConstructionWork(site, advanceMaterialConstruction(site, next, [bag]))
    }
    assert.equal(site.constructionProgress, 0.5)
    assert.equal(site.hitPoints, health)
    assert.equal(bag.wood, 50)
  }
})

test('renovations need no health fields to progress or consume materials', () => {
  const site = {
    hitPoints: 12,
    totalHitPoints: 20,
    isBuilt: true,
    buildingUpgrade: { targetLevel: 1, constructionTime: 10, constructionProgress: 0 },
    constructionMaterials: createConstructionMaterials({ stone: 10 }),
  }
  const bag = { stone: 10 }
  applyConstructionWork(site, advanceMaterialConstruction(site, 5, [bag]))
  assert.equal(site.buildingUpgrade.constructionProgress, 0.5)
  assert.equal(site.hitPoints, 12)
  assert.equal(bag.stone, 5)
})

test('legacy progression excludes the former initial hit point', () => {
  for (const totalHitPoints of [2, 20, 101, 300]) {
    assert.equal(constructionProgressPercentage({ hitPoints: 1, totalHitPoints }), 0)
    assert.equal(constructionProgressPercentage({ hitPoints: 1 + (totalHitPoints - 1) / 2, totalHitPoints }), 50)
    assert.equal(constructionProgressPercentage({ hitPoints: totalHitPoints, totalHitPoints }), 100)
  }
})

test('new construction starts at zero even with full health and survives damage and reload', () => {
  let site = { hitPoints: 20, totalHitPoints: 20, constructionProgress: 0, constructionWorkRequired: 20 }
  assert.equal(constructionProgressPercentage(site), 0)
  applyConstructionWork(site, 10)
  assert.equal(constructionProgressPercentage(site), 50)
  assert.equal(site.hitPoints, 20)
  site.hitPoints -= 5
  site = JSON.parse(JSON.stringify(site))
  initializeConstructionProgress(site)
  assert.equal(constructionProgressPercentage(site), 50)
  applyConstructionWork(site, 20)
  assert.equal(constructionProgressPercentage(site), 100)
  assert.equal(site.hitPoints, 15)
})

test('legacy migration is done once and preserves work, health and materials', () => {
  const site = {
    hitPoints: 51,
    totalHitPoints: 101,
    constructionTime: 101,
    constructionMaterials: createConstructionMaterials({ wood: 10 }),
  }
  site.constructionMaterials.consumed.wood = 5
  initializeConstructionProgress(site)
  assert.equal(site.constructionProgress, 0.5)
  site.hitPoints -= 20
  initializeConstructionProgress(site)
  assert.equal(site.constructionProgress, 0.5)
  const bag = { wood: 5 }
  applyConstructionWork(site, advanceMaterialConstruction(site, 101, [bag]))
  assert.equal(site.constructionProgress, 1)
  assert.equal(site.hitPoints, 81)
  assert.equal(bag.wood, 0)
  assert.equal(site.constructionMaterials.consumed.wood, 10)
})

test('construction cannot resurrect destroyed sites or repair completed buildings', () => {
  const site = { hitPoints: 0, totalHitPoints: 20, constructionProgress: 0.5 }
  applyConstructionWork(site, 20)
  assert.equal(site.hitPoints, 0)
  assert.equal(site.constructionProgress, 0.5)
  const built = { hitPoints: 10, totalHitPoints: 20, isBuilt: true, constructionProgress: 1 }
  applyConstructionWork(built, 15)
  assert.equal(built.hitPoints, 10)
  assert.equal(built.constructionProgress, 1)
})

test('legacy renovations migrate to independent progress without changing health', () => {
  const site = {
    hitPoints: 60,
    totalHitPoints: 100,
    isBuilt: true,
    buildingUpgrade: { hitPoints: 51, totalHitPoints: 101 },
  }
  initializeConstructionProgress(site)
  assert.equal(site.buildingUpgrade.constructionProgress, 0.5)
  assert.equal(site.buildingUpgrade.hitPoints, undefined)
  assert.equal(site.hitPoints, 60)
})

test('legacy migration waits for configured health capacity when the save omits it', () => {
  const site = { hitPoints: 51, isBuilt: false, constructionTime: 40 }
  initializeConstructionProgress(site)
  assert.equal(site.constructionProgress, undefined)
  assert.equal(site.constructionWorkRequired, undefined)
  site.totalHitPoints = 101
  initializeConstructionProgress(site)
  assert.equal(site.constructionProgress, 0.5)
  assert.equal(site.constructionWorkRequired, 40)
  assert.equal(site.hitPoints, 101)
})

test('live completion follows construction progress, independently of full or damaged health', () => {
  const shown = []
  const { BuildingLifecycle } = loadTsModule('app/classes/building/BuildingLifecycle.ts', {
    mocks: {
      'pixi.js': { AnimatedSprite: class {} },
      '../../lib': { getPercentage: (hp, total) => (hp * 100) / total, updateInstanceVisibility() {} },
      './BuildingSowing': {},
      './BuildingDestruction': {},
      './BuildingFinalTexture': {},
      './BuildingFire': {},
      './BuildingVisuals': {
        clearBuildingConstructionReveal() {},
        syncBuildingConstructionReveal: (_site, percentage) => shown.push(percentage),
      },
    },
  })
  let completed = 0
  const site = {
    type: 'House',
    hitPoints: 101,
    totalHitPoints: 101,
    constructionProgress: 0,
    isBuilt: false,
    owner: { hasBuilt: [] },
    context: { menu: {} },
    finalTexture() {},
    onBuilt: () => completed++,
    updateShadow() {},
    scanForInitialTarget() {},
  }
  const lifecycle = new BuildingLifecycle(site)
  lifecycle.updateTexture()
  assert.equal(site.isBuilt, false)
  assert.deepEqual(shown, [0])
  site.constructionProgress = 1
  site.hitPoints = 81
  lifecycle.updateTexture()
  lifecycle.updateTexture()
  assert.equal(site.isBuilt, true)
  assert.equal(site.hitPoints, 81)
  assert.equal(completed, 1)
})

test('distant village snapshots retain independent construction progress', () => {
  const { serializeEconomyPlayer } = loadTsModule('app/serialization/VillageEconomySnapshot.ts')
  const site = { type: 'House', hitPoints: 31, totalHitPoints: 101, constructionProgress: 0.5 }
  const snapshot = serializeEconomyPlayer({ units: [], buildings: [site] })
  assert.equal(snapshot.buildings[0].constructionProgress, 0.5)
  assert.equal(snapshot.buildings[0].hitPoints, 31)
})

test('renovation progress uses its own work points rather than building health', () => {
  assert.equal(
    constructionProgressPercentage({
      hitPoints: 100,
      totalHitPoints: 100,
      buildingUpgrade: { hitPoints: 1, totalHitPoints: 20 },
    }),
    0
  )
})
