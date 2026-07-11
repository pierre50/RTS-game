#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const graphicsRoot = path.join(root, 'public/assets/graphics')

const directoryRenames = [
  ['extra-units', 'units'],
  ['units/boats', 'boats'],
]

const textFiles = [
  'app/config/assetManifest.ts',
  'app/config/playerConfig.ts',
  'tests/dock-upgrade-menu.test.cjs',
  'tests/trireme-directional-sheet.test.cjs',
  'scripts/rename-player-config-graphics.cjs',
]

function renameDirectory(fromName, toName) {
  const from = path.join(graphicsRoot, fromName)
  const to = path.join(graphicsRoot, toName)

  if (!fs.existsSync(from)) return false

  if (!fs.existsSync(to)) {
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.renameSync(from, to)
    return true
  }

  for (const entry of fs.readdirSync(from)) {
    const childFrom = path.join(from, entry)
    const childTo = path.join(to, entry)
    if (fs.existsSync(childTo)) {
      throw new Error(`Cannot merge ${fromName}: target already exists at ${path.relative(root, childTo)}`)
    }
    fs.renameSync(childFrom, childTo)
  }
  fs.rmSync(from, { recursive: true, force: true })
  return true
}

function replaceText(fileName) {
  const file = path.join(root, fileName)
  let source = fs.readFileSync(file, 'utf8')
  const before = source

  source = source.split('units/units/boats/').join('boats/')
  source = source.split('units/boats/').join('boats/')
  source = source.split('assets/graphics/units/units/boats/').join('assets/graphics/boats/')
  source = source.split('assets/graphics/units/boats/').join('assets/graphics/boats/')
  source = source.split('extra-units/').join('units/')

  if (source === before) return false
  fs.writeFileSync(file, source)
  return true
}

let renamed = 0
for (const [fromName, toName] of directoryRenames) {
  if (renameDirectory(fromName, toName)) renamed += 1
}

const touched = textFiles.filter(replaceText)

if (!renamed && !touched.length) {
  console.log('unit domain graphics: nothing to migrate')
} else {
  console.log(`unit domain graphics: renamed ${renamed} directories`)
  if (touched.length) console.log(`unit domain graphics: updated ${touched.join(', ')}`)
}
