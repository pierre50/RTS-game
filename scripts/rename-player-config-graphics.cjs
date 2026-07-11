#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const graphicsRoot = path.join(root, 'public/assets/graphics')
const assetManifestPath = path.join(root, 'app/config/assetManifest.ts')
const playerConfigPath = path.join(root, 'app/config/playerConfig.ts')

const mappings = [
  ['607', 'units/trooper/default/standing'],
  ['603', 'units/trooper/default/walking'],
  ['604', 'units/trooper/default/action'],
  ['606', 'units/trooper/default/dying'],
  ['605', 'units/trooper/default/corpse'],
  ['715', 'units/supercar/body'],
  ['713', 'units/supercar/walking'],
  ['322', 'units/supercar/dying'],
  ['381', 'units/supercar/corpse'],
  ['438', 'units/phalanx/standing'],
  ['679', 'units/phalanx/walking'],
  ['221', 'units/phalanx/action'],
  ['335', 'units/phalanx/dying'],
  ['396', 'units/phalanx/corpse'],
  ['422', 'units/horse-archer/standing'],
  ['661', 'units/horse-archer/walking'],
  ['209', 'units/horse-archer/action'],
  ['318', 'units/horse-archer/dying'],
  ['377', 'units/horse-archer/corpse'],
  ['426', 'units/chariot/standing'],
  ['665', 'units/chariot/walking'],
  ['213', 'units/chariot/action'],
  ['424', 'units/cavalry/standing'],
  ['663', 'units/cavalry/walking'],
  ['211', 'units/cavalry/action'],
  ['320', 'units/cavalry/dying'],
  ['379', 'units/cavalry/corpse'],
  ['423', 'units/cataphract/standing'],
  ['662', 'units/cataphract/walking'],
  ['210', 'units/cataphract/action'],
  ['319', 'units/cataphract/dying'],
  ['378', 'units/cataphract/corpse'],
  ['427', 'units/elephant-archer/standing'],
  ['666', 'units/elephant-archer/walking'],
  ['214', 'units/elephant-archer/action'],
  ['323', 'units/elephant-archer/dying'],
  ['385', 'units/elephant-archer/corpse'],
  ['429', 'units/war-elephant/standing'],
  ['669', 'units/war-elephant/walking'],
  ['216', 'units/war-elephant/action'],
  ['325', 'units/war-elephant/dying'],
  ['387', 'units/war-elephant/corpse'],
  ['421', 'units/stone-thrower/standing'],
  ['660', 'units/stone-thrower/walking'],
  ['629', 'units/stone-thrower/action'],
  ['317', 'units/stone-thrower/dying'],
  ['376', 'units/stone-thrower/corpse'],
  ['420', 'units/catapult/standing'],
  ['659', 'units/catapult/walking'],
  ['208', 'units/catapult/action'],
  ['316', 'units/catapult/dying'],
  ['375', 'units/catapult/corpse'],
  ['417', 'units/ballista/standing'],
  ['656', 'units/ballista/walking'],
  ['207', 'units/ballista/action'],
  ['313', 'units/ballista/dying'],
  ['372', 'units/ballista/corpse'],
  ['474', 'boats/fishing-ship/body'],
  ['700', 'boats/fishing-ship/fishing-overlay'],
  ['263', 'boats/wreck-small'],
  ['647', 'boats/light-transport/body'],
  ['648', 'boats/heavy-transport/body'],
  ['692', 'boats/scout-ship/body'],
  ['691', 'boats/war-galley/body'],
  ['264', 'boats/wreck-large'],
  ['693', 'boats/trireme/body'],
  ['695', 'boats/juggernaut/body'],
  ['583', 'boats/sail-5-direction'],
  ['584', 'boats/sail-9-direction'],
  ['360', 'projectiles/stone'],
  ['461', 'projectiles/fire-stone'],
  ['243', 'projectiles/arrow'],
  ['252', 'projectiles/fire-arrow'],
  ['242', 'projectiles/bolt'],
  ['265', 'projectiles/fire-bolt'],
  ['701', 'projectiles/bullet'],
  ['496', 'projectiles/impact/explosion'],
  ['714', 'projectiles/supercar-missile'],
  ['608', 'projectiles/spear'],
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
fs.writeFileSync(playerConfigPath, replaceQuotedSheetIds(fs.readFileSync(playerConfigPath, 'utf8')))

console.log(`renamed ${renamedCount} player config graphics directories`)
