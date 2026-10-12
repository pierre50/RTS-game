const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createLayoutStore } = require('../tools/interiors-preview/layout-store.cjs')
const { loadGenerationTs } = require('../tools/maps/load-generation-ts.cjs')
const model = loadGenerationTs('tools/interiors-preview/model.ts')
const { getBuildingInteriorDecorationLayout } = loadGenerationTs('app/lib/buildings/furniture/interiorDecorations.ts')
function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'interior-layout-test-'))
  const file = path.join(directory, 'positions.json')
  fs.writeFileSync(file, '{}\n')
  model.replacePositions({})
  t.after(() => {
    model.replacePositions({})
    fs.rmSync(directory, { recursive: true, force: true })
  })
  return { file, store: createLayoutStore(file), scene: model.sceneFor('House', 0, false, true) }
}
test('editor positions persist by level and are consumed by game layouts in both orientations', t => {
  const { store, scene, file } = fixture(t)
  assert.equal(model.moveFurniture(scene, scene.furniture[0].label, 8, 9), null)
  const saved = store.save({
    revision: store.read().revision,
    type: 'House',
    level: 0,
    positions: model.authoredPositions(scene),
  })
  assert.deepEqual(createLayoutStore(file).read(), saved)
  const getFire = level =>
    getBuildingInteriorDecorationLayout({ type: 'House', buildingLevel: level }).find(
      item => item.key === 'firecamp-center'
    )
  assert.equal(getFire(0).offsetI, -1)
  assert.equal(getFire(1).offsetI, 0)
  for (const mirror of [false, true])
    assert.deepEqual(model.authoredPositions(model.sceneFor('House', 0, mirror, true)), saved.positions.House[0])
})
test('invalid placements, unknown keys and stale revisions cannot overwrite the saved file', t => {
  const { store, scene, file } = fixture(t)
  const original = fs.readFileSync(file, 'utf8'),
    revision = store.read().revision
  const payload = { revision, type: 'House', level: 0, positions: model.authoredPositions(scene) }
  for (const positions of [
    { ...payload.positions, 'firecamp-center': { offsetI: 20, offsetJ: 20 } },
    { ...payload.positions, 'firecamp-center': payload.positions['table-1'] },
    { ...payload.positions, unknown: { offsetI: 0, offsetJ: 0 } },
  ])
    assert.throws(() => store.save({ ...payload, positions }))
  assert.throws(
    () => store.save({ ...payload, revision: 'stale' }),
    error => error.status === 409
  )
  assert.equal(fs.readFileSync(file, 'utf8'), original)
})
test('dragging rejects outside, door and occupied cells without moving the item', t => {
  const { scene } = fixture(t),
    fire = scene.furniture[0],
    position = [fire.i, fire.j]
  const table = scene.furniture.find(item => item.type === 'CampTable'),
    door = scene.bp.exits[0]
  for (const [i, j] of [
    [0, 0],
    [table.i, table.j],
    [door.i, door.j],
  ]) {
    assert.equal(typeof model.moveFurniture(scene, fire.label, i, j), 'string')
    assert.deepEqual([fire.i, fire.j], position)
  }
  assert.equal(model.moveFurniture(scene, fire.label, 8, 9), null)
  assert.equal(model.moveFurniture(scene, fire.label, ...position), null)
})

test('full layouts add, remove and mirror catalogue furniture across save and reload', t => {
  const { store, scene, file } = fixture(t)
  const layout = model.authoredLayout(scene)
  const table = layout.items['table-1']
  delete layout.items['table-1']
  layout.items['custom-chair'] = { ...table, type: 'CampChair', mirrored: true }
  const edited = model.editFurniture(scene, layout)
  assert.equal(
    edited.furniture.some(item => item.type === 'CampTable'),
    false
  )
  const result = store.save({ revision: store.read().revision, type: 'House', level: 0, layout })
  assert.deepEqual(createLayoutStore(file).read(), result)
  for (const mirror of [false, true]) {
    const reloaded = model.sceneFor('House', 0, mirror, true)
    assert.deepEqual(model.authoredLayout(reloaded), layout)
    const chair = reloaded.furniture.find(item => item.type === 'CampChair')
    assert.equal(chair.placementMirrored, !mirror)
  }
  assert.equal(
    getBuildingInteriorDecorationLayout({ type: 'House', buildingLevel: 0 }).some(item => item.type === 'CampTable'),
    false
  )
  assert.equal(
    getBuildingInteriorDecorationLayout({ type: 'House', buildingLevel: 1 }).some(item => item.type === 'CampTable'),
    true
  )
  const undone = model.sceneWithLayout(edited, model.authoredLayout(scene))
  assert.deepEqual(model.authoredLayout(undone), model.authoredLayout(scene))
})

