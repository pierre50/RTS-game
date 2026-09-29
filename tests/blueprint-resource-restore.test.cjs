const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const moduleCache = new Map()
const { CompactResourceSet } = loadTsModule('app/classes/resources/CompactResourceSet.ts', { moduleCache })
const { resourceData } = loadTsModule('app/serialization/ResourceSaveData.ts', { moduleCache })
const { partitionSave, assembleSave } = loadTsModule('app/serialization/ZonedSaveFormat.ts', { moduleCache })

for (const asynchronous of [false, true])
  for (const offline of [false, true])
    test(`delta save restores packed resources and collisions (offline=${offline}, async=${asynchronous})`, async () => {
      const collection = () => {
        const value = new CompactResourceSet(
          4,
          10,
          'blueprint',
          () => ({ totalQuantity: 100 }),
          state => ({ ...state }),
          {}
        )
        value.addState({ i: 1, j: 1, type: 'Tree', textureName: 'tree_0' })
        value.addState({ i: 2, j: 2, type: 'Tree', textureName: 'tree_0' })
        value.addState({ i: 3, j: 3, type: 'Tree', textureName: 'tree_0' })
        value.sealBlueprintBaseline()
        return value
      }
      const original = collection()
      original.atCell(11).quantity = 5
      original.delete(original.atCell(22))
      const source = {
        ...original.saveDelta(resourceData),
        players: [],
        animals: [],
        camera: { x: 0, y: 0 },
        runtime: offline ? { offlineFromElapsedMs: 0, dayNightElapsedMs: 20 } : {},
      }
      const split = partitionSave(source)
      const saved = assembleSave(split.metadata, split.collections, [...split.zones.values()])
      const restored = collection()
      const packed = { flags: new Uint8Array(100), extras: new Map([[33, { has: null }]]), changedCells: () => [] }
      const map = {
        resources: restored,
        grid: [],
        children: [],
        context: { players: [], app: {}, gamebox: {}, scheduler: {} },
      }
      map.context.map = map
      let simulated = false
      class Gaia {
        constructor() {
          this.animals = []
        }
      }
      const { applySavedStateToGeneratedMap, applySavedStateToGeneratedMapAsync } = loadTsModule(
        'app/classes/map/generation/MapSavedStateGeneration.ts',
        {
          moduleCache: new Map(moduleCache),
          mocks: {
            '../../cell/PackedCellRegistry': { getPackedCellStore: () => packed },
            '../../Resource': {},
            '../../ResourceTexture': {},
            '../../cell': {},
            '../../players': { Gaia, AI: class {} },
            '../../../lib': { getGaiaAnimals: gaia => gaia.animals },
            '../MapSaveRestore': { restoreCaveOccupants() {}, restorePlayerInteriors() {} },
            '../../../services/UnitPerception': {},
            './MapOfflineWorldSimulation': {
              applyOfflineWorldSimulation(_map, data) {
                if (!offline) return
                simulated = true
                assert.equal(data.resources.length, 2, 'offline work receives full intact and changed resources')
                data.resources[0].quantity = 2
              },
            },
          },
        }
      )
      if (asynchronous) {
        const progress = []
        await applySavedStateToGeneratedMapAsync(map, saved, async (label, value) => {
          assert.notEqual(map.ready, true)
          progress.push([label, value])
        })
        assert.ok(progress.some(([label]) => label === 'restoringEntities'))
        for (let i = 1; i < progress.length; i++) assert.ok(progress[i][1] >= progress[i - 1][1])
      } else applySavedStateToGeneratedMap(map, saved)
      assert.equal(simulated, offline)
      assert.equal(map.ready, true)
      assert.equal(map.resources, restored)
      assert.equal(packed.resourceAt(11).quantity, offline ? 2 : 5)
      assert.equal(packed.resourceAt(22), null)
      assert.equal(packed.flags[22] & 1, 0)
      assert.equal(packed.flags[33] & 1, 1)
      assert.equal(Object.hasOwn(packed.extras.get(33), 'has'), false)
      assert.equal(restored.saveDelta(resourceData).resourceDelta.updated.length, 1)
    })
