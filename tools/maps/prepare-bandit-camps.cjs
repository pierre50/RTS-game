const { loadGenerationTs } = require('./load-generation-ts.cjs')
const { createSeededRandom } = loadGenerationTs('app/lib/random.ts')
const { getPlainCellsAroundPoint } = loadGenerationTs('app/lib/grid/cells.ts')
const { placeBanditCampFires, placeCampDecorations, placeBanditCampChest, createBanditCampChestInventory } =
  loadGenerationTs('app/classes/map/generation/BanditCampStructures.ts')

function prepareBanditCamps(source, grid, state, buildings, units) {
  const camps = []
  for (const entity of [...state.resources, ...state.animals]) {
    const cell = grid[entity.i]?.[entity.j]
    if (cell) {
      cell.has = entity
      cell.solid = true
    }
  }
  for (const [index, position] of (source.banditCampPositions ?? []).entries()) {
    const id = position.id ?? `${source.id}:camp-${index}`
    const random = createSeededRandom(position.seed ?? `${source.seed}:${id}`)
    const map = {
      grid,
      randomRange: (min, max) => min + Math.floor(random() * (max - min + 1)),
      randomItem: items => items[Math.floor(random() * items.length)],
    }
    const owner = {
      label: id,
      type: 'Bandits',
      units: [],
      buildings: [],
      config: { buildings },
      createBuilding(options) {
        const config = buildings[options.type]
        const entity = {
          ...options,
          label: `${id}:building-${this.buildings.length}`,
          size: config.size,
          hitPoints: config.totalHitPoints,
          totalHitPoints: config.totalHitPoints,
        }
        this.buildings.push(entity)
        const cell = grid[entity.i][entity.j]
        cell.has = entity
        cell.solid = true
        return entity
      },
    }
    const anchor = grid[position.i]?.[position.j]
    if (!anchor) throw new Error(`${id}: invalid camp anchor`)
    if (position.caveId && !(source.caves ?? []).some(cave => cave.id === position.caveId))
      throw new Error(`${id}: missing cave ${position.caveId}`)
    const roster = position.unitTypes ?? ['BanditChief', 'BanditSword', 'BanditArcher']
    if (!roster.length || roster.some(type => !units[type])) throw new Error(`${id}: invalid bandit roster`)
    const fires = placeBanditCampFires(map, owner, anchor, 1)
    if (fires.length !== 1) throw new Error(`${id}: no space for campfire`)
    let caveContent
    if (position.caveId)
      caveContent = { caveId: position.caveId, inventory: createBanditCampChestInventory(map, roster.length, 0) }
    else {
      placeCampDecorations(map, owner, anchor, roster.length, 0)
      placeBanditCampChest(map, owner, anchor, index, roster.length, 0)
      if (!owner.buildings.some(building => building.type === 'Chest'))
        throw new Error(`${id}: no space for loot chest`)
    }
    for (const [n, type] of roster.entries()) {
      const candidates = []
      for (let radius = 2; radius <= 5; radius++)
        candidates.push(
          ...getPlainCellsAroundPoint(
            anchor.i,
            anchor.j,
            grid,
            radius,
            cell => !cell.solid && !cell.has && !cell.border && !cell.waterBorder && cell.category !== 'Water'
          )
        )
      const cell = map.randomItem(candidates)
      if (!cell) throw new Error(`${id}: no space for bandit ${n}`)
      const entity = {
        label: `${id}:unit-${n}`,
        type,
        i: cell.i,
        j: cell.j,
        gender: 'male',
        inactif: true,
        hitPoints: units[type].totalHitPoints,
        totalHitPoints: units[type].totalHitPoints,
        campPatrolAnchor: { i: anchor.i, j: anchor.j },
        banditCampAnchor: { i: anchor.i, j: anchor.j },
        campBehavior: {
          phase: 'guard',
          homeSpaceId: 'outside',
          ...(position.caveId ? { caveId: position.caveId } : {}),
        },
      }
      owner.units.push(entity)
      cell.has = entity
      cell.solid = true
    }
    delete owner.config
    delete owner.createBuilding
    owner.population = owner.units.length
    state.players.push(owner)
    camps.push({ ...position, id, ownerLabel: id, unitTypes: [...roster], ...(caveContent ? { caveContent } : {}) })
  }
  return camps
}
module.exports = { prepareBanditCamps }
