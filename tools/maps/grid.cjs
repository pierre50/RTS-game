function getCellsAroundPoint(i, j, grid, radius, predicate) {
  const cells = []
  for (let x = Math.max(0, i - radius); x <= Math.min(grid.length - 1, i + radius); x++) {
    for (let y = Math.max(0, j - radius); y <= Math.min(grid.length - 1, j + radius); y++) {
      const cell = grid[x]?.[y]
      if (cell && predicate(cell)) cells.push(cell)
    }
  }
  return cells
}

function getPlainCellsAroundPoint(i, j, grid, radius) {
  return getCellsAroundPoint(i, j, grid, radius, cell => !cell.solid && cell.category !== 'Water')
}

function getBuildingFootprintRadius(size) {
  return Math.max(0, Math.floor((Math.max(1, size) - 1) / 2))
}

function getBuildingFootprintCells(i, j, grid, size, predicate) {
  const radius = getBuildingFootprintRadius(size)
  const cells = []
  for (let x = i - radius; x <= i + radius; x++) {
    for (let y = j - radius; y <= j + radius; y++) {
      const cell = grid[x]?.[y]
      if (!cell) continue
      if (!predicate || predicate(cell)) cells.push(cell)
    }
  }
  return cells
}

function hasWaterBorderWithin(grid, i, j, radius) {
  if (radius <= 0) return Boolean(grid[i]?.[j]?.waterBorder)

  for (let x = Math.max(0, i - radius); x <= Math.min(grid.length - 1, i + radius); x++) {
    const row = grid[x]
    if (!row) continue
    for (let y = Math.max(0, j - radius); y <= Math.min(row.length - 1, j + radius); y++) {
      if (row[y]?.waterBorder) return true
    }
  }
  return false
}

function getZoneInGridWithCondition(bounds, grid, radius, predicate) {
  for (let i = bounds.minX; i <= bounds.maxX; i++)
    for (let j = bounds.minY; j <= bounds.maxY; j++) {
      const cell = grid[i]?.[j]
      if (!cell || !predicate(cell)) continue
      let valid = true
      for (let x = i - radius; x <= i + radius && valid; x++)
        for (let y = j - radius; y <= j + radius; y++) {
          if (!grid[x]?.[y] || !predicate(grid[x][y])) {
            valid = false
            break
          }
        }
      if (valid) return cell
    }
  return null
}

function compactPositions(positions = []) {
  return positions.filter(position => position && Number.isFinite(position.i) && Number.isFinite(position.j))
}

module.exports = {
  getCellsAroundPoint,
  getBuildingFootprintCells,
  getBuildingFootprintRadius,
  getPlainCellsAroundPoint,
  getZoneInGridWithCondition,
  hasWaterBorderWithin,
  compactPositions,
}
