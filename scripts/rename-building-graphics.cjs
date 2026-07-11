#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const graphicsRoot = path.join(root, 'public/assets/graphics')
const assetManifestPath = path.join(root, 'app/config/assetManifest.ts')
const ambientPath = path.join(root, 'app/constants/ambient.ts')
const civilizationPaths = [
  path.join(root, 'public/assets/data/civilizations/greek.json'),
  path.join(root, 'public/assets/data/civilizations/egyptian.json'),
  path.join(root, 'public/assets/data/civilizations/asian.json'),
  path.join(root, 'public/assets/data/civilizations/babylonian.json'),
]

const mappings = [
  ['280', 'buildings/shared/town-center/multi-age'],
  ['254', 'buildings/shared/barracks/age-0'],
  ['218', 'buildings/shared/house/age-0'],
  ['64', 'buildings/greek/granary/multi-age'],
  ['527', 'buildings/shared/storage-pit/age-0'],
  ['355', 'buildings/shared/dock/age-0'],
  ['532', 'environment/ground/stone-set-2'],
  ['65', 'buildings/greek/house/multi-age'],
  ['447', 'buildings/shared/farm/age-1'],
  ['688', 'buildings/shared/watch-tower/age-1'],
  ['500', 'buildings/shared/market/age-1'],
  ['609', 'buildings/shared/stable/age-1'],
  ['72', 'buildings/greek/stable/multi-age'],
  ['71', 'buildings/greek/archery-range/multi-age'],
  ['61', 'buildings/greek/barracks/multi-age'],
  ['62', 'buildings/greek/town-center/multi-age'],
  ['68', 'buildings/greek/market/multi-age'],
  ['70', 'buildings/greek/storage-pit/multi-age'],
  ['66', 'buildings/greek/government-center/multi-age'],
  ['60', 'buildings/greek/academy/age-2'],
  ['63', 'buildings/greek/siege-workshop/age-2'],
  ['73', 'buildings/greek/temple/multi-age'],
  ['593', 'buildings/shared/sentry-tower/age-2'],
  ['75', 'buildings/greek/guard-tower/age-3'],
  ['20', 'buildings/egyptian/granary/multi-age'],
  ['21', 'buildings/egyptian/house/multi-age'],
  ['28', 'buildings/egyptian/stable/multi-age'],
  ['27', 'buildings/egyptian/archery-range/multi-age'],
  ['17', 'buildings/egyptian/barracks/multi-age'],
  ['18', 'buildings/egyptian/town-center/multi-age'],
  ['24', 'buildings/egyptian/market/multi-age'],
  ['26', 'buildings/egyptian/storage-pit/multi-age'],
  ['22', 'buildings/egyptian/government-center/multi-age'],
  ['16', 'buildings/egyptian/academy/age-2'],
  ['19', 'buildings/egyptian/siege-workshop/age-2'],
  ['29', 'buildings/egyptian/temple/multi-age'],
  ['31', 'buildings/egyptian/guard-tower/age-3'],
  ['108', 'buildings/asian/granary/multi-age'],
  ['109', 'buildings/asian/house/multi-age'],
  ['116', 'buildings/asian/stable/multi-age'],
  ['115', 'buildings/asian/archery-range/multi-age'],
  ['105', 'buildings/asian/barracks/multi-age'],
  ['106', 'buildings/asian/town-center/multi-age'],
  ['112', 'buildings/asian/market/multi-age'],
  ['114', 'buildings/asian/storage-pit/multi-age'],
  ['110', 'buildings/asian/government-center/multi-age'],
  ['104', 'buildings/asian/academy/age-2'],
  ['107', 'buildings/asian/siege-workshop/age-2'],
  ['117', 'buildings/asian/temple/multi-age'],
  ['119', 'buildings/asian/guard-tower/age-3'],
  ['164', 'buildings/babylonian/granary/multi-age'],
  ['165', 'buildings/babylonian/house/multi-age'],
  ['172', 'buildings/babylonian/stable/multi-age'],
  ['171', 'buildings/babylonian/archery-range/multi-age'],
  ['161', 'buildings/babylonian/barracks/multi-age'],
  ['162', 'buildings/babylonian/town-center/multi-age'],
  ['168', 'buildings/babylonian/market/multi-age'],
  ['170', 'buildings/babylonian/storage-pit/multi-age'],
  ['166', 'buildings/babylonian/government-center/multi-age'],
  ['160', 'buildings/babylonian/academy/age-2'],
  ['163', 'buildings/babylonian/siege-workshop/age-2'],
  ['173', 'buildings/babylonian/temple/multi-age'],
  ['175', 'buildings/babylonian/guard-tower/age-3'],
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

function replaceSheetIds(value) {
  if (typeof value === 'string') return renameMap.get(value) ?? value
  if (Array.isArray(value)) return value.map(replaceSheetIds)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, replaceSheetIds(nested)]))
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

for (const file of civilizationPaths) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  fs.writeFileSync(file, `${JSON.stringify(replaceSheetIds(data), null, 2)}\n`)
}

fs.writeFileSync(assetManifestPath, replaceQuotedSheetIds(fs.readFileSync(assetManifestPath, 'utf8')))
fs.writeFileSync(ambientPath, replaceQuotedSheetIds(fs.readFileSync(ambientPath, 'utf8')))

console.log(`renamed ${renamedCount} building graphics directories`)
