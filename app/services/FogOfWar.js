import { FAMILY_TYPES, PLAYER_TYPES, RESOURCE_TYPES } from '../constants'

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

function updateAIKnowledge(globalCell, viewer, { staticOnly = false } = {}) {
  const owner = viewer
  const known = viewer.views.getKnownOccupant(globalCell.i, globalCell.j)

  if (globalCell.has && (!known || known.label !== globalCell.has.label)) {
    viewer.views.setKnownOccupant(globalCell.i, globalCell.j, globalCell.has)
    const { has } = globalCell

    if (has.quantity > 0) {
      if (has.type === RESOURCE_TYPES.tree) owner.foundedTrees.add(has)
      if (has.type === RESOURCE_TYPES.berrybush) owner.foundedBerrybushs.add(has)
      if (has.type === RESOURCE_TYPES.stone) owner.foundedStones.add(has)
      if (has.type === RESOURCE_TYPES.gold) owner.foundedGolds.add(has)
      if (has.category === 'Fish' || has.type === RESOURCE_TYPES.salmon) owner.foundedFish?.add(has)
    }

    if (!staticOnly && has.family === FAMILY_TYPES.animal && !has.isDead && owner.foundedAnimals) {
      owner.foundedAnimals.add(has)
    }

    if (!staticOnly && has.family === FAMILY_TYPES.building && has.hitPoints > 0 && owner.isEnemy(has.owner)) {
      owner.foundedEnemyBuildings.add(has)
      owner.rememberEnemy?.(has)
    }

    if (!staticOnly && has.family === FAMILY_TYPES.unit && has.hitPoints > 0 && owner.isEnemy(has.owner)) {
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
      if (!globalCell || !viewer.views.isViewed(i, j)) continue

      updateAIKnowledge(globalCell, viewer, { staticOnly: !viewer.views.isVisible(i, j) })

      if (viewer.views.isVisible(i, j)) {
        for (const corpse of globalCell.corpses || []) {
          if (corpse.family === FAMILY_TYPES.animal && corpse.isDead && !corpse.isDestroyed && corpse.quantity > 0) {
            viewer.foundedDeadAnimals?.add(corpse)
          }
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
    const minI = Math.max(cx - sight, 0)
    const maxI = Math.min(cx + sight, owner.views.size)
    const minJ = Math.max(cy - sight, 0)
    const maxJ = Math.min(cy + sight, owner.views.size)
    for (let i = minI; i <= maxI; i++) {
      for (let j = minJ; j <= maxJ; j++) {
        const dx = i - cx
        const dy = j - cy
        if (dx * dx + dy * dy <= sightSq) {
          newVisible.add(owner.views.index(i, j))
        }
      }
    }
  }

  for (const index of prevVisible) {
    if (!newVisible.has(index)) {
      const [i, j] = owner.views.coordinates(index)
      const globalCell = map.grid[i][j]
      for (const viewer of visiblePlayers) {
        viewer.views.removeViewer(i, j, instance)
      }
      syncVisibleSet(globalCell.viewBy, player.views.getViewers(i, j))

      if (!player.views.isVisible(i, j) && !map.revealEverything) {
        globalCell.setFog()
      }
    }
  }

  for (const index of newVisible) {
    if (!prevVisible.has(index)) {
      const [i, j] = owner.views.coordinates(index)
      const globalCell = map.grid[i][j]

      for (const viewer of visiblePlayers) {
        viewer.views.addViewer(i, j, instance)
        if (viewer.views.setViewed(i, j)) {
          viewer.cellViewed++
        }
        if (viewer.type === PLAYER_TYPES.ai) {
          updateAIKnowledge(globalCell, viewer)
        }
      }
      syncVisibleSet(globalCell.viewBy, player.views.getViewers(i, j))
      globalCell.updateVisible()

      if (!map.revealEverything && player.views.hasViewer(i, j, instance)) {
        globalCell.removeFog()
      }

      if (
        !instance.context.editor &&
        globalCell.has &&
        globalCell.has.sight &&
        typeof globalCell.has.detect === 'function'
      ) {
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
