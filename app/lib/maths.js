import { cellWidth, cellHeight, cellDepth } from '../constants'

export function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
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
  return [Math.floor(((x - y) * cellWidth) / 2), Math.floor(((x + y) * cellHeight) / 2)]
}

/**
 * Convert isometric position to cartesian
 * @param {number} x
 * @param {number} y
 */
export function isometricToCartesian(x, y) {
  return [
    Math.round((x / (cellWidth / 2) + y / (cellHeight / 2)) / 2),
    Math.round((y / (cellHeight / 2) - x / (cellWidth / 2)) / 2),
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
 * Check if point is between two points can be used with line thickness
 * @param {object} line1
 * @param {object} line2
 * @param {object} pnt
 * @param {number} lineThickness
 */
export function pointIsBetweenTwoPoint(line1, line2, pnt, lineThickness) {
  let L2 = (line2.x - line1.x) * (line2.x - line1.x) + (line2.y - line1.y) * (line2.y - line1.y)
  if (L2 == 0) return false
  let r = ((pnt.x - line1.x) * (line2.x - line1.x) + (pnt.y - line1.y) * (line2.y - line1.y)) / L2
  if (r < 0) {
    return Math.sqrt((line1.x - pnt.x) * (line1.x - pnt.x) + (line1.y - pnt.y) * (line1.y - pnt.y)) <= lineThickness
  } else if (0 <= r && r <= 1) {
    let s = ((line1.y - pnt.y) * (line2.x - line1.x) - (line1.x - pnt.x) * (line2.y - line1.y)) / L2
    return Math.abs(s) * Math.sqrt(L2) <= lineThickness
  } else {
    return Math.sqrt((line2.x - pnt.x) * (line2.x - pnt.x) + (line2.y - pnt.y) * (line2.y - pnt.y)) <= lineThickness
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
export function randomItem(array) {
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
  const pos = isometricToCartesian(instance.x, instance.y + instance.z * cellDepth)
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
  let tX = x - instance.x
  let tY = y - instance.y
  return Math.round((Math.atan2(tY, tX) * 180) / Math.PI + 180)
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
