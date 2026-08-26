const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadModule(relativePath, mocks) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('reachable flee cell falls back across the threat line when the opposite side has no path', () => {
  const grid = Array.from({ length: 7 }, (_, i) =>
    Array.from({ length: 7 }, (_, j) => ({ i, j, solid: false, category: 'Land' }))
  )
  const { findReachableFleeCell } = loadModule('app/lib/grid/flee.ts', {
    '../maths': { pointsDistance: (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by) },
    './cells': {
      getCellsAroundPoint: (i, j, grid, range, condition) => {
        const cells = []
        for (let x = Math.max(0, i - range); x <= Math.min(grid.length - 1, i + range); x++) {
          for (let y = Math.max(0, j - range); y <= Math.min(grid[x].length - 1, j + range); y++) {
            if (Math.abs(x - i) + Math.abs(y - j) > range) continue
            const cell = grid[x][y]
            if (!condition || condition(cell)) cells.push(cell)
          }
        }
        return cells
      },
    },
    './movement': {
      getInstancePath: (_instance, i, _j) => (i < 3 ? [grid[i][3]] : []),
    },
  })

  const animal = { i: 3, j: 3 }
  const hero = { i: 1, j: 3 }
  const cell = findReachableFleeCell(animal, hero, { grid }, { range: 3 })

  assert.ok(cell)
  assert.equal(cell.i < animal.i, true)
})
