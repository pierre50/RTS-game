#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const graphicsRoot = path.join(root, 'public/assets/graphics')

const textFiles = [
  'app/config/assetManifest.ts',
  'public/assets/data/gameplay/units.json',
  'tests/dock-upgrade-menu.test.cjs',
  'tests/trireme-directional-sheet.test.cjs',
  'scripts/rename-unit-graphics.cjs',
]

function moveDirectory() {
  const from = path.join(graphicsRoot, 'units/fishing-boat')
  const to = path.join(graphicsRoot, 'boats/fishing-boat')

  if (!fs.existsSync(from)) return false
  if (fs.existsSync(to)) {
    throw new Error(`Cannot move fishing boat: target already exists at ${path.relative(root, to)}`)
  }

  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.renameSync(from, to)
  return true
}

function replaceText(fileName) {
  const file = path.join(root, fileName)
  let source = fs.readFileSync(file, 'utf8')
  const before = source

  source = source.split('assets/graphics/units/fishing-boat/').join('assets/graphics/boats/fishing-boat/')
  source = source.split('units/fishing-boat/').join('boats/fishing-boat/')

  if (source === before) return false
  fs.writeFileSync(file, source)
  return true
}

const moved = moveDirectory()
const touched = textFiles.filter(replaceText)

if (!moved && !touched.length) {
  console.log('fishing boat domain: nothing to migrate')
} else {
  console.log(`fishing boat domain: moved ${moved ? 1 : 0} directories`)
  if (touched.length) console.log(`fishing boat domain: updated ${touched.join(', ')}`)
}
