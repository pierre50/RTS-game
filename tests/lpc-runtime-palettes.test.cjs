const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const repoRoot = path.join(__dirname, '..')

test('runtime LPC palettes are generated from Python LPC config', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rts-palettes-'))
  const generated = path.join(tempDir, 'generatedPalettes.ts')
  execFileSync('python3', ['scripts/lpc/export_runtime_palettes.py', '--out', generated], {
    cwd: repoRoot,
    stdio: 'pipe',
  })

  const expected = fs.readFileSync(generated, 'utf8')
  const actual = fs.readFileSync(path.join(repoRoot, 'app/lib/lpc/generatedPalettes.ts'), 'utf8')
  assert.equal(actual, expected)
})
