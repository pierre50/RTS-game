const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { applyVillageStartingState } = loadTsModule('app/services/world/VillageStartingState.ts')
const { placeInitialVillageUnits } = loadTsModule('app/services/world/InitialVillagePlacement.ts')
const { populateVillageBase } = loadTsModule('app/services/world/VillageBaseState.ts')
const { OfflineWorldSpatial } = loadTsModule('app/services/world/OfflineWorldSpatial.ts')
const { tutorialVillageConfig } = loadTsModule('app/services/tutorial/TutorialVillage.ts')
const { decodePreparedTerrain } = loadTsModule('app/serialization/PreparedTerrainCodec.ts')
const buildings = require('../public/assets/data/gameplay/buildings.json')
const units = require('../public/assets/data/gameplay/units.json')
const rules = {
  buildingConfig: (_i, type) => buildings[type] ?? {},
  unitConfig: (_i, type) => units[type] ?? {},
  buildingCapacity: (_i, type) => buildings[type]?.shelterCapacity ?? buildings[type]?.increasePopulation ?? 0,
  wheatMatureFrame: 3,
}
const dir = path.join(__dirname, '../public/maps/worlds/world-4242/maps')
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.map'))) {
  const blueprint = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
  for (const settlement of blueprint.settlements ?? []) {
    if (!settlement.civ || !settlement.local) continue
    test(`full tutorial village fits shipped ${settlement.civ} map`, () => {
      const width = blueprint.size + 1
      const types = Buffer.from(blueprint.terrain, 'base64')
      const relief = Buffer.from(blueprint.relief, 'base64')
      const terrain = Array.from({ length: width }, (_, i) =>
        Array.from({ length: width }, (_, j) => ({
          category: types[i * width + j] === 2 ? 'Water' : 'Land',
          terrainHidden: types[i * width + j] === 6,
          z: relief.readInt8(i * width + j),
        }))
      )
      for (const entry of decodePreparedTerrain(
        Buffer.from(blueprint.terrainAppearanceData, 'base64'),
        blueprint.size
      )) {
        Object.assign(terrain[entry.i][entry.j], { waterBorder: Boolean(entry.water), inclined: Boolean(entry.relief) })
      }
      const player = {
        label: 'human',
        civ: settlement.civ,
        type: 'Human',
        factionId: 'tutorial',
        isPlayed: true,
        units: [],
        buildings: [],
      }
      const state = {
        players: [player],
        resources: structuredClone(blueprint.resources),
        animals: structuredClone(blueprint.animals ?? []),
      }
      const spatial = new OfflineWorldSpatial(terrain, state, b => buildings[b.type]?.size ?? 2)
      populateVillageBase(player, 0, settlement.local, spatial, rules, { wood: 200, wheat: 200 }, { workers: 6 })
      const config = tutorialVillageConfig({ players: [{ civ: settlement.civ, isHuman: true }] })
      const generated = applyVillageStartingState(state, config.villageStarts, terrain, rules)
      placeInitialVillageUnits(generated, new Set(['tutorial']), terrain, rules, { includePlayed: true })
      for (const [type, count] of Object.entries(config.villageStarts[settlement.civ].buildings)) {
        assert.ok(generated.players[0].buildings.filter(b => b.type === type).length >= count, type)
      }
      assert.equal(
        generated.resources.filter(r => r.type === 'Wheat').length,
        state.resources.filter(r => r.type === 'Wheat').length + 80
      )
      const beforeTotals = state.resources.reduce((totals, r) => {
        totals[r.type] = (totals[r.type] ?? 0) + (r.quantity ?? 0)
        return totals
      }, {})
      const afterTotals = generated.resources
        .filter(r => !r.label?.startsWith('start:'))
        .reduce((totals, r) => {
          totals[r.type] = (totals[r.type] ?? 0) + (r.quantity ?? 0)
          return totals
        }, {})
      assert.deepEqual(afterTotals, beforeTotals)
      const occupied = new Set(generated.resources.map(r => `${r.i}:${r.j}`))
      const placed = generated.players[0].buildings
      const center = placed.find(b => b.type === 'TownCenter')
      const distance = (a, b) => Math.hypot(a.i - b.i, a.j - b.j)
      const fields = generated.resources.filter(r => r.type === 'Wheat' && r.label?.startsWith('start:'))
      for (const granary of placed.filter(b => b.type === 'Granary')) {
        assert.ok(Math.min(...fields.map(field => distance(granary, field))) <= 7, 'granary must serve the fields')
      }
      const storage = placed.find(b => b.type === 'StoragePit')
      const deposits = generated.resources.filter(r => ['Tree', 'Stone', 'Gold', 'Copper', 'Iron'].includes(r.type))
      assert.ok(deposits.filter(r => distance(storage, r) <= 10).length >= 3, 'storage must serve a resource cluster')
      assert.ok(
        placed.filter(b => b.type === 'WatchTower').every(tower => distance(tower, center) >= 10),
        'towers belong on the perimeter'
      )
      if (process.env.VILLAGE_LAYOUT_OUTPUT)
        fs.writeFileSync(
          path.join(process.env.VILLAGE_LAYOUT_OUTPUT, `${settlement.civ}.json`),
          JSON.stringify({ center, buildings: placed, resources: generated.resources })
        )

      for (const building of placed) {
        const size = building.size ?? buildings[building.type].size
        const before = Math.floor((size - 1) / 2),
          after = size - before - 1
        assert.ok(Math.max(Math.abs(building.i - center.i), Math.abs(building.j - center.j)) <= 24)
        for (let i = building.i - before; i <= building.i + after; i++)
          for (let j = building.j - before; j <= building.j + after; j++) {
            assert.equal(occupied.has(`${i}:${j}`), false, `${building.type} overlaps at ${i}:${j}`)
            occupied.add(`${i}:${j}`)
          }
      }
      for (const unit of generated.players[0].units) {
        assert.equal(occupied.has(`${unit.i}:${unit.j}`), false, `${unit.type} spawn is blocked`)
        occupied.add(`${unit.i}:${unit.j}`)
      }
      for (const unit of generated.players[0].units) occupied.delete(`${unit.i}:${unit.j}`)
      const walkable = (i, j) =>
        terrain[i]?.[j] &&
        terrain[i][j].category !== 'Water' &&
        !terrain[i][j].terrainHidden &&
        !occupied.has(`${i}:${j}`)
      const free = []
      for (let i = 0; i < width; i++) for (let j = 0; j < width; j++) if (walkable(i, j)) free.push({ i, j })
      free.sort((a, b) => Math.hypot(a.i - center.i, a.j - center.j) - Math.hypot(b.i - center.i, b.j - center.j))
      const queue = [free[0]],
        visited = new Set([`${free[0].i}:${free[0].j}`])
      for (const point of queue)
        for (const [di, dj] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const i = point.i + di,
            j = point.j + dj,
            key = `${i}:${j}`
          if (walkable(i, j) && !visited.has(key)) {
            visited.add(key)
            queue.push({ i, j })
          }
        }
      for (const building of placed) {
        const size = building.size ?? buildings[building.type].size,
          before = Math.floor((size - 1) / 2),
          after = size - before - 1
        assert.ok(
          queue.some(
            p =>
              p.i >= building.i - before - 1 &&
              p.i <= building.i + after + 1 &&
              p.j >= building.j - before - 1 &&
              p.j <= building.j + after + 1
          ),
          `${building.type} disconnected`
        )
      }
    })
  }
}
