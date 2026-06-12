import { FAMILY_TYPES, PLAYER_TYPES, RESOURCE_TYPES } from '../constants'

function getPlainCellsAroundPoint(startX, startY, grid, dist = 0, callback) {
  const result = callback ? null : []

  if (dist === 0) {
    const row = grid[startX]
    if (row) {
      const cell = row[startY]
      if (cell) {
        if (callback) {
          callback(cell)
        } else {
          result.push(cell)
        }
      }
    }
    return result || []
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
      if (!cell) continue
      if (callback) {
        callback(cell)
      } else {
        result.push(cell)
      }
    }
  }

  return result || []
}

function syncVisibleSet(target, source) {
  if (target === source) return
  if (target.size === source.size) {
    let identical = true
    for (const item of source) {
      if (!target.has(item)) {
        identical = false
        break
      }
    }
    if (identical) return
  }

  target.clear()
  for (const item of source) {
    target.add(item)
  }
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

export function rehydrateAIKnowledge(viewer, map) {
  if (viewer.type !== PLAYER_TYPES.ai) return

  for (let i = 0; i < map.grid.length; i++) {
    const row = map.grid[i]
    if (!row) continue

    for (let j = 0; j < row.length; j++) {
      const globalCell = row[j]
      const viewerCell = viewer.views?.[i]?.[j]
      if (!globalCell || !viewerCell?.viewed) continue

      updateAIKnowledge(globalCell, viewerCell, viewer)

      for (const corpse of globalCell.corpses || []) {
        if (corpse.family === FAMILY_TYPES.animal && corpse.isDead && !corpse.isDestroyed && corpse.quantity > 0) {
          viewer.foundedDeadAnimals?.add(corpse)
        }
      }
    }
  }
}

export function updateVisibility(instance) {
  const { i: cx, j: cy, sight, owner, context, isDead } = instance
  const map = context.map
  const player = context.player
  if (!owner?.views || !player?.views || !map?.grid) return
  const sightSq = sight * sight
  const visiblePlayers = owner.visiblePlayers ? owner.visiblePlayers() : [owner]

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
      const globalCell = map.grid[cell.i][cell.j]
      const playerCell = player.views[cell.i][cell.j]
      for (const viewer of visiblePlayers) {
        const viewerCell = viewer.views[cell.i][cell.j]
        viewerCell.viewBy.delete(instance)
      }
      syncVisibleSet(globalCell.viewBy, playerCell.viewBy)

      if (!playerCell.viewBy.size && !map.revealEverything) {
        globalCell.setFog()
      }
    }
  }

  for (let cell of newVisible) {
    if (!prevVisible.has(cell)) {
      const globalCell = map.grid[cell.i][cell.j]
      const playerCell = player.views[cell.i][cell.j]

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
      syncVisibleSet(globalCell.viewBy, playerCell.viewBy)
      globalCell.updateVisible()

      if (!map.revealEverything && playerCell.viewBy.has(instance)) {
        globalCell.removeFog()
      }

      if (!instance.context.editor && globalCell.has && globalCell.has.sight && typeof globalCell.has.detect === 'function') {
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
