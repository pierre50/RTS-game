const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const ATLAS_ROOTS = ['public/assets/graphics', 'public/assets/terrain', 'public/assets/border']
const SUFFIXED_FRAME_KEY = /^(\d+)_.*\.png$/

function findTextureJsonFiles(dir) {
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...findTextureJsonFiles(fullPath))
    if (entry.isFile() && entry.name === 'texture.json') files.push(fullPath)
  }
  return files
}

function normalizeFrameKey(key) {
  const match = key.match(SUFFIXED_FRAME_KEY)
  return match ? `${match[1]}.png` : key
}

function migrateAtlas(file) {
  const before = fs.readFileSync(file, 'utf8')
  const atlas = JSON.parse(before)
  if (!atlas.frames || typeof atlas.frames !== 'object') return false

  const frames = {}
  for (const [key, frame] of Object.entries(atlas.frames)) {
    const nextKey = normalizeFrameKey(key)
    if (frames[nextKey]) {
      throw new Error(`Frame key collision in ${path.relative(ROOT, file)}: ${key} -> ${nextKey}`)
    }
    frames[nextKey] = frame
  }

  atlas.frames = frames
  const after = `${JSON.stringify(atlas, null, 2)}\n`
  if (before === after) return false
  fs.writeFileSync(file, after)
  return true
}

let changed = 0
for (const relativeRoot of ATLAS_ROOTS) {
  const root = path.join(ROOT, relativeRoot)
  for (const file of findTextureJsonFiles(root)) {
    if (migrateAtlas(file)) {
      changed += 1
    }
  }
}

console.log(changed ? `migrated ${changed} atlas files` : 'nothing to migrate')
