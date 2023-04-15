import * as exports from './maths'
Object.entries(exports).forEach(([name, exported]) => (window[name] = exported))

/**
 * Check a instance is in contact with another one
 * @param {object} a
 * @param {object} b
 */
export function instanceContactInstance(a, b) {
  return Math.floor(instancesDistance(a, b)) <= (b.size - 1 || 1) && !b.isDestroyed
}

/**
 * Move instance straight to a position
 * @param {object} instance
 * @param {number} x
 * @param {number} y
 * @param {number} speed
 */
export function moveTowardPoint(instance, x, y, speed) {
  let dist = pointsDistance(x, y, instance.x, instance.y)
  let tX = x - instance.x
  let tY = y - instance.y
  let velX = (tX / dist) * speed * 2
  let velY = (tY / dist) * speed * 2
  instance.degree = getInstanceDegree(instance, x, y)
  instance.x += velX
  instance.y += velY
}

/**
 * Get the first free cell coordinate around a point
 * @param {number} x
 * @param {number} y
 * @param {object} grid
 */
export function getFreeCellAroundPoint(x, y, grid) {
  let founded

  for (let i = 1; i < 100; i++) {
    getCellsAroundPoint(x, y, grid, i, cell => {
      if (!cell.solid) {
        founded = cell
      }
    })
    if (founded) {
      return founded
    }
  }
  return null
}

export function instanceIsSurroundedBySolid(instance) {
  let size = (instance.size || 1) === 3 ? 2 : 1
  let solids = 0
  let neighbours = getCellsAroundPoint(instance.i, instance.j, instance.parent.grid, size, cell => {
    if (cell.solid) {
      solids++
    }
    return true
  })
  return neighbours.length === solids
}

export function getNewInstanceClosestFreeCellPath(instance, target, map) {
  for (let i = 1; i < 100; i++) {
    let size = (target.size || 1) === 3 ? 2 : 1
    let paths = []
    getCellsAroundPoint(target.i, target.j, map.grid, size * i, cell => {
      if (cell.has && cell.has.type === target.type) {
        getCellsAroundPoint(cell.i, cell.j, map.grid, size, neighbour => {
          if (!neighbour.solid) {
            let path = getInstancePath(instance, neighbour.i, neighbour.j, map)
            if (path.length) {
              paths.push({
                target: cell.has,
                path,
              })
            }
          }
        })
      }
    })
    paths.sort((a, b) => a.path.length - b.path.length)
    if (paths[0]) {
      return paths[0]
    }
  }
  return null
}

/**
 * Get the closest available path for a instance to a destination
 * @param {object} instance
 * @param {number} x
 * @param {number} y
 * @param {object} map
 */
export function getInstanceClosestFreeCellPath(instance, target, map) {
  let size = target.size || (target.has && target.has.size) || 1
  let paths = []
  getPlainCellsAroundPoint(target.i, target.j, map.grid, size === 3 ? 2 : 1, cell => {
    let path = getInstancePath(instance, cell.i, cell.j, map)
    if (path.length) {
      paths.push(path)
    }
  })
  paths.sort((a, b) => a.length - b.length)

  if (paths[0]) {
    return paths[0]
  }
  return []
}

/**
 * Get the shortest path for a instance to a destination
 * @param {object} instance
 * @param {number} x
 * @param {number} y
 * @param {object} map
 */
export function getInstancePath(instance, x, y, map) {
  const maxZone = 10
  const end = map.grid[x][y]
  const start = map.grid[instance.i][instance.j]
  let minX = Math.max(Math.min(start.i, end.i) - maxZone, 0)
  let maxX = Math.min(Math.max(start.i, end.i) + maxZone, map.size)
  let minY = Math.max(Math.min(start.j, end.j) - maxZone, 0)
  let maxY = Math.min(Math.max(start.j, end.j) + maxZone, map.size)

  let cloneGrid = []
  for (var i = minX; i <= maxX; i++) {
    for (var j = minY; j <= maxY; j++) {
      if (cloneGrid[i] == null) {
        cloneGrid[i] = []
      }
      cloneGrid[i][j] = {
        i,
        j,
        x: map.grid[i][j].x,
        y: map.grid[i][j].y,
        z: map.grid[i][j].z,
        solid: map.grid[i][j].solid,
      }
    }
  }
  let isFinish = false
  let path = []
  let openCells = []
  let closedCells = []
  const cloneEnd = cloneGrid[end.i][end.j]
  const cloneStart = cloneGrid[start.i][start.j]
  openCells.push(cloneStart)
  while (!isFinish) {
    if (openCells.length > 0) {
      // find the lowest f in open cells
      let lowestF = 0
      for (let i = 0; i < openCells.length; i++) {
        if (openCells[i].f < openCells[lowestF].f) {
          lowestF = i
        }

        if (openCells[i].f == openCells[lowestF].f) {
          if (openCells[i].g > openCells[lowestF].g) {
            lowestF = i
          }
        }
      }
      let current = openCells[lowestF]
      if (current === cloneEnd) {
        // reached the end cell
        isFinish = true
      }
      // calculate path
      path = [cloneEnd]
      let temp = current

      while (temp.previous) {
        path.push(temp.previous)
        temp = temp.previous
      }
      openCells.splice(openCells.indexOf(current), 1)
      closedCells.push(current)
      // check neighbours
      getCellsAroundPoint(current.i, current.j, cloneGrid, 1, neighbour => {
        const validDiag =
          !cellIsDiag(current, neighbour) ||
          (!cloneGrid[current.i][neighbour.j].solid && !cloneGrid[neighbour.i][current.j].solid)
        if (!closedCells.includes(neighbour) && !neighbour.solid && validDiag) {
          let tempG = current.g + instancesDistance(neighbour, current)
          if (!openCells.includes(neighbour)) {
            openCells.push(neighbour)
            neighbour.g = tempG
            neighbour.h = instancesDistance(neighbour, cloneEnd)
            neighbour.f = neighbour.g + neighbour.h
            neighbour.previous = current
          }
        }
      })
    } else {
      // no solution
      path = []
      isFinish = true
    }
  }
  path.pop()
  return [...path]
}

