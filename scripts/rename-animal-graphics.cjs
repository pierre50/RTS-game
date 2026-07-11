#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const graphicsRoot = path.join(root, 'public/assets/graphics')
const animalsPath = path.join(root, 'public/assets/data/gameplay/animals.json')
const assetManifestPath = path.join(root, 'app/config/assetManifest.ts')

const mappings = [
  ['479', 'animals/gazelle/standing'],
  ['478', 'animals/gazelle/walking'],
  ['480', 'animals/gazelle/running'],
  ['331', 'animals/gazelle/dying'],
  ['392', 'animals/gazelle/corpse'],
  ['215', 'animals/elephant/action'],
  ['428', 'animals/elephant/standing'],
  ['667', 'animals/elephant/walking'],
  ['324', 'animals/elephant/dying'],
  ['386', 'animals/elephant/corpse'],
  ['217', 'animals/crocodile/action'],
  ['433', 'animals/crocodile/standing'],
  ['673', 'animals/crocodile/walking'],
  ['330', 'animals/crocodile/dying'],
  ['391', 'animals/crocodile/corpse'],
  ['222', 'animals/lion/action'],
  ['497', 'animals/lion/standing'],
  ['680', 'animals/lion/walking'],
  ['336', 'animals/lion/dying'],
  ['397', 'animals/lion/corpse'],
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

function replaceAnimalSheetIds(value) {
  if (typeof value === 'string') return renameMap.get(value) ?? value
  if (Array.isArray(value)) return value.map(replaceAnimalSheetIds)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, replaceAnimalSheetIds(nested)]))
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

const animals = JSON.parse(fs.readFileSync(animalsPath, 'utf8'))
const nextAnimals = replaceAnimalSheetIds(animals)
fs.writeFileSync(animalsPath, `${JSON.stringify(nextAnimals, null, 2)}\n`)

const manifest = fs.readFileSync(assetManifestPath, 'utf8')
fs.writeFileSync(assetManifestPath, replaceManifestSheetIds(manifest))

console.log(`renamed ${renamedCount} animal graphics directories`)
