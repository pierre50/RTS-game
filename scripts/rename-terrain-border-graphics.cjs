#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

const renames = [
  ['public/assets/terrain/15000', 'public/assets/terrain/desert'],
  ['public/assets/terrain/15001', 'public/assets/terrain/grass'],
  ['public/assets/terrain/15002', 'public/assets/terrain/water'],
  ['public/assets/terrain/15003', 'public/assets/terrain/deep-water'],
  ['public/assets/border/20000', 'public/assets/border/water-borders/desert'],
  ['public/assets/border/20002', 'public/assets/border/relief-borders/desert'],
  ['public/assets/border/20006', 'public/assets/border/relief-borders/water'],
]

const textureRefNames = new Map([
  ['15000', 'terrain/desert'],
  ['15001', 'terrain/grass'],
  ['15002', 'terrain/water'],
  ['15003', 'terrain/deep-water'],
])

const manifestReplacements = [
  [
    "    15000: 'assets/terrain/15000/texture.json',",
    "    'terrain/desert': 'assets/terrain/desert/texture.json',",
  ],
  [
    "    15001: 'assets/terrain/15001/texture.json',",
    "    'terrain/grass': 'assets/terrain/grass/texture.json',",
  ],
  [
    "    15002: 'assets/terrain/15002/texture.json',",
    "    'terrain/water': 'assets/terrain/water/texture.json',",
  ],
  [
    "    15003: 'assets/terrain/15003/texture.json',",
    "    'terrain/deep-water': 'assets/terrain/deep-water/texture.json',",
  ],
  [
    "    20000: 'assets/border/20000/texture.json',",
    "    'water-borders/desert': 'assets/border/water-borders/desert/texture.json',",
  ],
  [
    "    20002: 'assets/border/20002/texture.json',",
    "    'relief-borders/desert': 'assets/border/relief-borders/desert/texture.json',",
  ],
  [
    "    20006: 'assets/border/20006/texture.json',",
    "    'relief-borders/water': 'assets/border/relief-borders/water/texture.json',",
  ],
]

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function renameDirectory(from, to) {
  if (!exists(from)) return false
  if (exists(to)) {
    throw new Error(`Cannot rename ${from}: destination already exists (${to})`)
  }
  fs.mkdirSync(path.dirname(path.join(root, to)), { recursive: true })
  fs.renameSync(path.join(root, from), path.join(root, to))
  return true
}

function replaceJsonStrings(value) {
  if (Array.isArray(value)) return value.map(replaceJsonStrings)
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      value[key] = replaceJsonStrings(child)
    }
    return value
  }
  if (typeof value === 'string') return textureRefNames.get(value) || value
  return value
}

function updateCellsJson() {
  const file = path.join(root, 'public/assets/data/gameplay/cells.json')
  const before = fs.readFileSync(file, 'utf8')
  const data = replaceJsonStrings(JSON.parse(before))
  const after = `${JSON.stringify(data, null, 2)}\n`
  if (after === before) return false
  fs.writeFileSync(file, after)
  return true
}

function updateManifest() {
  const file = path.join(root, 'app/config/assetManifest.ts')
  let source = fs.readFileSync(file, 'utf8')
  const before = source
  for (const [from, to] of manifestReplacements) {
    source = source.replace(from, to)
  }
  if (source === before) return false
  fs.writeFileSync(file, source)
  return true
}

let renamed = 0
for (const [from, to] of renames) {
  if (renameDirectory(from, to)) renamed += 1
}

const touched = []
if (updateCellsJson()) touched.push('cells.json')
if (updateManifest()) touched.push('assetManifest.ts')

if (!renamed && !touched.length) {
  console.log('terrain/border graphics: nothing to migrate')
} else {
  console.log(`terrain/border graphics: renamed ${renamed} directories`)
  if (touched.length) console.log(`terrain/border graphics: updated ${touched.join(', ')}`)
}