/**
 * To get a sized zone in a grid
 * @param {object} zone
 * @param {object} grid
 * @param {number} size
 * @param {export function} condition
 */
export function getZoneInGridWithCondition(zone, grid, size, condition) {
  for (let i = zone.minX; i <= zone.maxX; i++) {
    for (let j = zone.minY; j <= zone.maxY; j++) {
      if (!grid[i] || !grid[i][j]) {
        continue
      }
      let isFree = true
      getPlainCellsAroundPoint(i, j, grid, size, cell => {
        if (!condition(cell)) {
          isFree = false
        }
      })
      if (isFree) {
        return { i, j }
      }
    }
  }
}

/**
 * Allow to find all the instances around and instance with his sight
 * @param {object} instance
 * @param {export function} condition
 */
export function findInstancesInSight(instance, condition) {
  let instances = []
  for (let i = instance.i - instance.sight; i < instance.i + instance.sight; i++) {
    for (let j = instance.j - instance.sight; j < instance.j + instance.sight; j++) {
      if (
        pointsDistance(instance.i, instance.j, i, j) <= instance.sight &&
        instance.parent.grid[i] &&
        instance.parent.grid[i][j]
      ) {
        let cell = instance.parent.grid[i][j]
        if (cell.has && typeof condition === 'function' && condition(cell.has)) {
          instances.push(cell.has)
        }
      }
    }
  }
  return instances
}

/**
 * Render cell if is on sight of instance
 * @param {object} instance
 */
export function renderCellOnInstanceSight(instance, player) {
  if (instance.parent.revealEverything){
    return
  }
  const instanceCell = instance.parent.grid[instance.i][instance.j]
  if (
    instance.owner.isPlayed ||
    instanceIsInPlayerSight(instance, player) ||
    (instance.name === 'building' &&
      instance.owner.views[instance.i][instance.j].has &&
      instance.owner.views[instance.i][instance.j].has.id === instance.id)
  ) {
    instanceCell.removeFog()
  } else {
    instanceCell.setFog()
  }
  getPlainCellsAroundPoint(instance.i, instance.j, instance.owner.views, instance.sight, cell => {
    if (pointsDistance(instance.i, instance.j, cell.i, cell.j) <= instance.sight) {
      const globalCell = instance.parent.grid[cell.i][cell.j]
      if (instance.owner.isPlayed && !instance.parent.revealEverything) {
        globalCell.removeFog()
      } else if (instance.owner.type === 'AI' && globalCell.has && (!cell.has || cell.has.id !== globalCell.has.id)) {
        cell.has = globalCell.has
        if (
          globalCell.has.type === 'Tree' &&
          globalCell.has.quantity > 0 &&
          instance.owner.foundedTrees.indexOf(globalCell.has) === -1
        ) {
          instance.owner.foundedTrees.push(globalCell.has)
        }
        if (
          globalCell.has.type === 'Berrybush' &&
          globalCell.has.quantity > 0 &&
          instance.owner.foundedBerrybushs.indexOf(globalCell.has) === -1
        ) {
          instance.owner.foundedBerrybushs.push(globalCell.has)
        }
        if (
          globalCell.has.name === 'building' &&
          globalCell.has.life > 0 &&
          globalCell.has.owner !== instance.owner &&
          instance.owner.foundedEnemyBuildings.indexOf(globalCell.has) === -1
        ) {
          instance.owner.foundedEnemyBuildings.push(globalCell.has)
        }
      }
      if (cell.viewBy.indexOf(instance) === -1) {
        cell.viewBy.push(instance)
      }
      if (!cell.viewed) {
        cell.onViewed()
        cell.viewed = true
      }
    }
  })
}

