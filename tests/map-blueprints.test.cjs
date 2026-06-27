const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFileSync } = require('node:child_process')
const test = require('node:test')

const ROOT = path.join(__dirname, '..')

test('pregenerated map blueprints persist deep water terrain', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'rts-map-blueprint-'))

  try {
    execFileSync(
      process.execPath,
      [
        path.join(ROOT, 'tools/generate-rtsmaps.cjs'),
        '--size',
        '144',
        '--type',
        'ilot',
        '--count',
        '1',
        '--seed',
        '424242',
        '--out',
        out,
      ],
      { cwd: ROOT, stdio: 'pipe' }
    )

    const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'))
    const blueprint = JSON.parse(fs.readFileSync(path.join(out, manifest.maps[0].path), 'utf8'))
    const terrain = Buffer.from(blueprint.terrain, 'base64')
    const width = blueprint.size + 1
    let deepWaterBorderCandidates = 0

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

    assert.ok(terrain.includes(5), 'blueprint terrain should include DeepWater cells')
    assert.ok(deepWaterBorderCandidates > 0, 'blueprint terrain should include DeepWater border candidates')
    assert.equal(
      (blueprint.resources || []).some(resource => resource.type === 'Whale'),
      false,
      'blueprint resources should not bake whales before runtime deep-water classification'
    )
  } finally {
    fs.rmSync(out, { recursive: true, force: true })
  }
})
