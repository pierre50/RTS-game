#!/usr/bin/env node
const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const { prepareSettlements } = require('./maps/settlements/prepare-settlements.cjs')
const { generationSources } = require('./maps/load-generation-ts.cjs')
const root = path.resolve(__dirname, '..')
const hash = value => createHash('sha256').update(value).digest('hex')

function options(args) {
  const result = { check: false }
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (arg === '--check') result.check = true
    else if (arg === '--help') result.help = true
    else if (arg === '--out') {
      if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error('--out requires a directory')
      result.output = path.resolve(args[++index])
    } else if (arg.startsWith('--') || result.input) throw new Error(`Unknown argument: ${arg}`)
    else result.input = path.resolve(arg)
  }
  return result
}

function rulesHash() {
  const files = [
    ...new Set([
      ...generationSources(),
      __filename,
      ...[
        'load-generation-ts',
        'settlements/prepare-settlements',
        'settlements/settlement-animals',
        'noise',
        'settlements/distribute-settlement-units',
        'prepare-bandit-camps',
        'settlements/settlement-terrain',
        'settlements/validate-settlements',
      ].map(name => path.join(__dirname, 'maps', `${name}.cjs`)),
      ...['buildings', 'units', 'equipment'].map(name =>
        path.join(root, 'public/assets/data/gameplay', `${name}.json`)
      ),
    ]),
  ].sort()
  return hash(files.map(file => `${path.relative(root, file)}\n${hash(fs.readFileSync(file))}`).join('\n'))
}
function main(args = process.argv.slice(2)) {
  const opts = options(args)
  if (opts.help || !opts.input) {
    console.log(
      'Usage: node tools/prepare-world-settlements.cjs <world-directory|map-file> [--out directory] [--check]'
    )
    return
  }
  const manifestPath = fs.statSync(opts.input).isDirectory() ? path.join(opts.input, 'manifest.json') : null
  const manifest = manifestPath ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : null
  const files = manifest ? manifest.maps.map(entry => path.join(opts.input, 'maps', entry.path)) : [opts.input]
  for (const file of files) {
    const raw = fs.readFileSync(file)
    const source = JSON.parse(raw)
    const prepared = prepareSettlements(source)
    prepared.source = { file: path.basename(file), sha256: hash(raw), rulesSha256: rulesHash() }
    const target = path.join(opts.output ?? path.dirname(file), `${path.basename(file, '.map')}.settlements.json`)
    const encoded = `${JSON.stringify(prepared)}\n`
    if (opts.check) {
      if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== encoded)
        throw new Error(`Missing or stale preparation: ${target}`)
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true })
      const temporary = `${target}.${process.pid}.tmp`
      try {
        fs.writeFileSync(temporary, encoded)
        fs.renameSync(temporary, target)
      } finally {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
      }
    }
    if (manifest && !opts.output) {
      const entry = manifest.maps.find(entry => entry.path === path.basename(file))
      const reference = {
        path: path.basename(target),
        sha256: hash(encoded),
        sourceSha256: prepared.source.sha256,
        rulesSha256: prepared.source.rulesSha256,
      }
      if (opts.check && JSON.stringify(entry.preparedSettlements) !== JSON.stringify(reference))
        throw new Error(`Missing or stale manifest reference: ${file}`)
      entry.preparedSettlements = reference
    }
    console.log(
      JSON.stringify({
        map: source.id,
        status: opts.check ? 'verified' : 'prepared',
        output: target,
        ...prepared.summary,
      })
    )
  }
  if (manifest && !opts.output && !opts.check) {
    const temporary = `${manifestPath}.${process.pid}.tmp`
    fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`)
    fs.renameSync(temporary, manifestPath)
  }
}
if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
module.exports = { main, options }