test('an empty layout remains empty and malformed catalogue entries cannot overwrite it', t => {
  const { store, file } = fixture(t)
  const layout = { items: {} }
  store.save({ revision: store.read().revision, type: 'House', level: 0, layout })
  assert.deepEqual(model.sceneFor('House', 0, false, true).furniture, [])
  const original = fs.readFileSync(file, 'utf8')
  for (const item of [
    { type: 'TownCenter', mirrored: false, offsetI: 0, offsetJ: 0 },
    { type: 'CampChair', mirrored: 'yes', offsetI: 0, offsetJ: 0 },
    { type: 'CampChair', mirrored: false, offsetI: 20, offsetJ: 20 },
  ])
    assert.throws(() =>
      store.save({ revision: store.read().revision, type: 'House', level: 0, layout: { items: { custom: item } } })
    )
  assert.equal(fs.readFileSync(file, 'utf8'), original)
})

test('adjacent furniture and wall placements save at their exact cells without an invisible margin', t => {
  const { store, scene } = fixture(t)
  const fire = scene.furniture.find(item => item.type === 'FireCamp')
  const table = scene.furniture.find(item => item.type === 'CampTable')
  // The fire is now directly beside the table; their actual footprints do not overlap.
  assert.equal(model.moveFurniture(scene, fire.label, table.i - 1, table.j), null)
  const layout = model.authoredLayout(scene)
  const saved = store.save({ revision: store.read().revision, type: 'House', level: 0, layout })
  for (const mirror of [false, true]) {
    assert.deepEqual(model.authoredLayout(model.sceneFor('House', 0, mirror, true)), layout)
  }
  // A one-cell decoration may touch a wall, including a border floor cell.
  const wallLayout = { items: { 'custom-chair': { type: 'CampChair', mirrored: false, offsetI: -4, offsetJ: 0 } } }
  const wallScene = model.editFurniture(scene, wallLayout)
  assert.equal(wallScene.grid[wallScene.furniture[0].i][wallScene.furniture[0].j].border, true)
  store.save({ revision: saved.revision, type: 'House', level: 0, layout: wallLayout })
  assert.deepEqual(model.authoredLayout(model.sceneFor('House', 0, false, true)), wallLayout)
})

test('a bed cannot overlap another item through its footprint or leave the room', t => {
  const { scene } = fixture(t)
  const bed = scene.furniture.find(item => item.type === 'CampBedroll')
  const fire = scene.furniture.find(item => item.type === 'FireCamp')
  const previous = model.authoredLayout(scene)
  assert.match(model.moveFurniture(scene, bed.label, fire.i + 1, fire.j + 1), /occupée/)
  assert.deepEqual(model.authoredLayout(scene), previous)
  assert.match(model.moveFurniture(scene, bed.label, 0, 0), /pièce/)
})

test('preset rugs move below furniture and persist deletion per level in both orientations', t => {
  const { store } = fixture(t)
  const scene = model.sceneFor('TownCenter', 0, false, true)
  const baseline = model.authoredLayout(scene)
  assert.equal(scene.rugs.length, 5)
  const fire = scene.furniture.find(item => item.type === 'FireCamp')
  assert.equal(model.moveEditable(scene, 'floor:0', fire.i, fire.j), null)
  assert.deepEqual(model.authoredLayout(scene).items, baseline.items)
  const layout = model.authoredLayout(scene)
  layout.rugs.splice(1, 1)
  const edited = model.editFurniture(scene, layout)
  store.save({ revision: store.read().revision, type: 'TownCenter', level: 0, layout: model.authoredLayout(edited) })
  const { getInteriorFloorDecorations } = loadGenerationTs('app/lib/buildings/furniture/interiorFloorDecorations.ts')
  assert.deepEqual(getInteriorFloorDecorations('TownCenter', 0), layout.rugs)
  assert.deepEqual(getInteriorFloorDecorations('TownCenter', 1), layout.rugs)
  for (const mirror of [false, true]) {
    const reloaded = model.sceneFor('TownCenter', 0, mirror, true)
    assert.deepEqual(model.authoredLayout(reloaded).rugs, layout.rugs)
    const rug = model.editableItems(reloaded).find(item => item.label === 'floor:0')
    assert.equal(rug.i, reloaded.center.i)
    assert.equal(rug.j, reloaded.center.j)
  }
  assert.deepEqual(model.authoredLayout(model.sceneWithLayout(edited, baseline)), baseline)
  const empty = { ...layout, rugs: [] }
  store.save({ revision: store.read().revision, type: 'TownCenter', level: 0, layout: empty })
  assert.deepEqual(model.sceneFor('TownCenter', 0, false, true).rugs, [])
})

test('rug edits reject missing floor and invalid sprites without changing saved layouts', t => {
  const { store, file } = fixture(t)
  const scene = model.sceneFor('Barracks', 0, true, true)
  const before = model.authoredLayout(scene)
  assert.match(model.moveEditable(scene, 'floor:0', 0, 0), /sol/)
  assert.deepEqual(model.authoredLayout(scene), before)
  const source = fs.readFileSync(file, 'utf8')
  for (const rug of [
    { frame: 999, offsetX: 0, offsetY: 0 },
    { frame: 18, offsetX: 1200, offsetY: 500 },
    { frame: 18, offsetX: null, offsetY: 0 },
  ])
    assert.throws(() =>
      store.save({ revision: store.read().revision, type: 'Barracks', level: 0, layout: { ...before, rugs: [rug] } })
    )
  assert.equal(fs.readFileSync(file, 'utf8'), source)
})

