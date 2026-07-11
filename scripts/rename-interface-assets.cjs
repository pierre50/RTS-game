#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const interfaceRoot = path.join(root, 'public/assets/interface')
const manifestPath = path.join(root, 'app/config/assetManifest.ts')

const sheets = [
  ['50405', 'pointers/move-target', 'atlas'],
  ['50704', 'building-icons/egyptian', 'pngs'],
  ['50705', 'building-icons/greek', 'pngs'],
  ['50706', 'building-icons/babylonian', 'pngs'],
  ['50707', 'building-icons/asian', 'pngs'],
  ['50721', 'command-icons', 'pngs'],
  ['50729', 'technology-icons', 'pngs'],
  ['50730', 'unit-icons', 'pngs'],
  ['50731', 'attribute-icons', 'pngs'],
  ['50732', 'commodity-icons', 'pngs'],
  ['51000', 'pointers/main', 'pngs'],
]

function moveDirectory(fromId, toId) {
  const from = path.join(interfaceRoot, fromId)
  const to = path.join(interfaceRoot, toId)

  if (!fs.existsSync(from)) return false
  if (fs.existsSync(to)) {
    throw new Error(`Cannot rename interface/${fromId}: target exists at ${path.relative(root, to)}`)
  }

  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.renameSync(from, to)
  return true
}

function normalizePngNames(dir, legacyId) {
  if (!fs.existsSync(dir)) return 0
  let renamed = 0
  for (const file of fs.readdirSync(dir)) {
    const match = file.match(new RegExp(`^(\\d{3})_${legacyId}\\.png$`))
    if (!match) continue
    const from = path.join(dir, file)
    const to = path.join(dir, `${match[1]}.png`)
    if (fs.existsSync(to)) {
      throw new Error(`Cannot rename ${path.relative(root, from)}: target exists at ${path.relative(root, to)}`)
    }
    fs.renameSync(from, to)
    renamed += 1
  }
  return renamed
}

function normalizeAtlasKeys(dir, legacyId) {
  const file = path.join(dir, 'texture.json')
  if (!fs.existsSync(file)) return false
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  const frames = data.frames || {}
  const nextFrames = {}
  let changed = false

  for (const [key, value] of Object.entries(frames)) {
    const nextKey = key.replace(new RegExp(`^(\\d{3})_${legacyId}\\.png$`), '$1.png')
    nextFrames[nextKey] = value
    if (nextKey !== key) changed = true
  }

  if (!changed) return false
  data.frames = nextFrames
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
  return true
}

function updateManifest() {
  let source = fs.readFileSync(manifestPath, 'utf8')
  const before = source
  source = source.replace("    50405: 'assets/interface/50405/texture.json',", "    'pointers/move-target': 'assets/interface/pointers/move-target/texture.json',")
  if (source === before) return false
  fs.writeFileSync(manifestPath, source)
  return true
}

let moved = 0
let pngs = 0
let atlases = 0

for (const [legacyId, targetId, kind] of sheets) {
  if (moveDirectory(legacyId, targetId)) moved += 1
  const dir = path.join(interfaceRoot, targetId)
  if (kind === 'pngs') pngs += normalizePngNames(dir, legacyId)
  if (kind === 'atlas' && normalizeAtlasKeys(dir, legacyId)) atlases += 1
}

const manifestUpdated = updateManifest()

if (!moved && !pngs && !atlases && !manifestUpdated) {
  console.log('interface assets: nothing to migrate')
} else {
  console.log(`interface assets: moved ${moved} directories`)
  console.log(`interface assets: renamed ${pngs} png files`)
  if (atlases) console.log(`interface assets: normalized ${atlases} atlas files`)
  if (manifestUpdated) console.log('interface assets: updated assetManifest.ts')
}
