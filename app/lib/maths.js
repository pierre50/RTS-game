import { CELL_WIDTH, CELL_HEIGHT, CELL_DEPTH } from '../constants'

/**
 * Generate a version 4 UUID.
 * @returns {string} - A random UUID.
 */
export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const randomValue = crypto.getRandomValues(new Uint8Array(1))[0] & 15 // Get a random value
    const hexValue = (c === 'x' ? randomValue : (randomValue & 0x3) | 0x8).toString(16) // Adjust for 'y'
    return hexValue
  })
}

/**
 * Format a number with three character
 * @param {number} nbr
 */
export function formatNumber(nbr) {
  return ('00' + nbr).slice(-3)
}

/**
 * Convert cartesian to isometric
 * @param {number} x
 * @param {number} y
 */
export function cartesianToIsometric(x, y) {
  return [Math.floor(((x - y) * CELL_WIDTH) / 2), Math.floor(((x + y) * CELL_HEIGHT) / 2)]
}

/**
 * Convert isometric position to cartesian
 * @param {number} x
 * @param {number} y
 */
export function isometricToCartesian(x, y) {
  return [
    Math.round((x / (CELL_WIDTH / 2) + y / (CELL_HEIGHT / 2)) / 2),
    Math.round((y / (CELL_HEIGHT / 2) - x / (CELL_WIDTH / 2)) / 2),
  ]
}

/**
 * Get percentage with two numbers
 * @param {number} a
 * @param {number} b
 */
export function getPercentage(a, b) {
  return Math.floor((a / b) * 100)
}

/**
 * Get value of percentage
 * @param {number} a
 * @param {number} b
 */
export function getValuePercentage(val, perc) {
  return Math.floor((perc * val) / 100)
}

/**
 * Get average between two numbers
 * @param {number} a
 * @param {number} b
 */
export function average(a, b) {
  return (a + b) / 2
}

/**
 * Check if point is between two points can be used with line thickness
 * @param {object} line1
 * @param {object} line2
 * @param {object} pnt
 * @param {number} lineThickness
 */
/**
 * Check if a point is within a certain distance from a line segment
 * @param {{x:number, y:number}} line1 - Start point of the line
 * @param {{x:number, y:number}} line2 - End point of the line
 * @param {{x:number, y:number}} pnt - Point to check
 * @param {number} lineThickness - Maximum allowed distance from the line
 * @returns {boolean}
 */
export function pointIsBetweenTwoPoint(line1, line2, pnt, lineThickness) {
  const dx = line2.x - line1.x
  const dy = line2.y - line1.y
  const L2 = dx * dx + dy * dy
  if (L2 === 0) {
    // line1 == line2
    const dist = Math.hypot(line1.x - pnt.x, line1.y - pnt.y)
    return dist <= lineThickness
  }

  // Projection parameter
  const r = ((pnt.x - line1.x) * dx + (pnt.y - line1.y) * dy) / L2

  if (r < 0) {
    return Math.hypot(line1.x - pnt.x, line1.y - pnt.y) <= lineThickness
  } else if (r > 1) {
    return Math.hypot(line2.x - pnt.x, line2.y - pnt.y) <= lineThickness
  } else {
    // Perpendicular distance from point to line
    const s = ((line1.y - pnt.y) * dx - (line1.x - pnt.x) * dy) / L2
    return Math.abs(s) * Math.sqrt(L2) <= lineThickness
  }
}

/**
 * Get a random number between two numbers
 * @param {number} min
 * @param {number} max
 */
export function randomRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

/**
 * Get a random item from a array
 * @param {array} array
 */
export function randomItem(array = []) {
  return array[Math.round(Math.random() * (array.length - 1))]
}

/**
 * Get distance between two instances, can use iso (x, y) or cartesian (i, j)
 * @param {object} a
 * @param {object} b
 * @param {boolean} useCartesian
 */
export function instancesDistance(a, b, useCartesian = true) {
  return useCartesian ? pointsDistance(a.i, a.j, b.i, b.j) : pointsDistance(a.x, a.y, b.x, b.y)
}

/**
 * Get the instance zIndex according to his position
 * @param {object} instance
 */
export function getInstanceZIndex(instance) {
  const pos = isometricToCartesian(instance.x, instance.y + instance.z * CELL_DEPTH)
  return pos[0] + pos[1]
}

/**
 * Get the difference between two number
 * @param {number} a
 * @param {number} b
 */
export function diff(a, b) {
  return Math.abs(a - b)
}

/**
 * Get degree of instance according to a point
 * @param {object} instance
 * @param {number} x
 * @param {number} y
 */
export function getInstanceDegree(instance, x, y) {
  return getPointsDegree(instance.x, instance.y, x, y)
}

/**
 * Get the degree from one point to another.
 * @param {number} x1 - The x-coordinate of the first point.
 * @param {number} y1 - The y-coordinate of the first point.
 * @param {number} x2 - The x-coordinate of the second point.
 * @param {number} y2 - The y-coordinate of the second point.
 * @returns {number} - The angle in degrees from the first point to the second.
 */
export function getPointsDegree(x1, y1, x2, y2) {
  const tX = x2 - x1
  const tY = y2 - y1
  return Math.round((Math.atan2(tY, tX) * 180) / Math.PI + 180)
}

/**
 * Convert degrees to radians.
 * @param {number} degrees - The angle in degrees.
 * @returns {number} - The angle in radians.
 */
export function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180)
}

/**
 * Get distance between two points
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 */
export function pointsDistance(x1, y1, x2, y2) {
  let a = x1 - x2
  let b = y1 - y2
  return Math.floor(Math.sqrt(a * a + b * b))
}

/**
 * Check if point is in a rectangle or not
 * @param {number} x
 * @param {number} y
 * @param {number} left
 * @param {number} top
 * @param {number} width
 * @param {number} height
 */
export function pointInRectangle(x, y, left, top, width, height, allDirection = false) {
  return allDirection
    ? (x > left && x < left + width && y > top && y < top + height) ||
        (x < left && x > left + width && y < top && y > top + height) ||
        (x > left && x < left + width && y < top && y > top + height) ||
        (x < left && x > left + width && y > top && y < top + height)
    : x > left && x < left + width && y > top && y < top + height
}

/**
 * Check if two instance are on diagonal axes
 * @param {object} instance
 * @param {object} instance
 */
export function cellIsDiag(src, target) {
  return Math.abs(target.i - src.i) === Math.abs(target.j - src.j)
}

export function degreeToDirection(degree) {
  if (degree > 67.5 && degree < 112.5) {
    return 'north'
  } else if (degree > 247.5 && degree < 292.5) {
    return 'south'
  } else if (degree > 337.5 || degree < 22.5) {
    return 'west'
  } else if (degree >= 22.5 && degree <= 67.5) {
    return 'northwest'
  } else if (degree >= 292.5 && degree <= 337.5) {
    return 'southwest'
  } else if (degree > 157.5 && degree < 202.5) {
    return 'est'
  } else if (degree > 112.5 && degree < 157.5) {
    return 'northest'
  } else if (degree > 202.5 && degree < 247.5) {
    return 'southest'
  }
}
