const { loadTsModule } = require('./loadTsModule.cjs')
const math = {
  cellIsDiag: (a, b) => a.i !== b.i && a.j !== b.j,
  instancesDistance: (a, b) => Math.hypot(a.i - b.i, a.j - b.j),
}
const cells = {
  getSquareCellsAroundPoint(i, j, grid, radius, callback) {
    const result = []
    for (let a = i - radius; a <= i + radius; a++)
      for (let b = j - radius; b <= j + radius; b++) {
        const cell = grid[a]?.[b]
        if (cell && (a !== i || b !== j) && callback(cell)) result.push(cell)
      }
    return result
  },
}
const planner = loadTsModule('app/services/travel/RoadRoute.ts', {
  mocks: { '../lib/maths': math, '../lib/grid/cells': cells },
})
function roadMap(length = 1000) {
  const grid = Array.from({ length: length + 1 }, (_, i) =>
    Array.from({ length: 25 }, (_, j) => ({ i, j, solid: false }))
  )
  return {
    grid,
    size: length,
    roads: {
      version: 1,
      stride: length + 1,
      cells: Array.from({ length: length + 1 }, (_, i) => [i * (length + 1) + 10, (i < length ? 2 : 0) | (i ? 8 : 0)]),
    },
  }
}
function fixture({ length = 100, realPlanner = false } = {}) {
  const cache = new Map(),
    suspended = new WeakMap(),
    moves = [],
    messages = []
  let visible = false
  const map = roadMap(length)
  const owner = { isPlayed: true, units: [], buildings: [], isEnemy: other => other.type === 'Bandits' }
  const town = { type: 'TownCenter', label: 'destination', i: length, j: 10, owner, isBuilt: true }
  owner.buildings.push(town)
  const context = {
    map,
    players: [owner],
    controls: {},
    scheduler: { elapsedMs: 0, add: () => 1, remove() {} },
    menu: { showMessage: text => messages.push(text) },
  }
  const unit = {
    type: 'Villager',
    label: 'worker',
    i: 0,
    j: 10,
    speed: 2,
    owner,
    context,
    inventory: { resources: { tin: 12 } },
    path: [],
    sprite: { stop() {} },
    stop() {
      this.path = []
      this.dest = null
      this.action = null
    },
    stopInterval() {},
    sendToEvt(target) {
      this.dest = target
      this.path = [target]
      moves.push(target)
    },
  }
  owner.units.push(unit)
  const mocks = {
    '../../lib/mapSpaces': {
      getEntitySpaceId: entity => entity.spaceId ?? 'outside',
      ensureOutsideMapSpace: () => ({}),
      moveEntityToMapSpace: (_map, actor, _space, cell) => {
        actor.i = cell.i
        actor.j = cell.j
      },
    },
    '../../lib/units/unitSuspension': {
      setUnitSuspension: (actor, value) => (value ? suspended.set(actor, value) : suspended.delete(actor)),
      unitSuspensionReason: actor => suspended.get(actor)?.reason,
      wakeUnitSimulation: actor => suspended.get(actor)?.wake(),
    },
    '../../lib/units/unitEnergy': { getEnergyMoveSpeedMultiplier: () => 1 },
    '../../lib/grid/visibility': { updateInstanceVisibility() {} },
    '../world/AmbientActivityArea': { ambientActivityArea: () => point => visible && point.i >= 20 },
    '../world/distantVillages/DeferredVillageStore': { deferredVillageBuildings: () => undefined },
    '../../lib/lang': { t: key => key },
    './RoadRoute': {
      *planRoadRoute(actor) {
        yield
        return Array.from({ length: 99 - actor.i }, (_, n) => ({ i: actor.i + n + 1, j: 10 }))
      },
    },
    '../Pathfinding': {},
  }
  if (realPlanner) mocks['./RoadRoute'] = planner
  const { RoadTravelSystem } = loadTsModule('app/services/travel/RoadTravelSystem.ts', { mocks, moduleCache: cache })
  const api = loadTsModule('app/lib/units/roadJourney.ts', { moduleCache: cache })
  const system = new RoadTravelSystem(context)
  const tick = (ms = 500) => {
    context.scheduler.elapsedMs += ms
    system.update()
  }
  return {
    cache,
    mocks,
    context,
    unit,
    town,
    owner,
    system,
    tick,
    api,
    moves,
    messages,
    suspended,
    show: () => {
      visible = true
    },
  }
}

module.exports = { fixture, roadMap, planner }
