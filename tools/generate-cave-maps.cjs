#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const { createCave, validateCave, VARIANTS } = require('./caves/layout.cjs')
const { writePreview } = require('./caves/preview.cjs')

function generateCaves({ out = path.resolve(__dirname, '../public/maps/interiors/cave'), seed = 4242 } = {}) {
  const blueprints = []
  const entries = []
  for (const tier of ['small', 'medium', 'large']) {
    for (const variant of tier === 'small' ? ['circle'] : VARIANTS) {
      const blueprint = createCave(tier, variant, seed)
      validateCave(blueprint)
      const directory = path.join(out, tier)
      fs.mkdirSync(directory, { recursive: true })
      const file = `${tier}/${blueprint.id}.map`
      fs.writeFileSync(path.join(out, file), JSON.stringify(blueprint) + '\n')
      writePreview(blueprint, path.join(out, `${tier}/${blueprint.id}.png`))
      entries.push({ id: blueprint.id, tier, variant, size: blueprint.size, path: file })
      blueprints.push(blueprint)
    }
  }
  fs.writeFileSync(
    path.join(out, 'manifest.json'),
    JSON.stringify({ format: 'cave-map-manifest', version: 1, seed, blueprints: entries }, null, 2) + '\n'
  )
  // Compact, preloaded catalog also makes synchronous save restoration possible.
  fs.writeFileSync(path.join(out, 'catalog.json'), JSON.stringify({ version: 1, blueprints }) + '\n')
  return entries
}
if (require.main === module) {
  const options = {}
  const args = process.argv.slice(2).filter(arg => arg !== '--')
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === '--out') options.out = path.resolve(args[i + 1])
    else if (args[i] === '--seed' && Number.isSafeInteger(Number(args[i + 1]))) options.seed = Number(args[i + 1])
    else throw new Error('Usage: pnpm caves:generate --seed 4242 --out public/maps/interiors/cave')
  }
  console.log(`Generated ${generateCaves(options).length} cave blueprints with previews.`)
}
module.exports = { generateCaves }
