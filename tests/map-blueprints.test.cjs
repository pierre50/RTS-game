const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const test = require('node:test')

const ROOT = path.join(__dirname, '..')
const TERRAIN_TYPES = ['Grass', 'Desert', 'Water', 'Jungle', 'DarkForest', 'DeepWater']

function getWaterBorderFrame({ n, s, w, e, nw, ne, sw, se }) {
  if (w && n) return '001'
  if (e && s) return '002'
  if (w && s) return '003'
  if (e && n) return '000'
  if (n) return '008'
  if (s) return '009'
  if (w) return '011'
  if (e) return '010'
  if (nw) return '005'
  if (sw) return '007'
  if (ne) return '004'
  if (se) return '006'
  return null
}

test('pregenerated map blueprints persist deep water terrain', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'map-blueprint-'))

  try {
    execFileSync(
      process.execPath,
      [
        path.join(ROOT, 'tools/generate-maps.cjs'),
        '--size',
        '144',
        '--count',
        '1',
        '--seed',
        '98765',
        '--out',
        out,
      ],
      { cwd: ROOT, stdio: 'pipe' }
    )

    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'))
    assert.equal(Object.hasOwn(manifest.maps[0], 'mapType'), false, 'manifest should not split maps by type')
    assert.match(manifest.maps[0].path, /^144\/map-144-001\.map$/, 'blueprint path should be grouped by size only')
    const blueprint = JSON.parse(fs.readFileSync(path.join(out, manifest.maps[0].path), 'utf8'))
    assert.equal(Object.hasOwn(blueprint, 'mapType'), false, 'blueprint payload should not store a map type')
    const terrain = Buffer.from(blueprint.terrain, 'base64')
    const relief = Buffer.from(blueprint.relief, 'base64')
    const width = blueprint.size + 1
    let deepWaterBorderCandidates = 0
    let shoreLevelViolations = 0
    let reliefStepViolations = 0
    let waterBufferViolations = 0
    let spawnPlateauViolations = 0

    const isWater = (i, j) => {
      const type = TERRAIN_TYPES[terrain[i * width + j]]
      return type === 'Water' || type === 'DeepWater'
    }
    const getRelief = (i, j) => relief.readInt8(i * width + j)

    const waterDistances = new Int16Array(width * width).fill(32767)
    const waterQueue = []
    for (let i = 0; i <= blueprint.size; i++) {
      for (let j = 0; j <= blueprint.size; j++) {
        if (!isWater(i, j)) continue
        const index = i * width + j
        waterDistances[index] = 0
        waterQueue.push(index)
      }
    }
    for (let cursor = 0; cursor < waterQueue.length; cursor++) {
      const index = waterQueue[cursor]
      const i = Math.floor(index / width)
      const j = index % width
      for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const ni = i + di
        const nj = j + dj
        if (ni < 0 || ni > blueprint.size || nj < 0 || nj > blueprint.size) continue
        const next = ni * width + nj
        if (waterDistances[next] <= waterDistances[index] + 1) continue
        waterDistances[next] = waterDistances[index] + 1
        waterQueue.push(next)
      }
    }

    for (let i = 0; i <= blueprint.size; i++) {
      for (let j = 0; j <= blueprint.size; j++) {
        if (terrain[i * width + j] !== 5) continue
        const touchesNonDeepWater = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ].some(([di, dj]) => {
          const ni = i + di
          const nj = j + dj
          return ni < 0 || ni > blueprint.size || nj < 0 || nj > blueprint.size || terrain[ni * width + nj] !== 5
        })
        if (touchesNonDeepWater) deepWaterBorderCandidates++
      }
    }

    for (let i = 0; i <= blueprint.size; i++) {
      for (let j = 0; j <= blueprint.size; j++) {
        if (waterDistances[i * width + j] <= 3 && getRelief(i, j) !== 0) waterBufferViolations++
        if (isWater(i, j)) continue
        const flags = {
          n: i > 0 && isWater(i - 1, j),
          s: i < blueprint.size && isWater(i + 1, j),
          w: j > 0 && isWater(i, j - 1),
          e: j < blueprint.size && isWater(i, j + 1),
          nw: i > 0 && j > 0 && isWater(i - 1, j - 1),
          ne: i > 0 && j < blueprint.size && isWater(i - 1, j + 1),
          sw: i < blueprint.size && j > 0 && isWater(i + 1, j - 1),
          se: i < blueprint.size && j < blueprint.size && isWater(i + 1, j + 1),
        }
        if (!getWaterBorderFrame(flags)) continue

        let shoreLevel = getRelief(i, j)
        for (const [di, dj] of [
          [-1, 0],
          [-1, 1],
          [0, 1],
          [1, 1],
          [1, 0],
          [1, -1],
          [0, -1],
          [-1, -1],
        ]) {
          const ni = i + di
          const nj = j + dj
          if (ni >= 0 && ni <= blueprint.size && nj >= 0 && nj <= blueprint.size && isWater(ni, nj)) {
            shoreLevel = getRelief(ni, nj)
            break
          }
        }
        if (getRelief(i, j) !== shoreLevel) shoreLevelViolations++
      }
    }

    for (const spawn of blueprint.spawns || []) {
      for (let i = Math.max(0, spawn.i - 6); i <= Math.min(blueprint.size, spawn.i + 6); i++) {
        for (let j = Math.max(0, spawn.j - 6); j <= Math.min(blueprint.size, spawn.j + 6); j++) {
          if (getRelief(i, j) !== 0) spawnPlateauViolations++
        }
      }
    }

    for (let i = 0; i <= blueprint.size; i++) {
      for (let j = 0; j <= blueprint.size; j++) {
        if (isWater(i, j)) continue
        for (const [di, dj] of [
          [0, 1],
          [1, -1],
          [1, 0],
          [1, 1],
        ]) {
          const ni = i + di
          const nj = j + dj
          if (ni < 0 || ni > blueprint.size || nj < 0 || nj > blueprint.size || isWater(ni, nj)) continue
          if (Math.abs(getRelief(i, j) - getRelief(ni, nj)) > 1) reliefStepViolations++
        }
      }
    }

    assert.ok(terrain.includes(5), 'blueprint terrain should include DeepWater cells')
    assert.ok(deepWaterBorderCandidates > 0, 'blueprint terrain should include DeepWater border candidates')
    assert.equal(shoreLevelViolations, 0, 'blueprint relief should keep shore cells at water level')
    assert.equal(waterBufferViolations, 0, 'blueprint relief should keep a three-cell water buffer at z=0')
    assert.equal(spawnPlateauViolations, 0, 'blueprint relief should keep Town Center spawn zones at z=0')
    assert.equal(reliefStepViolations, 0, 'blueprint relief should not contain unsupported height jumps')
    assert.equal(
      (blueprint.resources || []).some(resource => resource.type === 'Whale'),
      false,
      'blueprint resources should not bake whales before runtime deep-water classification'
    )
  } finally {
    fs.rmSync(out, { recursive: true, force: true })
  }
})
