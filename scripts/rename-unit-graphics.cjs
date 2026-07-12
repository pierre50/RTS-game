#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const graphicsRoot = path.join(root, 'public/assets/graphics')
const unitsPath = path.join(root, 'public/assets/data/gameplay/units.json')
const assetManifestPath = path.join(root, 'app/config/assetManifest.ts')
const playerConfigPath = path.join(root, 'app/config/playerConfig.ts')

const mappings = [
  ['418', 'units/villager/default/standing'],
  ['657', 'units/villager/default/walking'],
  ['314', 'units/villager/default/dying'],
  ['373', 'units/villager/default/corpse'],
  ['224', 'units/villager/attacker/action'],
  ['624', 'units/villager/hunter/action'],
  ['626', 'units/villager/hunter/harvest'],
  ['435', 'units/villager/hunter/standing'],
  ['676', 'units/villager/hunter/walking'],
  ['332', 'units/villager/hunter/dying'],
  ['389', 'units/villager/hunter/corpse'],
  ['272', 'units/villager/hunter/loaded'],
  ['631', 'units/villager/fisher/action'],
  ['431', 'units/villager/fisher/standing'],
  ['271', 'units/villager/fisher/loaded'],
  ['630', 'units/villager/farmer/action'],
  ['430', 'units/villager/farmer/standing'],
  ['670', 'units/villager/farmer/walking'],
  ['326', 'units/villager/farmer/dying'],
  ['388', 'units/villager/farmer/corpse'],
  ['672', 'units/villager/farmer/loaded'],
  ['632', 'units/villager/forager/action'],
  ['432', 'units/villager/forager/standing'],
  ['328', 'units/villager/forager/dying'],
  ['390', 'units/villager/forager/corpse'],
  ['633', 'units/villager/stoneminer/action'],
  ['441', 'units/villager/stoneminer/standing'],
  ['683', 'units/villager/stoneminer/walking'],
  ['315', 'units/villager/stoneminer/dying'],
  ['400', 'units/villager/stoneminer/corpse'],
  ['274', 'units/villager/stoneminer/loaded'],
  ['281', 'units/villager/goldminer/loaded'],
  ['625', 'units/villager/woodcutter/action'],
  ['440', 'units/villager/woodcutter/standing'],
  ['682', 'units/villager/woodcutter/walking'],
  ['399', 'units/villager/woodcutter/corpse'],
  ['273', 'units/villager/woodcutter/loaded'],
  ['628', 'units/villager/builder/action'],
  ['419', 'units/villager/builder/standing'],
  ['658', 'units/villager/builder/walking'],
  ['374', 'units/villager/builder/corpse'],
  ['425', 'units/clubman/standing'],
  ['664', 'units/clubman/walking'],
  ['212', 'units/clubman/action'],
  ['321', 'units/clubman/dying'],
  ['380', 'units/clubman/corpse'],
  ['445', 'units/scout/standing'],
  ['651', 'units/scout/walking'],
  ['227', 'units/scout/action'],
  ['343', 'units/scout/dying'],
  ['403', 'units/scout/corpse'],
  ['413', 'units/bowman/standing'],
  ['652', 'units/bowman/walking'],
  ['203', 'units/bowman/action'],
  ['308', 'units/bowman/dying'],
  ['367', 'units/bowman/corpse'],
  ['443', 'units/priest/standing'],
  ['685', 'units/priest/walking'],
  ['634', 'units/priest/action'],
  ['341', 'units/priest/dying'],
  ['402', 'units/priest/corpse'],
  ['415', 'units/axeman/standing'],
  ['654', 'units/axeman/walking'],
  ['205', 'units/axeman/action'],
  ['311', 'units/axeman/dying'],
  ['370', 'units/axeman/corpse'],
  ['416', 'units/short-swordsman/standing'],
  ['655', 'units/short-swordsman/walking'],
  ['206', 'units/short-swordsman/action'],
  ['312', 'units/short-swordsman/dying'],
  ['371', 'units/short-swordsman/corpse'],
  ['437', 'units/broad-swordsman/standing'],
  ['678', 'units/broad-swordsman/walking'],
  ['220', 'units/broad-swordsman/action'],
  ['334', 'units/broad-swordsman/dying'],
  ['395', 'units/broad-swordsman/corpse'],
  ['436', 'units/long-swordsman/standing'],
  ['677', 'units/long-swordsman/walking'],
  ['219', 'units/long-swordsman/action'],
  ['333', 'units/long-swordsman/dying'],
  ['394', 'units/long-swordsman/corpse'],
  ['414', 'units/improved-bowman/standing'],
  ['653', 'units/improved-bowman/walking'],
  ['204', 'units/improved-bowman/action'],
  ['309', 'units/improved-bowman/dying'],
  ['368', 'units/improved-bowman/corpse'],
  ['442', 'units/hoplite/standing'],
  ['684', 'units/hoplite/walking'],
  ['225', 'units/hoplite/action'],
  ['340', 'units/hoplite/dying'],
  ['401', 'units/hoplite/corpse'],
  ['439', 'units/composite-bowman/standing'],
  ['681', 'units/composite-bowman/walking'],
  ['223', 'units/composite-bowman/action'],
  ['337', 'units/composite-bowman/dying'],
  ['398', 'units/composite-bowman/corpse'],
  ['412', 'units/chariot-archer/standing'],
  ['650', 'units/chariot-archer/walking'],
  ['202', 'units/chariot-archer/action'],
  ['310', 'units/chariot-archer/dying'],
  ['369', 'units/chariot-archer/corpse'],
  ['473', 'boats/fishing-boat'],
  ['697', 'boats/fishing-boat/fishing-overlay'],
  ['262', 'boats/wrecks/small'],
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

function replaceUnitSheetIds(value) {
  if (typeof value === 'string') return renameMap.get(value) ?? value
  if (Array.isArray(value)) return value.map(replaceUnitSheetIds)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, replaceUnitSheetIds(nested)]))
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

const units = JSON.parse(fs.readFileSync(unitsPath, 'utf8'))
const nextUnits = replaceUnitSheetIds(units)
fs.writeFileSync(unitsPath, `${JSON.stringify(nextUnits, null, 2)}\n`)

fs.writeFileSync(assetManifestPath, replaceQuotedSheetIds(fs.readFileSync(assetManifestPath, 'utf8')))
fs.writeFileSync(playerConfigPath, replaceQuotedSheetIds(fs.readFileSync(playerConfigPath, 'utf8')))

console.log(`renamed ${renamedCount} unit graphics directories`)
