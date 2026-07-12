#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const graphicsRoot = path.join(root, 'public/assets/graphics')
const assetManifestPath = path.join(root, 'app/config/assetManifest.ts')

const mappings = [
  ['15', 'buildings/egyptian/dock/age-2'],
  ['37', 'buildings/egyptian/dock/age-2-large'],
  ['59', 'buildings/greek/dock/age-2'],
  ['81', 'buildings/greek/dock/age-2-large'],
  ['103', 'buildings/asian/dock/age-2'],
  ['125', 'buildings/asian/dock/age-2-large'],
  ['159', 'buildings/babylonian/dock/age-2'],
  ['181', 'buildings/babylonian/dock/age-2-large'],
  ['50', 'buildings/egyptian/guard-tower/age-3-large'],
  ['94', 'buildings/greek/guard-tower/age-3-large'],
  ['138', 'buildings/asian/guard-tower/age-3-large'],
  ['194', 'buildings/babylonian/guard-tower/age-3-large'],
  ['86', 'buildings/walls/level-3/greek-large'],
  ['88', 'buildings/walls/level-2/greek-large'],
  ['238', 'buildings/walls/level-1/dithered'],
  ['327', 'units/villager/hunter/dying-alternate'],
  ['339', 'units/villager/miner/dying-alternate'],
  ['393', 'units/villager/fisher/corpse'],
  ['406', 'environment/birds/eagle/body'],
  ['407', 'environment/birds/eagle/shadow'],
  ['520', 'environment/birds/hawk/shadow'],
  ['521', 'environment/birds/hawk/body'],
  ['458', 'resources/fish/salmon'],
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

fs.writeFileSync(assetManifestPath, replaceQuotedSheetIds(fs.readFileSync(assetManifestPath, 'utf8')))

console.log(`renamed ${renamedCount} remaining numeric graphics directories`)
