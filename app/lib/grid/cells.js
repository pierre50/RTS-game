function zoneMatchesCondition(i, j, grid, size, condition) {
  const surroundingCells = getPlainCellsAroundPoint(i, j, grid, size)
  for (const surroundingCell of surroundingCells) {
    if (!condition(surroundingCell)) return false
  }
  return true
}

export function getZoneInGridWithCondition(zone, grid, size, condition) {
  for (let i = zone.minX; i <= zone.maxX; i++) {
    if (!grid[i]) continue

    for (let j = zone.minY; j <= zone.maxY; j++) {
      const cell = grid[i]?.[j]
      if (!cell) continue
      if (zoneMatchesCondition(i, j, grid, size, condition)) return { i, j }
    }
  }

  return null
}

export function getRandomZoneInGridWithCondition(zone, grid, size, condition, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const randomX = Math.floor(Math.random() * (zone.maxX - zone.minX + 1)) + zone.minX
    const randomY = Math.floor(Math.random() * (zone.maxY - zone.minY + 1)) + zone.minY

    const cell = grid[randomX]?.[randomY]
    if (!cell) continue
    if (zoneMatchesCondition(randomX, randomY, grid, size, condition)) return { i: randomX, j: randomY }
  }

  return null
}

export function getPlainCellsAroundPoint(startX, startY, grid, dist = 0, callback) {
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

export function getCellsAroundPoint(startX, startY, grid, dist, callback) {
  const result = []

  const startCell = grid[startX]?.[startY]
  if (dist === 0) {
    if (startCell && (!callback || callback(startCell))) result.push(startCell)
    return result
  }

  for (let dx = -dist; dx <= dist; dx++) {
    const x = startX + dx
    const row = grid[x]
    if (!row) continue

    const dyMax = dist - Math.abs(dx)
    for (let dy = -dyMax; dy <= dyMax; dy++) {
      const y = startY + dy
      const cell = row[y]
      if (!cell) continue

      if (!callback || callback(cell)) result.push(cell)
    }
  }

  return result
}
