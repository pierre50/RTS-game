#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const graphicsRoot = path.join(root, 'public/assets/graphics')

const textFiles = [
  'app/config/assetManifest.ts',
  'app/lib/buildings/walls.ts',
  'tests/wall-technologies.test.cjs',
  'scripts/rename-building-support-graphics.cjs',
]

function moveWallsDirectory() {
  const from = path.join(graphicsRoot, 'walls')
  const to = path.join(graphicsRoot, 'buildings/walls')

  if (!fs.existsSync(from)) return false
  if (fs.existsSync(to)) {
    throw new Error(`Cannot move walls: target already exists at ${path.relative(root, to)}`)
  }

  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.renameSync(from, to)
  return true
}

function replaceText(fileName) {
  const file = path.join(root, fileName)
  let source = fs.readFileSync(file, 'utf8')
  const before = source

  source = source.split('buildings/buildings/walls/').join('buildings/walls/')
  source = source.split('assets/graphics/buildings/buildings/walls/').join('assets/graphics/buildings/walls/')
  source = source.split('assets/graphics/walls/').join('assets/graphics/buildings/walls/')
  source = source.replace(/(['"`])walls\//g, '$1buildings/walls/')

  if (source === before) return false
  fs.writeFileSync(file, source)
  return true
}

const moved = moveWallsDirectory()
const touched = textFiles.filter(replaceText)

if (!moved && !touched.length) {
  console.log('building domain graphics: nothing to migrate')
} else {
  console.log(`building domain graphics: moved ${moved ? 1 : 0} directories`)
  if (touched.length) console.log(`building domain graphics: updated ${touched.join(', ')}`)
}
