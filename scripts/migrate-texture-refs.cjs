const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..')
const TEXTURE_REF_PATTERN = /^(\d+)_(.+)$/

function toTextureRef(value) {
  if (typeof value !== 'string') return value
  const match = value.match(TEXTURE_REF_PATTERN)
  if (!match) return value
  return {
    sheet: match[2],
    frame: Number(match[1]),
  }
}

function migrateTextureRefs(value) {
  if (Array.isArray(value)) return value.map(migrateTextureRefs)
  if (value && typeof value === 'object') {
    if (typeof value.sheet === 'string' && typeof value.frame === 'number') return value
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, migrateTextureRefs(child)]))
  }
  return toTextureRef(value)
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function migrateFile(file, migrator) {
  const before = fs.readFileSync(file, 'utf8')
  const data = migrator(readJson(file))
  const after = `${JSON.stringify(data, null, 2)}\n`
  if (before === after) return false
  fs.writeFileSync(file, after)
  return true
}

function migrateResources(data) {
  for (const resource of Object.values(data)) {
    if (resource && typeof resource === 'object' && 'assets' in resource) {
      resource.assets = migrateTextureRefs(resource.assets)
    }
  }
  return data
}

function migrateCells(data) {
  for (const cell of Object.values(data)) {
    if (cell && typeof cell === 'object' && Array.isArray(cell.assets)) {
      cell.assets = migrateTextureRefs(cell.assets)
    }
  }
  return data
}

function migrateCivilization(data) {
  for (const age of Object.values(data.buildings || {})) {
    for (const building of Object.values(age || {})) {
      if (building?.images) building.images = migrateTextureRefs(building.images)
    }
  }
  return data
}

const targets = [
  ['public/assets/data/gameplay/resources.json', migrateResources],
  ['public/assets/data/gameplay/cells.json', migrateCells],
  ['public/assets/data/civilizations/asian.json', migrateCivilization],
  ['public/assets/data/civilizations/babylonian.json', migrateCivilization],
  ['public/assets/data/civilizations/egyptian.json', migrateCivilization],
  ['public/assets/data/civilizations/greek.json', migrateCivilization],
]

let changed = 0
for (const [relativeFile, migrator] of targets) {
  const file = path.join(ROOT, relativeFile)
  if (migrateFile(file, migrator)) {
    changed += 1
    console.log(`migrated ${relativeFile}`)
  }
}

console.log(changed ? `migrated ${changed} files` : 'nothing to migrate')
