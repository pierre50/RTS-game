#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const graphicsRoot = path.join(root, 'public/assets/graphics')
const resourcesPath = path.join(root, 'public/assets/data/gameplay/resources.json')
const assetManifestPath = path.join(root, 'app/config/assetManifest.ts')

const mappings = [
  ['240', 'resources/berrybush'],
  ['492', 'resources/tree/grass-1'],
  ['493', 'resources/tree/grass-2'],
  ['494', 'resources/tree/grass-3'],
  ['495', 'resources/tree/grass-4'],
  ['503', 'resources/tree/grass-5'],
  ['505', 'resources/tree/grass-6'],
  ['509', 'resources/tree/grass-7'],
  ['463', 'resources/tree/palm-1'],
  ['464', 'resources/tree/palm-2'],
  ['465', 'resources/tree/palm-3'],
  ['466', 'resources/tree/palm-4'],
  ['468', 'resources/tree/dark-forest-1'],
  ['469', 'resources/tree/dark-forest-2'],
  ['470', 'resources/tree/dark-forest-3'],
  ['471', 'resources/tree/dark-forest-4'],
  ['623', 'resources/tree/fallen'],
  ['636', 'resources/tree/stump'],
  ['481', 'resources/gold'],
  ['622', 'resources/stone'],
  ['594', 'resources/fish/small'],
  ['689', 'resources/fish/whale'],
]

const renameMap = new Map(mappings)

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

function replaceResourceSheetIds(value) {
  if (typeof value === 'string') return renameMap.get(value) ?? value
  if (Array.isArray(value)) return value.map(replaceResourceSheetIds)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, replaceResourceSheetIds(nested)]))
}

function replaceManifestSheetIds(source) {
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

const resources = JSON.parse(fs.readFileSync(resourcesPath, 'utf8'))
const nextResources = replaceResourceSheetIds(resources)
fs.writeFileSync(resourcesPath, `${JSON.stringify(nextResources, null, 2)}\n`)

const manifest = fs.readFileSync(assetManifestPath, 'utf8')
fs.writeFileSync(assetManifestPath, replaceManifestSheetIds(manifest))

console.log(`renamed ${renamedCount} resource graphics directories`)