test('resizing a house preserves centered furniture and leaves other levels unchanged', t => {
  const { store, scene } = fixture(t)
  const before = model.authoredLayout(scene)
  const enlarged = model.sceneWithLayout(scene, { ...before, roomSize: 15 })
  assert.equal(enlarged.roomSize, 15)
  assert.deepEqual(model.authoredPositions(enlarged), model.authoredPositions(scene))
  assert.deepEqual(model.layoutIssues(enlarged), [])
  store.save({ revision: store.read().revision, type: 'House', level: 0, layout: model.authoredLayout(enlarged) })
  for (const level of [0, 1, 2]) {
    const loaded = model.sceneFor('House', level, false, true)
    assert.equal(loaded.roomSize, level === 0 ? 15 : 11)
    assert.equal(loaded.furniture.filter(item => item.type === 'CampBedroll').length, [1, 2, 4][level])
  }
  assert.equal(model.sceneFor('Barracks', 0, false, true).roomSize, 13)
})

test('reduced drafts retain out-of-room furniture, can be repaired and cannot save invalid layouts', t => {
  const { store, file } = fixture(t)
  const source = model.sceneFor('TownCenter', 0, false, true)
  const reduced = model.sceneWithLayout(source, { ...model.authoredLayout(source), roomSize: 7 })
  assert.equal(reduced.furniture.length, source.furniture.length)
  assert.ok(model.layoutIssues(reduced).length > 0)
  const original = fs.readFileSync(file, 'utf8')
  assert.throws(() =>
    store.save({ revision: store.read().revision, type: 'TownCenter', level: 0, layout: model.authoredLayout(reduced) })
  )
  assert.equal(fs.readFileSync(file, 'utf8'), original)
  const repaired = model.sceneWithLayout(reduced, { items: {}, rugs: [], roomSize: 7 })
  assert.deepEqual(model.layoutIssues(repaired), [])
  store.save({ revision: store.read().revision, type: 'TownCenter', level: 0, layout: model.authoredLayout(repaired) })
  assert.equal(model.sceneFor('TownCenter', 0, true, true).roomSize, 7)
  assert.deepEqual(
    model.authoredLayout(model.sceneWithLayout(reduced, model.authoredLayout(source))),
    model.authoredLayout(source)
  )
})

test('non-house levels all read and edit the level-one interior without deleting other stored layouts', t => {
  const { store, file } = fixture(t)
  for (const building of model.buildings.filter(building => building.type !== 'House')) {
    const layout = {
      roomSize: 11,
      rugs: [],
      items: { chair: { type: 'CampChair', mirrored: false, offsetI: 0, offsetJ: -1 } },
    }
    const level = building.levels.at(-1)
    store.save({ revision: store.read().revision, type: building.type, level, layout })
    const stored = JSON.parse(fs.readFileSync(file, 'utf8'))
    assert.deepEqual(stored[building.type][0], layout)
    assert.deepEqual(Object.keys(stored[building.type]), ['0'])
    for (const tier of building.levels)
      for (const mirror of [false, true]) {
        assert.deepEqual(model.authoredLayout(model.sceneFor(building.type, tier, mirror, true)), layout)
      }
  }
  const old = store.read().positions
  old.WatchTower[1] = { items: {}, roomSize: 19 }
  fs.writeFileSync(file, JSON.stringify(old))
  model.replacePositions(old)
  assert.equal(model.sceneFor('WatchTower', 1, false, true).roomSize, 11)
  const layout = model.authoredLayout(model.sceneFor('WatchTower', 1, false, true))
  store.save({ revision: store.read().revision, type: 'WatchTower', level: 1, layout })
  assert.deepEqual(store.read().positions.WatchTower[1], old.WatchTower[1])
})

test('a small level-one house saves without validating larger default furnishings of levels two and three', t => {
  const { store } = fixture(t)
  const small = { roomSize: 7, items: { bed: { type: 'CampBedroll', mirrored: false, offsetI: 0, offsetJ: -1 } } }
  store.save({ revision: store.read().revision, type: 'House', level: 0, layout: small })
  assert.deepEqual(Object.keys(store.read().positions.House), ['0'])
  assert.equal(model.sceneFor('House', 0, false, true).roomSize, 7)
  assert.equal(model.sceneFor('House', 1, false, true).roomSize, 11)
  assert.equal(model.sceneFor('House', 2, false, true).furniture.filter(item => item.type === 'CampBedroll').length, 4)
  store.save({ revision: store.read().revision, type: 'House', level: 1, layout: { roomSize: 13, items: {} } })
  assert.deepEqual(store.read().positions.House[0], small)
  assert.equal(model.sceneFor('House', 1, true, true).roomSize, 13)
  assert.equal(model.sceneFor('House', 0, true, true).roomSize, 7)
})
