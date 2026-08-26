const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadBuildingInteriors() {
  return loadTsModule('app/lib/buildings/interiors.ts', {
    mocks: {
      '../../constants': {
        BUILDING_TYPES: { townCenter: 'TownCenter' },
      },
      '../maths': {
        angleDelta(a, b) {
          const diff = Math.abs(a - b) % 360
          return diff > 180 ? 360 - diff : diff
        },
        getInstanceDegree(instance, x, y) {
          return Math.round((Math.atan2(y - instance.y, x - instance.x) * 180) / Math.PI + 180)
        },
      },
    },
  })
}

test('town center interior entry requires the hero to stand in the door zone', () => {
  const { findBuildingInteriorEntryTarget } = loadBuildingInteriors()
  const townCenter = {
    isBuilt: true,
    type: 'TownCenter',
    x: 100,
    y: 200,
  }
  const hero = {
    degree: 90,
    x: 100,
    y: 248,
  }

  assert.equal(findBuildingInteriorEntryTarget(hero, [townCenter]), townCenter)
  assert.equal(findBuildingInteriorEntryTarget({ ...hero, degree: 270 }, [townCenter]), null)
  assert.equal(findBuildingInteriorEntryTarget({ ...hero, x: 180 }, [townCenter]), null)
  assert.equal(
    findBuildingInteriorEntryTarget({ ...hero, degree: 270 }, [townCenter], { requireFacing: false }),
    townCenter
  )
})

test('town center interior entry ignores unfinished and non-town-center buildings', () => {
  const { findBuildingInteriorEntryTarget } = loadBuildingInteriors()
  const hero = { degree: 90, x: 100, y: 248 }

  assert.equal(findBuildingInteriorEntryTarget(hero, [{ isBuilt: false, type: 'TownCenter', x: 100, y: 200 }]), null)
  assert.equal(findBuildingInteriorEntryTarget(hero, [{ isBuilt: true, type: 'House', x: 100, y: 200 }]), null)
})
