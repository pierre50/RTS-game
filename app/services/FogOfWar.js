import { FAMILY_TYPES, PLAYER_TYPES, RESOURCE_TYPES } from '../constants'

function getPlainCellsAroundPoint(startX, startY, grid, dist = 0, callback) {
  const result = []

  if (dist === 0) {
    const row = grid[startX]
    if (row) {
      const cell = row[startY]
      if (cell && (!callback || callback(cell))) result.push(cell)
    }
    return result
  }

  const minX = Math.max(startX - dist, 0)
  const maxX = Math.min(startX + dist, grid.length - 1)

  for (let i = minX; i <= maxX; i++) {
    const row = grid[i]
    if (!row) continue
    const minY = Math.max(startY - dist, 0)
    const maxY = Math.min(startY + dist, row.length - 1)

    for (let j = minY; j <= maxY; j++) {
      const cell = row[j]
      if (cell && (!callback || callback(cell))) result.push(cell)
    }
  }

  return result
}

function updateAIKnowledge(globalCell, cell, viewer) {
  const owner = viewer

  if (globalCell.has && (!cell.has || cell.has.label !== globalCell.has.label)) {
    cell.has = globalCell.has
    const { has } = globalCell

    if (has.quantity > 0) {
      if (has.type === RESOURCE_TYPES.tree) owner.foundedTrees.add(has)
      if (has.type === RESOURCE_TYPES.berrybush) owner.foundedBerrybushs.add(has)
      if (has.type === RESOURCE_TYPES.stone) owner.foundedStones.add(has)
      if (has.type === RESOURCE_TYPES.gold) owner.foundedGolds.add(has)
      if (has.category === 'Fish' || has.type === RESOURCE_TYPES.salmon) owner.foundedFish?.add(has)
    }

    if (has.family === FAMILY_TYPES.animal && !has.isDead && owner.foundedAnimals) {
      owner.foundedAnimals.add(has)
    }

    if (has.family === FAMILY_TYPES.building && has.hitPoints > 0 && owner.isEnemy(has.owner)) {
      owner.foundedEnemyBuildings.add(has)
      owner.rememberEnemy?.(has)
    }

    if (has.family === FAMILY_TYPES.unit && has.hitPoints > 0 && owner.isEnemy(has.owner)) {
      owner.foundedEnemyUnits.add(has)
      owner.rememberEnemy?.(has)
    }
  }
}

export function updateVisibility(instance) {
  const { i: cx, j: cy, sight, owner, context, isDead } = instance
  const map = context.map
  const player = context.player
  const sightSq = sight * sight

  const prevVisible = instance.visibleCells ?? new Set()
  const newVisible = instance._visibleScratch ?? new Set()
  newVisible.clear()

  if (!isDead) {
    getPlainCellsAroundPoint(cx, cy, owner.views, sight, cell => {
      const dx = cell.i - cx
      const dy = cell.j - cy
      if (dx * dx + dy * dy <= sightSq) {
        newVisible.add(cell)
      }
    })
  }

  for (let cell of prevVisible) {
    if (!newVisible.has(cell)) {
      const visiblePlayers = owner.visiblePlayers ? owner.visiblePlayers() : [owner]
      const globalCell = map.grid[cell.i][cell.j]
      for (const viewer of visiblePlayers) {
        const viewerCell = viewer.views[cell.i][cell.j]
        viewerCell.viewBy.delete(instance)
      }
      const playerCell = player.views[cell.i][cell.j]
      globalCell.viewBy = new Set([...playerCell.viewBy])

      if (!playerCell.viewBy.size && !map.revealEverything) {
        globalCell.setFog()
      }
    }
  }

  for (let cell of newVisible) {
    if (!prevVisible.has(cell)) {
      const globalCell = map.grid[cell.i][cell.j]
      const visiblePlayers = owner.visiblePlayers ? owner.visiblePlayers() : [owner]

      for (const viewer of visiblePlayers) {
        const viewerCell = viewer.views[cell.i][cell.j]
        viewerCell.viewBy.add(instance)
        if (!viewerCell.viewed) {
          viewer.cellViewed++
          viewerCell.onViewed?.()
          viewerCell.viewed = true
        }
        if (viewer.type === PLAYER_TYPES.ai) {
          updateAIKnowledge(globalCell, viewerCell, viewer)
        }
      }
      globalCell.viewBy = new Set([...player.views[cell.i][cell.j].viewBy])
      globalCell.updateVisible()

      if (!map.revealEverything && player.views[cell.i][cell.j].viewBy.has(instance)) {
        globalCell.removeFog()
      }

      if (globalCell.has && globalCell.has.sight && typeof globalCell.has.detect === 'function') {
        const distSq = (cx - globalCell.has.i) ** 2 + (cy - globalCell.has.j) ** 2
        if (distSq <= globalCell.has.sight ** 2) {
          globalCell.has.detect(instance)
        }
      }
    }
  }

  instance.visibleCells = newVisible
  instance._visibleScratch = prevVisible
}
