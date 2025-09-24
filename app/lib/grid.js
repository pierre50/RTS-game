import { ACCELERATOR, FAMILY_TYPES, PLAYER_TYPES, RESOURCE_TYPES } from '../constants'
import * as exports from './maths'
Object.entries(exports).forEach(([name, exported]) => (window[name] = exported))

/**
 * Check if two instances are in contact.
 *
 * @param {object} a - The first instance. Should have properties like `x`, `y`, and `size`.
 * @param {object} b - The second instance. Should have properties like `x`, `y`, `size`, and `isDestroyed`.
 * @returns {boolean} - True if instance `a` is in contact with instance `b`, false otherwise.
 */
export function instanceContactInstance(a, b) {
  // Check if the distance between instances is less than or equal to (b.size - 1) and b is not destroyed
  return Math.floor(instancesDistance(a, b)) <= (b.size - 1 || 1) && !b.isDestroyed
}

/**
 * Move an instance towards a specific point (x, y) at a given speed.
 *
 * @param {object} instance - The instance to move. Should have properties like `x`, `y`, and `degree`.
 * @param {number} x - The target x-coordinate to move towards.
 * @param {number} y - The target y-coordinate to move towards.
 * @param {number} speed - The speed at which the instance should move.
 */
export function moveTowardPoint(instance, x, y, speed) {
  const dist = pointsDistance(x, y, instance.x, instance.y)

  if (dist === 0) return // Prevent division by zero

  // Calculate the direction vector from the instance to the target point
  const tX = x - instance.x
  const tY = y - instance.y

  // Calculate the velocity based on the speed and distance
  const velX = (tX / dist) * (speed * ACCELERATOR)
  const velY = (tY / dist) * (speed * ACCELERATOR)

  // Update the instance's degree (rotation) to face the target point
  instance.degree = getInstanceDegree(instance, x, y)

  // Update the instance's position by adding the velocity components
  instance.x += velX
  instance.y += velY
}

/**
 * Get the first free cell coordinate around a point
 * @param {number} x - The x-coordinate of the starting point
 * @param {number} y - The y-coordinate of the starting point
 * @param {number} size - The starting search radius
 * @param {object} grid - The grid to search in
 * @param {function} condition - A function to test if a cell is free
 * @returns {object|null} - The coordinates of the first free cell or null if none found
 */
export function getFreeCellAroundPoint(x, y, size, grid, condition) {
  const maxDistance = 50

  for (let distance = size; distance < maxDistance; distance++) {
    const cells = getCellsAroundPoint(x, y, grid, distance, condition)
    if (cells.length > 0) {
      return randomItem(cells)
    }
  }

  return null
}

/**
 * Get the closest available path for an instance to a destination
 * @param {object} instance - The instance seeking a path
 * @param {object} target - The target object to reach
 * @param {object} map - The map containing grid information
 * @returns {Array} - The shortest path to a free cell or an empty array if none found
 */
