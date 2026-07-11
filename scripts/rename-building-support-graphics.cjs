#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const graphicsRoot = path.join(root, 'public/assets/graphics')
const assetManifestPath = path.join(root, 'app/config/assetManifest.ts')

const mappings = [
  ['256', 'buildings/construction/size-1'],
  ['258', 'buildings/construction/size-2'],
  ['261', 'buildings/construction/size-3'],
  ['356', 'buildings/construction/dock'],
  ['153', 'buildings/rubble/size-1'],
  ['154', 'buildings/rubble/size-2'],
  ['155', 'buildings/rubble/size-3'],
  ['239', 'buildings/rubble/farm-depleted'],
  ['358', 'buildings/rubble/dock'],
  ['347', 'effects/fire/light'],
  ['452', 'effects/fire/medium'],
  ['450', 'effects/fire/heavy'],
  ['599', 'buildings/walls/level-1/default'],
  ['25', 'buildings/walls/level-2/egyptian'],
  ['69', 'buildings/walls/level-2/greek'],
  ['113', 'buildings/walls/level-2/asian'],
  ['169', 'buildings/walls/level-2/babylonian'],
  ['23', 'buildings/walls/level-3/egyptian'],
  ['67', 'buildings/walls/level-3/greek'],
  ['111', 'buildings/walls/level-3/asian'],
  ['167', 'buildings/walls/level-3/babylonian'],
  ['598', 'buildings/walls/construction-flag'],
  ['459', 'ui/rally-point-flag'],
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

console.log(`renamed ${renamedCount} building support graphics directories`)