export function clearCellOnInstanceSight(instance) {
  if (instance.parent.revealEverything){
    return
  }
  getPlainCellsAroundPoint(instance.i, instance.j, instance.owner.views, instance.sight, cell => {
    if (pointsDistance(instance.i, instance.j, cell.i, cell.j) <= instance.sight) {
      cell.viewBy.splice(cell.viewBy.indexOf(instance), 1)
      if (instance.parent) {
        const globalCell = instance.parent.grid[cell.i][cell.j]
        if (!cell.viewBy.length && instance.owner.isPlayed && !instance.parent.revealEverything) {
          globalCell.setFog()
        }
      }
    }
  })
}

export function getPositionInGridAroundInstance(instance, grid, space, size, allowInclined = false, extraCondition) {
  const maxSpace = space[1]
  const minSpace = space[0]
  const zone = {
    minX: instance.i - maxSpace,
    minY: instance.j - maxSpace,
    maxX: instance.i + maxSpace,
    maxY: instance.j + maxSpace,
  }
  let pos = getZoneInGridWithCondition(zone, grid, size, cell => {
    return (
      cell.i > 0 &&
      cell.j > 0 &&
      cell.i < cell.parent.size &&
      cell.j < cell.parent.size &&
      instancesDistance(instance, cell, true) > minSpace &&
      instancesDistance(instance, cell, true) < maxSpace &&
      !cell.solid &&
      !cell.border &&
      (allowInclined || !cell.inclined) &&
      (!extraCondition || extraCondition(cell))
    )
  })
  return pos || null
}

/**
 * Instance is in a player sight
 * @param {object} instance
 * @param {object} player
 */
export function instanceIsInPlayerSight(instance, player) {
  return player.views[instance.i][instance.j].viewBy.length > 0
}

/**
 * Get all the coordinate around a point with a maximum distance
 * @param {number} startX
 * @param {number} startY
 * @param {number} dist
 */
export function getPlainCellsAroundPoint(startX, startY, grid, dist, callback) {
  let result = []
  if (!dist) {
    const cell = grid[startX][startY]
    if (typeof callback === 'function') {
      if (callback(cell)) {
        result.push(cell)
      }
    } else {
      result.push(cell)
    }
    return result
  }
  for (let i = startX - dist; i <= startX + dist; i++) {
    for (let j = startY - dist; j <= startY + dist; j++) {
      if (grid[i] && grid[i][j]) {
        const cell = grid[i][j]
        if (typeof callback === 'function') {
          if (callback(cell)) {
            result.push(cell)
          }
        } else {
          result.push(cell)
        }
      }
    }
  }
  return result
}

/**
 * Get the coordinate around point at a certain distance
 * @param {number} startX
 * @param {number} startY
 * @param {number} dist
 */
export function getCellsAroundPoint(startX, startY, grid, dist, callback) {
  let result = []
  if (!dist) {
    const cell = grid[startX][startY]
    if (typeof callback === 'function') {
      if (callback(cell)) {
        result.push(cell)
      }
    } else {
      result.push(cell)
    }
    return result
  }
  let x = startX - dist
  let y = startY - dist
  let loop = 0
  let velX = 1
  let velY = 0
  let line = 0
  for (let i = 0; i < 8 + (dist - 1) * 8; i++) {
    x += velX
    y += velY
    if (grid[x] && grid[x][y]) {
      const cell = grid[x][y]
      if (typeof callback === 'function') {
        if (callback(cell)) {
          result.push(cell)
        }
      } else {
        result.push(cell)
      }
    }
    line++
    if (line === dist * 2) {
      let speed = loop > 0 ? -1 : 1
      if (loop % 2) {
        velX = speed
        velY = 0
      } else {
        velX = 0
        velY = speed
      }
      line = 0
      loop++
    }
  }
  return result
}

/**
 * Get the closest instances to another instance
 * @param {object} instance
 * @param {object} instances
 */
export function getClosestInstance(instance, instances) {
  let distances = []
  for (let i = 0; i < instances.length; i++) {
    distances.push({
      instance: instances[i],
      dist: instancesDistance(instance, instances[i]),
    })
  }
  distances.sort((a, b) => a.dist - b.dist)
  return (distances.length && distances[0].instance) || false
}

export function getClosestInstanceWithPath(instance, instances) {
  let distances = []
  for (let i = 0; i < instances.length; i++) {
    let path = getInstanceClosestFreeCellPath(instance, instances[i], instance.parent)
    if (path.length) {
      distances.push({
        instance: instances[i],
        path,
      })
    }
  }
  distances.sort((a, b) => a.path.length - b.path.length)
  return distances[0] || null
}