export function getInstanceClosestFreeCellPath(instance, target, map) {
  const size = target.size || (target.has && target.has.size) || 1
  const paths = []

  // Get cells around the target based on size
  const distance = size === 3 ? 2 : 1
  getCellsAroundPoint(target.i, target.j, map.grid, distance, cell => {
    const path = getInstancePath(instance, cell.i, cell.j, map)
    if (path.length) {
      paths.push(path)
    }
  })

  // Return the shortest path if available
  return paths.length
    ? paths.reduce((shortest, current) => (current.length < shortest.length ? current : shortest))
    : []
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

  function isCellReachable(cell) {
    if (cell.solid) {
      return false
    }
    const allowWaterCellCategory = instance.category === 'Boat'
    return allowWaterCellCategory ? cell.category === 'Water' : cell.category !== 'Water'
  }

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
        category: map.grid[i][j].category,
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
          (isCellReachable(cloneGrid[current.i][neighbour.j]) && isCellReachable(cloneGrid[neighbour.i][current.j]))
        if (!closedCells.includes(neighbour) && isCellReachable(neighbour) && validDiag) {
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
 * Find a sized zone in the grid that meets a condition.
 *
 * This function searches within a given zone in the grid for a region of the specified `size`,
 * and checks whether all cells within that region meet a specified condition.
 *
 * @param {object} zone - An object containing the boundaries of the search area (minX, maxX, minY, maxY).
 * @param {object[][]} grid - A 2D grid representing the map.
 * @param {number} size - The size of the area to check around each grid point.
 * @param {function} condition - A callback function that evaluates whether a cell is valid.
 * @returns {object|null} The coordinates {i, j} of the first valid zone found, or null if none are found.
 */
export function getZoneInGridWithCondition(zone, grid, size, condition) {
  // Iterate over the specified zone in the grid
  for (let i = zone.minX; i <= zone.maxX; i++) {
    if (!grid[i]) continue // Skip if out of bounds

    for (let j = zone.minY; j <= zone.maxY; j++) {
      const cell = grid[i]?.[j]
      if (!cell) continue // Skip if cell doesn't exist

      // Assume the area around (i, j) is free initially
      let isFree = true

      // Check the surrounding cells of size `size` to ensure they all meet the condition
      const surroundingCells = getPlainCellsAroundPoint(i, j, grid, size)
      for (const surroundingCell of surroundingCells) {
        if (!condition(surroundingCell)) {
          isFree = false
          break // Exit early if a cell does not meet the condition
        }
      }

      // Return the first valid {i, j} coordinates if the area is free
      if (isFree) {
        return { i, j }
      }
    }
  }

  // Return null if no valid zone is found
  return null
}

/**
 * Finds all instances within the sight range of a given instance that meet a specific condition.
 *
 * @param {object} instance - The instance whose sight is being processed. Should have properties like `i`, `j`, `sight`, and `parent.grid`.
 * @param {function} condition - A callback function that receives an instance and returns `true` if the instance matches the desired condition.
 * @returns {Array} - List of instances that are within the sight range and match the condition.
 */
export function findInstancesInSight(instance, condition) {
  const {
    i: instX,
    j: instY,
    sight,
    parent: { grid },
  } = instance
  let instances = []

  for (let x = Math.max(instX - sight, 0); x <= Math.min(instX + sight, grid.length - 1); x++) {
    for (let y = Math.max(instY - sight, 0); y <= Math.min(instY + sight, grid[x].length - 1); y++) {
      // Check if the cell is within the instance's sight range
      if (pointsDistance(instX, instY, x, y) <= sight) {
        const cell = grid[x][y]

        // Ensure the cell has an instance and the condition is met
        if (cell?.has && typeof condition === 'function' && condition(cell.has)) {
          instances.push(cell.has)
        }
      }
    }
  }

  return instances
}

/**
 * Updates the cells within a instance's line of sight.
 * Handles fog, viewBy, and visibility efficiently by diffing old vs new cells.
 *
 * @param {object} instance - The instance instance with properties i, j, sight, owner, parent, context.
 */
export function updateInstanceVisibility(instance) {
  const { i: cx, j: cy, sight, owner, context, isDead, visibleCells } = instance
  const map = context.map
  const player = context.player
  const sightSq = sight * sight
  const newVisible = new Set()

  // Collect all cells within sight
  if (!isDead) {
    getPlainCellsAroundPoint(cx, cy, owner.views, sight, cell => {
      const dx = cell.i - cx
      const dy = cell.j - cy
      if (dx * dx + dy * dy <= sightSq) {
        newVisible.add(cell)
      }
    })
  }

  const prevVisible = visibleCells || new Set()

  // Hide cells that left sight
  for (let cell of prevVisible) {
    if (!newVisible.has(cell)) {
      const playerCell = player.views[cell.i][cell.j]
      const globalCell = map.grid[cell.i][cell.j]
      const globalIdx = globalCell.viewBy.indexOf(instance)
      const idx = cell.viewBy.indexOf(instance)
      if (globalIdx !== -1) {
        globalCell.viewBy.splice(globalIdx, 1)
      }
      if (idx !== -1) {
        cell.viewBy.splice(idx, 1)
      }

      if (!playerCell.viewBy.length && !map.revealEverything) {
        globalCell.setFog()
      }
    }
  }

  // Show new cells
  for (let cell of newVisible) {
    if (!prevVisible.has(cell)) {
      const globalCell = map.grid[cell.i][cell.j]

      globalCell.updateVisible()
      if (!globalCell.viewBy.includes(instance)) {
        globalCell.viewBy.push(instance)
      }
      if (!cell.viewBy.includes(instance)) {
        cell.viewBy.push(instance)
      }
      if (!cell.viewed) {
        owner.cellViewed++
        cell.onViewed?.()
        cell.viewed = true
      }

      if (!map.revealEverything && owner.isPlayed) {
        globalCell.removeFog()
      } else if (owner.type === PLAYER_TYPES.ai) {
        // Update AI's knowledge of the surroundings (trees, berrybushes, enemy buildings)
        updateAIKnowledge(globalCell, cell, instance)
      }

      // Optional: detect other instances in sight
      if (globalCell.has && globalCell.has.sight && typeof globalCell.has.detect === 'function') {
        const distSq = (cx - globalCell.has.i) ** 2 + (cy - globalCell.has.j) ** 2
        if (distSq <= globalCell.has.sight ** 2) {
          globalCell.has.detect(instance)
        }
      }
    }
  }

  instance.visibleCells = newVisible
}

/**
 * Updates AI knowledge of trees, berrybushes, and enemy buildings when an AI instance views a global cell.
 *
 * @param {object} globalCell - The cell in the global grid.
 * @param {object} cell - The current local cell being processed.
 * @param {object} instance - The AI instance viewing the cell.
 */
function updateAIKnowledge(globalCell, cell, instance) {
  const { owner } = instance

  // Sync local cell's "has" object with the global cell if different
  if (globalCell.has && (!cell.has || cell.has.label !== globalCell.has.label)) {
    cell.has = globalCell.has

    // Detect tree resources and update AI's knowledge
    if (
      globalCell.has.type === RESOURCE_TYPES.tree &&
      globalCell.has.quantity > 0 &&
      !owner.foundedTrees.includes(globalCell.has)
    ) {
      owner.foundedTrees.push(globalCell.has)
    }

    // Detect berrybush resources and update AI's knowledge
    if (
      globalCell.has.type === RESOURCE_TYPES.berrybush &&
      globalCell.has.quantity > 0 &&
      !owner.foundedBerrybushs.includes(globalCell.has)
    ) {
      owner.foundedBerrybushs.push(globalCell.has)
    }

    // Detect enemy buildings and update AI's knowledge
    if (
      globalCell.has.family === FAMILY_TYPES.building &&
      globalCell.has.hitPoints > 0 &&
      globalCell.has.owner.label !== owner.label &&
      !owner.foundedEnemyBuildings.includes(globalCell.has)
    ) {
      owner.foundedEnemyBuildings.push(globalCell.has)
    }
  }
}

/**
 * Randomly finds a valid position in the grid within a specified zone and size, considering certain conditions.
 *
 * This function attempts to find a valid cell in the grid around the specified zone by randomly generating coordinates
 * and checking if they meet specific conditions, such as avoiding inclined, solid, or border cells.
 *
 * @param {object} zone - The area of the grid to search within (must have properties `minX`, `minY`, `maxX`, `maxY`).
 * @param {object[][]} grid - The grid representing the map, where each cell contains coordinates and attributes.
 * @param {number} size - The size of the instance for which we are finding space.
 * @param {function} condition - A function that returns true if the cell meets the conditions, false otherwise.
 * @param {number} attempts - The number of random attempts to find a valid cell.
 * @returns {object|null} The position {i, j} of a valid cell or null if no valid cell is found.
 */
export function getRandomZoneInGridWithCondition(zone, grid, size, condition, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    // Generate random coordinates within the zone
    const randomX = Math.floor(Math.random() * (zone.maxX - zone.minX + 1)) + zone.minX
    const randomY = Math.floor(Math.random() * (zone.maxY - zone.minY + 1)) + zone.minY

    const cell = grid[randomX]?.[randomY]
    if (!cell) continue // Skip if cell doesn't exist

    // Assume the area around (randomX, randomY) is free initially
    let isFree = true

    // Check the surrounding cells of size `size` to ensure they all meet the condition
    const surroundingCells = getPlainCellsAroundPoint(randomX, randomY, grid, size)
    for (const surroundingCell of surroundingCells) {
      if (!condition(surroundingCell)) {
        isFree = false
        break // Exit early if a cell does not meet the condition
      }
    }

    // If the area is free, return the valid cell
    if (isFree) {
      return { i: randomX, j: randomY }
    }
  }

  // Return null if no valid cells found after all attempts
  return null
}

/**
 * Find a valid position in the grid around an instance within a specified space range.
 *
 * This function searches for a position around a given instance within the grid, considering a range of space,
 * the size of the object, and additional conditions like avoiding inclined, solid, or border cells. It can
 * use either a random zone search or a fixed zone search depending on the `random` parameter.
 *
 * @param {object} instance - The instance around which to search (must have properties `i`, `j`, and `parent` grid).
 * @param {object[][]} grid - The grid representing the map, where each cell contains coordinates and attributes.
 * @param {number[]} space - An array [minSpace, maxSpace] that defines the distance range to search within.
 * @param {number} size - The size of the instance for which we are finding space.
 * @param {boolean} [allowInclined=false] - Whether to allow inclined cells in the search.
 * @param {function} [extraCondition] - An optional callback for extra conditions that a valid cell must meet.
 * @param {boolean} [random=true] - If `true`, uses `getRandomZoneInGridWithCondition`; otherwise, uses `getZoneInGridWithCondition`.
 * @returns {object|null} The position {i, j} of a valid cell or null if no valid cell is found.
 */
export function getPositionInGridAroundInstance(
  instance,
  grid,
  space,
  size,
  allowInclined = false,
  extraCondition,
  random = true
) {
  const [minSpace, maxSpace] = space

  // Define the search zone based on instance's position and maxSpace
  const zone = {
    minX: Math.max(instance.i - maxSpace, 0),
    minY: Math.max(instance.j - maxSpace, 0),
    maxX: Math.min(instance.i + maxSpace, instance.parent.size - 1),
    maxY: Math.min(instance.j + maxSpace, instance.parent.size - 1),
  }

  // Condition to check if the cell is valid based on space, solid, inclined, etc.
  const cellCondition = cell => {
    const distance = instancesDistance(instance, cell, true)
    return (
      distance >= minSpace && // Ensure it's at least the minimum distance away
      distance <= maxSpace && // Ensure it's within the maximum distance
      !cell.solid && // Ensure the cell is not solid
      !cell.border && // Ensure the cell is not at the border
      (allowInclined || !cell.inclined) && // Check inclined condition
      (!extraCondition || extraCondition(cell)) // Apply any additional conditions
    )
  }

  // Use either the random zone search or fixed zone search based on the 'random' flag
  let pos
  if (random) {
    pos = getRandomZoneInGridWithCondition(zone, grid, size, cellCondition)
  } else {
    pos = getZoneInGridWithCondition(zone, grid, size, cellCondition)
  }

  // Return the found position or null if none is found
  return pos || null
}

/**
 * Instance is in a player sight
 * @param {object} instance
 * @param {object} player
 */
export function instanceIsInPlayerSight(instance, player) {
  const dist = instance.size === 3 ? 1 : 0
  let isInSight = false // Flag to track if the instance is in player sight

  player?.views &&
    getPlainCellsAroundPoint(instance.i, instance.j, player.views, dist, cell => {
      if (cell.viewBy.length > 0) {
        isInSight = true // Set the flag if the condition is met
      }
    })

  return isInSight // Return the flag
}

/**
 * Get all the coordinates around a point within a maximum distance.
 *
 * @param {number} startX - The X coordinate of the center point.
 * @param {number} startY - The Y coordinate of the center point.
 * @param {number} dist - The maximum distance from the center point.
 * @param {object[][]} grid - 2D array representing the grid.
 * @param {function} [callback] - Optional callback function to filter cells. If provided, it should return true for valid cells.
 * @returns {object[]} - Array of valid cells around the point within the distance.
 */
export function getPlainCellsAroundPoint(startX, startY, grid, dist = 0, callback) {
  const result = []

  // Handle single-cell case
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

/**
 * Get the coordinates around a point within a Manhattan distance
 * @param {number} startX
 * @param {number} startY
 * @param {Array} grid
 * @param {number} dist
 * @param {Function} callback
 * @returns {Array} Array of cells that match the criteria
 */
/**
 * Get the coordinates around a point within a Manhattan distance (safe for irregular grids)
 * @param {number} startX
 * @param {number} startY
 * @param {Array} grid
 * @param {number} dist
 * @param {Function} callback
 * @returns {Array} Array of cells that match the criteria
 */
export function getCellsAroundPoint(startX, startY, grid, dist, callback) {
  const result = []

  // Special case: distance 0
  const startCell = grid[startX]?.[startY]
  if (dist === 0) {
    if (startCell && (!callback || callback(startCell))) result.push(startCell)
    return result
  }

  // Iterate over Manhattan distance
  for (let dx = -dist; dx <= dist; dx++) {
    const x = startX + dx
    if (!grid[x]) continue // Skip if row does not exist

    const dyMax = dist - Math.abs(dx)
    for (let dy = -dyMax; dy <= dyMax; dy++) {
      const y = startY + dy
      const row = grid[x]
      if (!row || !row[y]) continue // Skip if cell does not exist

      const cell = row[y]
      if (!callback || callback(cell)) result.push(cell)
    }
  }

  return result
}

/**
 * Get the closest instance to a given instance.
 *
 * @param {object} instance - The reference instance. Should have properties like `x`, `y`.
 * @param {Array<object>} instances - The array of other instances to check. Each should have properties like `x`, `y`.
 * @returns {object|boolean} - The closest instance or false if no instances are found.
 */
export function getClosestInstance(instance, instances) {
  let closestInstance = null
  let closestDistance = Infinity

  // Iterate through the instances to find the one with the minimum distance to the reference instance
  for (const targetInstance of instances) {
    const distance = instancesDistance(instance, targetInstance)

    if (distance < closestDistance) {
      closestDistance = distance
      closestInstance = targetInstance
    }
  }

  // Return the closest instance, or false if no valid instance was found
  return closestInstance || false
}

/**
 * Get the closest instance with a valid path.
 *
 * This function calculates the closest instance that can be reached by a valid path
 * from the given `instance`. It checks all provided `instances` and computes the path
 * to each of them, then returns the instance with the shortest valid path.
 *
 * @param {object} instance - The current instance trying to reach other instances.
 * @param {Array<object>} instances - An array of target instances to find the closest reachable one.
 * @returns {object|null} The closest instance with its path or null if no valid path is found.
 */
export function getClosestInstanceWithPath(instance, instances) {
  let closest = null

  for (const target of instances) {
    const path = getInstanceClosestFreeCellPath(instance, target, instance.parent)

    // If a valid path exists, compare its length to the current closest
    if (path.length && (!closest || path.length < closest.path.length)) {
      closest = {
        instance: target,
        path,
      }
    }
  }

  return closest
}
