#!/usr/bin/env node
const { syncWorldSettlementManifest } = require('./caves/settlements.cjs')
const { writeScenery } = require('./maps/scenery.cjs')
const fs = require('node:fs')
const path = require('node:path')
const { finalizeBlueprintPayload } = require('./maps/local-blueprint.cjs')

// Upgrade existing source maps without changing seeds or regenerating settlements.
const root = path.resolve(process.argv[2] || 'public/maps/worlds/world-4242')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'))
for (const entry of manifest.maps) {
  const file = path.join(root, 'maps', entry.path)
  const source = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (process.argv.includes('--replan-caves')) delete source.caves
  const finalized = finalizeBlueprintPayload(source, { refreshContent: process.argv.includes('--refresh-content') })
  if (finalized !== source) fs.writeFileSync(file, JSON.stringify(finalized) + '\n')
  if (finalized.settlements) entry.settlements = finalized.settlements
  entry.sceneryPath = entry.path.replace(/\.map$/, '.scenery.json')
  writeScenery(finalized, path.join(root, 'maps', entry.sceneryPath))
  console.log(`Finalized ${entry.id}`)
}

syncWorldSettlementManifest(manifest)
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
