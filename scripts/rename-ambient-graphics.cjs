#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const graphicsRoot = path.join(root, 'public/assets/graphics')
const assetManifestPath = path.join(root, 'app/config/assetManifest.ts')
const ambientPath = path.join(root, 'app/constants/ambient.ts')
const mapEditorPath = path.join(root, 'app/screens/MapEditor.ts')

const mappings = [
  ['292', 'environment/floor/grass-1'],
  ['293', 'environment/floor/grass-2'],
  ['294', 'environment/floor/grass-3'],
  ['295', 'environment/floor/grass-4'],
  ['296', 'environment/floor/grass-5'],
  ['297', 'environment/floor/grass-6'],
  ['298', 'environment/floor/grass-7'],
  ['299', 'environment/floor/grass-8'],
  ['300', 'environment/floor/grass-9'],
  ['301', 'environment/floor/grass-10'],
  ['10', 'environment/floor/desert-1'],
  ['11', 'environment/floor/desert-2'],
  ['12', 'environment/floor/desert-3'],
  ['275', 'environment/floor/desert-4'],
  ['276', 'environment/floor/desert-5'],
  ['277', 'environment/floor/desert-6'],
  ['278', 'environment/floor/desert-7'],
  ['303', 'environment/floor/desert-8'],
  ['304', 'environment/floor/desert-9'],
  ['305', 'environment/floor/desert-10'],
  ['306', 'environment/floor/desert-11'],
  ['307', 'environment/floor/desert-12'],
  ['531', 'environment/ground/stone-set-1'],
  ['532', 'environment/ground/stone-set-2'],
  ['533', 'environment/ground/stone-set-3'],
  ['534', 'environment/ground/stone-set-4'],
  ['546', 'environment/water/shore-set-1'],
  ['547', 'environment/water/shore-set-2'],
  ['550', 'environment/water/shore-set-3'],
  ['551', 'environment/water/shore-set-4'],
  ['552', 'environment/water/shore-set-5'],
  ['553', 'environment/water/shore-set-6'],
  ['554', 'environment/water/shore-set-7'],
  ['555', 'environment/water/shore-set-8'],
  ['556', 'environment/water/shore-set-9'],
  ['557', 'environment/water/shore-set-10'],
  ['548', 'environment/water/deep-set-1'],
  ['549', 'environment/water/deep-set-2'],
  ['404', 'environment/birds/small/body'],
  ['405', 'environment/birds/small/shadow'],
  ['518', 'environment/birds/large/body'],
  ['519', 'environment/birds/large/shadow'],
]

function renameDirectory(fromId, toId) {
  const from = path.join(graphicsRoot, fromId)
  const to = path.join(graphicsRoot, toId)

  if (!fs.existsSync(from)) {
    if (fs.existsSync(to)) return false
    throw new Error(`Missing source graphics directory: ${path.relative(root, from)}`)
  }

  if (fs.existsSync(to)) {
    throw new Error(`Cannot rename ${fromId}: target already exists at ${path.relative(root, to)}`)
  }

  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.renameSync(from, to)
  return true
}

function replaceQuotedSheetIds(source) {
  let next = source

  for (const [fromId, toId] of mappings) {
    next = next.replace(new RegExp(`'${fromId}'`, 'g'), `'${toId}'`)
  }

  return next
}

let renamedCount = 0
for (const [fromId, toId] of mappings) {
  if (renameDirectory(fromId, toId)) renamedCount += 1
}

for (const file of [assetManifestPath, ambientPath, mapEditorPath]) {
  fs.writeFileSync(file, replaceQuotedSheetIds(fs.readFileSync(file, 'utf8')))
}

console.log(`renamed ${renamedCount} ambient graphics directories`)
