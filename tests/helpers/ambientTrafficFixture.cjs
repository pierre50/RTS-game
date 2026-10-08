const { loadTsModule } = require('./loadTsModule.cjs')
function fixture(count = 1) {
  const moduleCache = new Map()
  const state = loadTsModule('app/services/travel/ambient/AmbientTrafficState.ts', { moduleCache })
  const owner = { label: 'ai', type: 'AI', civ: 'Hellas', units: [], population: 20, buildings: [] }
  const grid = Array.from({ length: 501 }, (_, i) => Array.from({ length: 30 }, (_, j) => ({ i, j, solid: false })))
  const created = []
  const context = {
    map: { grid, removeFromInstanceBucket() {} },
    players: [owner],
    controls: { heroUnit: { i: 0, j: 10 } },
    scheduler: { elapsedMs: 0, add: () => 1, remove() {} },
  }
  owner.buildings.push({ i: 0, j: 10, label: 'a', isBuilt: true }, { i: 400, j: 10, label: 'b', isBuilt: true })
  owner.createUnit = options => {
    const actor = {
      ...options,
      owner,
      name: options.name ?? 'Alexios',
      hitPoints: options.hitPoints ?? 20,
      inventory: options.inventory,
      stop() {
        this.path = []
        this.action = null
      },
      stopInterval() {},
      stopTimeout() {},
      clear() {
        this.isDestroyed = true
      },
      sendToEvt(cell) {
        this.path = [cell]
        this.dest = cell
      },
    }
    grid[actor.i][actor.j].solid = true
    grid[actor.i][actor.j].has = actor
    owner.units.push(actor)
    created.push(actor)
    return actor
  }
  const groups = state.ambientTrafficState(context.map).groups
  for (let n = 0; n < count; n++)
    groups.push({
      id: `g${n}`,
      kind: 'villagers',
      owner: 'ai',
      from: { i: 0, j: 10, label: 'a', owner: 'ai' },
      to: { i: 400, j: 10, label: 'b', owner: 'ai' },
      route: Array.from({ length: 401 }, (_, i) => ({ i, j: 10 })),
      progress: 70 + n,
      reverse: false,
      pauseMs: 0,
      members: [0, 1].map(member => ({ label: `g${n}:${member}`, type: 'Villager', i: 0, j: 10 })),
    })
  let camera = false
  const { AmbientTrafficSystem } = loadTsModule('app/services/travel/ambient/AmbientTrafficSystem.ts', {
    moduleCache,
    mocks: {
      './AmbientTrafficRoutes': { *buildTrafficRoutes() {} },
      '../../world/AmbientActivityArea': { ambientActivityArea: () => () => camera },
      '../../../lib/mapSpaces': { getEntitySpaceId: entity => entity.spaceId ?? 'outside' },
      '../../../lib/grid/visibility': { updateInstanceVisibility() {} },
      '../../../lib/camps/campRespawnState': { campRespawnStates: () => context.camps ?? [] },
      '../../world/distantVillages/DeferredVillageStore': { deferredVillageBuildings: () => undefined },
      '../../patrol/CampLeashController': {
        CampLeashController: class {
          update() {
            return false
          }
        },
      },
      '../../../serialization/entity/EntitySaveData': {
        unitData: actor =>
          Object.fromEntries(
            ['label', 'type', 'name', 'i', 'j', 'hitPoints', 'isDead', 'isDestroyed', 'inventory']
              .filter(key => actor[key] !== undefined)
              .map(key => [key, structuredClone(actor[key])])
          ),
      },
    },
  })
  const service = new AmbientTrafficSystem(context)
  return {
    state,
    context,
    owner,
    groups,
    created,
    service,
    show(value = true) {
      camera = value
    },
    tick(ms = 1000) {
      context.scheduler.elapsedMs += ms
      service.update()
    },
  }
}

module.exports = { fixture }
