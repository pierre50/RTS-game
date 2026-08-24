const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function closestPointOnSegment(point, a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return a
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq))
  return { x: a.x + t * dx, y: a.y + t * dy }
}

function pointIsInsidePolygon(points, point) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x
    const yi = points[i].y
    const xj = points[j].x
    const yj = points[j].y
    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function distanceToPolygon(points, point) {
  if (pointIsInsidePolygon(points, point)) return 0
  let minDistance = Infinity
  for (let index = 0; index < points.length; index++) {
    const closest = closestPointOnSegment(point, points[index], points[(index + 1) % points.length])
    minDistance = Math.min(minDistance, Math.hypot(point.x - closest.x, point.y - closest.y))
  }
  return minDistance
}

function loadHeroActionRange({ contact = () => false, heroControlled = () => true } = {}) {
  const filename = path.join(__dirname, '../app/lib/heroActionRange.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '../constants': {
      CELL_HEIGHT: 32,
      ACTION_TYPES: { takemeat: 'takemeat' },
      FAMILY_TYPES: { animal: 'animal', building: 'building', resource: 'resource' },
    },
    './grid/cells': {
      getBuildingContactDistance: size => Math.floor(((size ?? 1) - 1) / 2) + 1,
    },
    './grid/movement': {
      instanceContactInstance: contact,
    },
    './graphics/selection': {
      getRoundedIsoShapePoints: ({ x = 0, y = 0, factor = 1 } = {}) => [
        { x, y: y - 16 * factor },
        { x: x + 32 * factor, y },
        { x, y: y + 16 * factor },
        { x: x - 32 * factor, y },
      ],
    },
    './geometry/polygon': {
      closestPointOnSegment,
      distanceToPolygon,
      pointIsInsidePolygon,
    },
    './maths': {
      instancesDistance: (a, b) => Math.hypot((a.i ?? 0) - (b.i ?? 0), (a.j ?? 0) - (b.j ?? 0)),
    },
    './unitControl': {
      isHeroControlled: heroControlled,
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('hero interaction range accepts the long side of an isometric building footprint', () => {
  const { isHeroInteractionTargetReachable } = loadHeroActionRange()
  const hero = { controlMode: 'hero', i: 0, j: 0, x: 16, y: -36 }
  const building = {
    family: 'building',
    i: 0,
    isDestroyed: false,
    j: 0,
    size: 1,
    x: 0,
    y: 0,
  }

  assert.equal(isHeroInteractionTargetReachable(hero, null, building), true)
})

test('hero interaction aim uses the closest footprint edge for large resources', () => {
  const { getHeroInteractionTargetPoint } = loadHeroActionRange()
  const hero = { controlMode: 'hero', i: 0, j: 0, x: 0, y: -70 }
  const portal = {
    family: 'resource',
    i: 0,
    isDestroyed: false,
    j: 0,
    size: 3,
    type: 'Portal',
    x: 0,
    y: 0,
  }

  assert.deepEqual(getHeroInteractionTargetPoint(hero, portal), { x: 0, y: -48 })
})

test('hero interaction keeps a forgiving band around large building-like resources', () => {
  const { isHeroInteractionTargetReachable } = loadHeroActionRange()
  const hero = { controlMode: 'hero', i: 0, j: 0, x: 0, y: -112 }
  const portal = {
    family: 'resource',
    i: 0,
    isDestroyed: false,
    j: 0,
    selectionFactor: 3,
    size: 3,
    type: 'Portal',
    x: 0,
    y: 0,
  }

  assert.equal(isHeroInteractionTargetReachable(hero, null, portal), true)
})

test('hero resource interaction footprint can be widened independently from pathing size', () => {
  const { getHeroInteractionTargetPoint, isHeroInteractionTargetReachable } = loadHeroActionRange()
  const hero = { controlMode: 'hero', i: 0, j: 0, x: 0, y: -64 }
  const tree = {
    family: 'resource',
    i: 0,
    isDestroyed: false,
    j: 0,
    selectionFactor: 2,
    size: 1,
    type: 'Tree',
    x: 0,
    y: 0,
  }

  assert.deepEqual(getHeroInteractionTargetPoint(hero, tree), { x: 0, y: -32 })
  assert.equal(isHeroInteractionTargetReachable(hero, 'chopwood', tree), true)
})

test('hero interaction range still falls back to strict contact for regular targets', () => {
  const { isHeroInteractionTargetReachable } = loadHeroActionRange({ contact: () => true })
  const hero = { controlMode: 'hero', i: 0, j: 0, x: 0, y: 0 }
  const unit = {
    family: 'unit',
    i: 1,
    isDestroyed: false,
    j: 0,
    x: 48,
    y: 0,
  }

  assert.equal(isHeroInteractionTargetReachable(hero, null, unit), true)
})
